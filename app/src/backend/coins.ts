import { limitToLast, onChildAdded, onValue, orderByKey, query, ref } from 'firebase/database'
import { collection, doc, increment, onSnapshot, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { R } from './messages'

// 코인: real coins (Upbit's KRW market, the top 100 by trading value), traded with points at 1P = 1원.
// The worker (.github/scripts/send-notifications.mjs) publishes:
//   coins/list/{SYM}  { n: Korean name, r: rank }
//   coins/live        { at, p: { SYM: price }, chg: { SYM: change since yesterday } }
//   coins/spark       { SYM: [last 60 one-minute prices] }
//   coins/h/{SYM}/{15 s slot ms} = price                  a coin's chart (24 h)
//   wallets/{uid}/{SYM} { q: amount, c: points paid for it }   (the worker keeps it)
// Orders go in coinOrders/{id}; a buy pays its points in the same write (firestore.rules: coinBuy).

export type CoinSym = string
export type CoinInfo = { sym: string; name: string; rank: number }

/** The coin list (top 100 by trading value), in rank order. */
export function watchCoinList(db: Firestore, cb: (l: CoinInfo[]) => void) {
  return onValue(ref(R(db), 'coins/list'), s => {
    const v = (s.val() ?? {}) as Record<string, { n?: string; r?: number }>
    cb(Object.entries(v).map(([sym, x]) => ({ sym, name: x.n ?? sym, rank: x.r ?? 999 })).sort((x, y) => x.rank - y.rank))
  }, () => cb([]))
}

const KNOWN_MARK: Record<string, string> = { BTC: '₿', ETH: 'Ξ', XRP: '✕', DOGE: 'Ð', SOL: '◎', ADA: '₳' }
/** A steady colour per coin (from its symbol) and a one- or two-letter mark. */
export const coinColor = (sym: string) => {
  let h = 0
  for (const ch of sym) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 62% 46%)`
}
export const coinMark = (sym: string) => KNOWN_MARK[sym] ?? sym.slice(0, 2)

/** Coin amounts keep 8 decimals, rounded down (the tiny allowance stops 0.12345678 × 1e8 landing just under). */
export const floor8 = (x: number) => Math.floor(x * 1e8 + 1e-6) / 1e8

export const MIN_BUY = 10

export type Prices = Record<string, number>
export type Live = { at: number; p: Prices; chg?: Record<string, number> } | null
export type Holding = { q: number; c: number }
export type Wallet = Record<string, Holding>
export type Point = { t: number; v: number }

export function watchLive(db: Firestore, cb: (l: Live) => void) {
  return onValue(ref(R(db), 'coins/live'), s => cb(s.val()), () => cb(null))
}

/** The small lines in the list: the last 60 one-minute prices of every coin. */
export function watchSpark(db: Firestore, cb: (s: Record<string, number[]>) => void) {
  return onValue(ref(R(db), 'coins/spark'), s => cb(s.val() ?? {}), () => cb({}))
}

/** One coin's chart: the latest `samples` prices (one every 15 s), oldest first, kept up to date. */
export function watchCoinHistory(db: Firestore, sym: CoinSym, samples: number, cb: (pts: Point[]) => void) {
  const pts: Point[] = []
  let ready = false
  const q = query(ref(R(db), `coins/h/${sym}`), orderByKey(), limitToLast(samples))
  const stop = onChildAdded(q, s => {
    pts.push({ t: Number(s.key), v: s.val() })
    if (pts.length > samples) pts.shift()
    if (ready) cb([...pts])
  }, () => cb([]))
  // the first batch arrives as many child_added calls: report it once
  const first = onValue(q, () => { ready = true; cb([...pts].sort((a, b) => a.t - b.t)) }, () => {}, { onlyOnce: true })
  return () => { stop(); first() }
}

export function watchWallet(db: Firestore, uid: string, cb: (w: Wallet) => void) {
  return onValue(ref(R(db), `wallets/${uid}`), s => cb(s.val() ?? {}), () => cb({}))
}

export type OrderResult = { status: 'done' | 'failed' | 'pending'; price?: number; qty?: number; points?: number; reason?: string }

/** Waits (up to `ms`) for the worker to fill an order. */
function waitFill(db: Firestore, id: string, ms = 20000): Promise<OrderResult> {
  return new Promise(resolve => {
    let stop = () => {}
    const t = setTimeout(() => { stop(); resolve({ status: 'pending' }) }, ms)
    stop = onSnapshot(doc(db, 'coinOrders', id), s => {
      const d = s.data()
      if (d && d.status !== 'open') { clearTimeout(t); stop(); resolve({ status: d.status, price: d.price, qty: d.qty, points: d.points, reason: d.reason }) }
    }, () => {})
  })
}

export const LEVERAGES = [2, 3, 5, 10, 500] as const
export type Lev = (typeof LEVERAGES)[number]

/** Buys `points` worth of a coin (the points leave right away). With `lev` (2–500) it's a 레버리지
 *  position: the points are the margin, the position is margin × lev, and it's liquidated when the
 *  price falls by 1/lev (10× → −10 %). */
export async function buyCoin(db: Firestore, uid: string, coin: CoinSym, points: number, lev: 1 | Lev = 1): Promise<OrderResult> {
  points = Math.floor(points)
  if (!(points >= MIN_BUY)) throw new Error('invalid-amount')
  const r = doc(collection(db, 'coinOrders'))
  const b = writeBatch(db)
  if (lev === 1) b.set(r, { uid, coin, side: 'buy', points, at: serverTimestamp(), status: 'open' })
  else b.set(r, { uid, coin, side: 'long', points, lev, at: serverTimestamp(), status: 'open' })
  b.update(doc(db, 'candidates', uid), { spent: increment(points), lastCoin: r.id })
  await b.commit()
  return waitFill(db, r.id)
}

/** Sells `qty` of a coin for points at the current price. */
export async function sellCoin(db: Firestore, uid: string, coin: CoinSym, qty: number): Promise<OrderResult> {
  // never more precision than the wallet keeps (8 decimals), rounded down
  const q = floor8(qty)
  if (!(q > 0)) throw new Error('invalid-amount')
  const r = doc(collection(db, 'coinOrders'))
  const b = writeBatch(db)
  b.set(r, { uid, coin, side: 'sell', qty: q, at: serverTimestamp(), status: 'open' })
  await b.commit()
  return waitFill(db, r.id)
}

export type Position = { id: string; sym: CoinSym; lev: number; margin: number; qty: number; entry: number; liq: number; at: number }

/** My open 레버리지 positions (live). */
export function watchPositions(db: Firestore, uid: string, cb: (p: Position[]) => void) {
  return onValue(ref(R(db), `positions/${uid}`), s => {
    const v = (s.val() ?? {}) as Record<string, Omit<Position, 'id'>>
    cb(Object.entries(v).map(([id, x]) => ({ id, ...x })).sort((a, b) => b.at - a.at))
  }, () => cb([]))
}

/** Closes a 레버리지 position at the current price (the margin ± result comes back). */
export async function closePosition(db: Firestore, uid: string, posId: string, coin: CoinSym): Promise<OrderResult> {
  const r = doc(collection(db, 'coinOrders'))
  const b = writeBatch(db)
  b.set(r, { uid, coin, side: 'close', posId, at: serverTimestamp(), status: 'open' })
  await b.commit()
  return waitFill(db, r.id)
}

export const fmtPrice = (p: number | undefined) =>
  p == null ? '-' : p >= 100 ? Math.round(p).toLocaleString() : p >= 1 ? p.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.toLocaleString(undefined, { maximumSignificantDigits: 4 })
export const fmtQty = (q: number) => q.toLocaleString(undefined, { maximumFractionDigits: q >= 1 ? 4 : 8 })

export type Trade = { id: string; name: string; side: 'buy' | 'sell' | 'liq'; points: number; qty: number; price: number; at: number }

/** The latest trades in one coin, from everyone (the worker records each fill). Newest first. */
export function watchTrades(db: Firestore, sym: CoinSym, cb: (t: Trade[]) => void) {
  const list = new Map<string, Trade>()
  const stop = onChildAdded(query(ref(R(db), `coinTrades/${sym}`), limitToLast(40)), s => {
    const v = s.val()
    if (!v) return
    list.set(s.key!, { id: s.key!, name: v.name ?? '알 수 없음', side: v.side, points: v.points, qty: v.qty, price: v.price, at: v.at ?? 0 })
    cb([...list.values()].sort((a, b) => b.id.localeCompare(a.id)))
  }, () => cb([]))
  return stop
}
