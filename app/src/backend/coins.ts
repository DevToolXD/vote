import { limitToLast, onChildAdded, onValue, orderByKey, query, ref } from 'firebase/database'
import { collection, doc, increment, onSnapshot, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { R } from './messages'

// 코인: made-up coins traded with points. Prices are a random walk run by the worker
// (.github/scripts/send-notifications.mjs — nothing real behind them):
//   coins/live { at, p: { sym: price } }      every few seconds
//   coins/m1/{minute ms} { sym: price }        the last 24 hours, for the charts
//   wallets/{uid}/{sym} { q: amount, c: points paid for it }   (the worker keeps it)
// Orders go in coinOrders/{id}; a buy pays its points in the same write (firestore.rules: coinBuy).

export type CoinSym = 'JEONG' | 'BTC' | 'ETH' | 'XRP' | 'DOGE' | 'SGP' | 'KIMCHI' | 'TTEOK' | 'CHICKEN' | 'RAMEN' | 'MOON'
export const COINS: { sym: CoinSym; name: string; color: string; mark: string }[] = [
  { sym: 'JEONG', name: '정후교 대천재 코인', color: '#ffd43b', mark: '천' },
  { sym: 'BTC', name: '비트코인', color: '#f7931a', mark: '₿' },
  { sym: 'ETH', name: '이더리움', color: '#627eea', mark: 'Ξ' },
  { sym: 'XRP', name: '리플', color: '#23292f', mark: '✕' },
  { sym: 'DOGE', name: '도지코인', color: '#c2a633', mark: 'Ð' },
  { sym: 'SGP', name: '삼겹코인', color: '#ff6b6b', mark: '🥓' },
  { sym: 'KIMCHI', name: '김치코인', color: '#d9480f', mark: '김' },
  { sym: 'TTEOK', name: '떡볶이코인', color: '#e64980', mark: '떡' },
  { sym: 'CHICKEN', name: '치킨코인', color: '#f59f00', mark: '🍗' },
  { sym: 'RAMEN', name: '라면코인', color: '#fab005', mark: '🍜' },
  { sym: 'MOON', name: '문코인', color: '#6741d9', mark: '🌙' },
]
export const MIN_BUY = 10

export type Prices = Partial<Record<CoinSym, number>>
export type Live = { at: number; p: Prices } | null
export type Point = { t: number; p: Prices }
export type Holding = { q: number; c: number }
export type Wallet = Partial<Record<CoinSym, Holding>>

export function watchLive(db: Firestore, cb: (l: Live) => void) {
  return onValue(ref(R(db), 'coins/live'), s => cb(s.val()), () => cb(null))
}

/** The last `minutes` one-minute prices, kept up to date as new minutes arrive. */
export function watchHistory(db: Firestore, minutes: number, cb: (pts: Point[]) => void) {
  const pts: Point[] = []
  let ready = false
  const q = query(ref(R(db), 'coins/m1'), orderByKey(), limitToLast(minutes))
  const stop = onChildAdded(q, s => {
    pts.push({ t: Number(s.key), p: s.val() })
    if (pts.length > minutes) pts.shift()
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

/** Buys `points` worth of a coin (the points leave right away). */
export async function buyCoin(db: Firestore, uid: string, coin: CoinSym, points: number): Promise<OrderResult> {
  points = Math.floor(points)
  if (!(points >= MIN_BUY)) throw new Error('invalid-amount')
  const r = doc(collection(db, 'coinOrders'))
  const b = writeBatch(db)
  b.set(r, { uid, coin, side: 'buy', points, at: serverTimestamp(), status: 'open' })
  b.update(doc(db, 'candidates', uid), { spent: increment(points), lastCoin: r.id })
  await b.commit()
  return waitFill(db, r.id)
}

/** Sells `qty` of a coin for points at the current price. */
export async function sellCoin(db: Firestore, uid: string, coin: CoinSym, qty: number): Promise<OrderResult> {
  // never more precision than the wallet keeps (8 decimals), rounded down
  const q = Math.floor(qty * 1e8) / 1e8
  if (!(q > 0)) throw new Error('invalid-amount')
  const r = doc(collection(db, 'coinOrders'))
  const b = writeBatch(db)
  b.set(r, { uid, coin, side: 'sell', qty: q, at: serverTimestamp(), status: 'open' })
  await b.commit()
  return waitFill(db, r.id)
}

export const fmtPrice = (p: number | undefined) =>
  p == null ? '-' : p >= 100 ? Math.round(p).toLocaleString() : p.toLocaleString(undefined, { maximumFractionDigits: p >= 1 ? 2 : 4 })
export const fmtQty = (q: number) => q.toLocaleString(undefined, { maximumFractionDigits: q >= 1 ? 4 : 8 })
