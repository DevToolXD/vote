import { limitToLast, onChildAdded, onValue, orderByKey, query, ref } from 'firebase/database'
import { collection, doc, increment, onSnapshot, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { R } from './messages'

// 코인: made-up coins traded with points. Prices are a random walk run by the worker
// (.github/scripts/send-notifications.mjs — nothing real behind them):
//   coins/live { at, p: { sym: price } }      every few seconds
//   coins/hist/{15 s slot ms} { sym: price }   the last 24 hours (a sample every 15 s), for the charts
//   wallets/{uid}/{sym} { q: amount, c: points paid for it }   (the worker keeps it)
// Orders go in coinOrders/{id}; a buy pays its points in the same write (firestore.rules: coinBuy).

export type CoinSym = 'JEONG' | 'BTC' | 'ETH' | 'XRP' | 'DOGE' | 'SGP' | 'KIMCHI' | 'TTEOK' | 'CHICKEN' | 'RAMEN' | 'MOON' | 'BUNGEO' | 'HOTTEOK' | 'SUNDAE' | 'GIMBAP' | 'BIBIM' | 'SOJU' | 'MAKGEOLI' | 'BEER' | 'SAMGYE' | 'BULGOGI' | 'JAJANG' | 'JJAMPPONG' | 'TANGSU' | 'PIZZA' | 'HAMBURGER' | 'COFFEE' | 'TEA' | 'BOBA' | 'MANGO' | 'APPLE' | 'BANANA' | 'CAT' | 'DOG' | 'DUCK' | 'DRAGON' | 'TIGER' | 'STAR' | 'DIAMOND' | 'GOLDBAR' | 'ROCKET'
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
  { sym: 'BUNGEO', name: '붕어빵코인', color: '#c9742b', mark: '붕' },
  { sym: 'HOTTEOK', name: '호떡코인', color: '#b5651d', mark: '호' },
  { sym: 'SUNDAE', name: '순대코인', color: '#8c4a2f', mark: '순' },
  { sym: 'GIMBAP', name: '김밥코인', color: '#2b8a3e', mark: '밥' },
  { sym: 'BIBIM', name: '비빔코인', color: '#e03131', mark: '비' },
  { sym: 'SOJU', name: '소주코인', color: '#37b24d', mark: '소' },
  { sym: 'MAKGEOLI', name: '막걸리코인', color: '#adb5bd', mark: '막' },
  { sym: 'BEER', name: '맥주코인', color: '#fcc419', mark: '맥' },
  { sym: 'SAMGYE', name: '삼계탕코인', color: '#f08c00', mark: '계' },
  { sym: 'BULGOGI', name: '불고기코인', color: '#a61e4d', mark: '불' },
  { sym: 'JAJANG', name: '짜장코인', color: '#212529', mark: '짜' },
  { sym: 'JJAMPPONG', name: '짬뽕코인', color: '#e8590c', mark: '짬' },
  { sym: 'TANGSU', name: '탕수육코인', color: '#f59f00', mark: '탕' },
  { sym: 'PIZZA', name: '피자코인', color: '#fa5252', mark: '피' },
  { sym: 'HAMBURGER', name: '햄버거코인', color: '#846358', mark: '햄' },
  { sym: 'COFFEE', name: '커피코인', color: '#5c3d2e', mark: '커' },
  { sym: 'TEA', name: '녹차코인', color: '#74b816', mark: '녹' },
  { sym: 'BOBA', name: '버블티코인', color: '#8d6e63', mark: '버' },
  { sym: 'MANGO', name: '망고코인', color: '#ffd43b', mark: '망' },
  { sym: 'APPLE', name: '사과코인', color: '#c92a2a', mark: '사' },
  { sym: 'BANANA', name: '바나나코인', color: '#fab005', mark: '바' },
  { sym: 'CAT', name: '고양이코인', color: '#868e96', mark: '🐱' },
  { sym: 'DOG', name: '강아지코인', color: '#a0522d', mark: '🐶' },
  { sym: 'DUCK', name: '오리코인', color: '#ffe066', mark: '🦆' },
  { sym: 'DRAGON', name: '용코인', color: '#2f9e44', mark: '용' },
  { sym: 'TIGER', name: '호랑이코인', color: '#e8590c', mark: '虎' },
  { sym: 'STAR', name: '별코인', color: '#7950f2', mark: '★' },
  { sym: 'DIAMOND', name: '다이아코인', color: '#4dabf7', mark: '◆' },
  { sym: 'GOLDBAR', name: '금괴코인', color: '#f1c40f', mark: '금' },
  { sym: 'ROCKET', name: '로켓코인', color: '#495057', mark: '🚀' },
]
/** Coin amounts keep 8 decimals, rounded down (the tiny allowance stops 0.12345678 × 1e8 landing just under). */
export const floor8 = (x: number) => Math.floor(x * 1e8 + 1e-6) / 1e8

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
/** The latest `samples` price samples (one every 15 s), oldest first. */
export function watchHistory(db: Firestore, samples: number, cb: (pts: Point[]) => void) {
  const pts: Point[] = []
  let ready = false
  const q = query(ref(R(db), 'coins/hist'), orderByKey(), limitToLast(samples))
  const stop = onChildAdded(q, s => {
    pts.push({ t: Number(s.key), p: s.val() })
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
  const q = floor8(qty)
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

export type Trade = { id: string; name: string; side: 'buy' | 'sell'; points: number; qty: number; price: number; at: number }

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
