import { limitToLast, onValue, orderByKey, query, ref } from 'firebase/database'
import type { Firestore } from 'firebase/firestore'
import { R } from './messages'

// 주식: domestic and foreign stocks, traded with points at 1P = 1원 (a US stock's dollar price is
// turned into won). The worker (.github/scripts/send-notifications.mjs) publishes:
//   stocks/list/{id}    { t: ticker, n: Korean name, m: 'KR' | 'US' | 'IX', r: order }   (`S_…` stocks, `I_…` indices)
//   stocks/live         { at, fx, st: { KR, US }, p: { id: points }, chg: { id: change since yesterday } }
//   stocks/info         { id: { o, h, l, pc, v, hi, lo, cap, st } }
//   stocks/spark/{id}   [last 30 daily closes]
//   stocks/d/{id}       { d: [days since 1970], v: [closes] }       5 years, daily
//   stocks/h/{id}/{minute ms} = price                              the last day, when it changed
// Buying and selling go through coins.ts (buyCoin / sellCoin, the same orders and wallet): an id
// starting with `S_` is a stock.

export type StockMarket = 'KR' | 'US' | 'IX'
export type StockMeta = { sym: string; ticker: string; name: string; market: StockMarket; rank: number }
export type StockLive = { at: number; fx: number; st?: Partial<Record<'KR' | 'US', string>>; p: Record<string, number>; chg?: Record<string, number> } | null
export type StockFacts = { o: number; h: number; l: number; pc: number; v: number; hi: number; lo: number; cap: number; st: string }
export type Daily = { d: number[]; v: number[] }
export type Sample = { t: number; v: number }

export const isStock = (sym: string) => sym.startsWith('S_')

export function watchStockList(db: Firestore, cb: (l: StockMeta[]) => void) {
  return onValue(ref(R(db), 'stocks/list'), s => {
    const v = (s.val() ?? {}) as Record<string, { t?: string; n?: string; m?: StockMarket; r?: number }>
    cb(Object.entries(v).map(([sym, x]) => ({ sym, ticker: x.t ?? sym, name: x.n ?? sym, market: x.m ?? 'US', rank: x.r ?? 9999 })).sort((a, b) => a.rank - b.rank))
  }, () => cb([]))
}
export const watchStockLive = (db: Firestore, cb: (l: StockLive) => void) => onValue(ref(R(db), 'stocks/live'), s => cb(s.val()), () => cb(null))
export const watchStockSpark = (db: Firestore, cb: (s: Record<string, number[]>) => void) => onValue(ref(R(db), 'stocks/spark'), s => cb(s.val() ?? {}), () => cb({}))
export type StockStatus = { at: number; ok: boolean; msg: string } | null
/** What the worker last got from Yahoo (so a stuck screen says why). */
export const watchStockStatus = (db: Firestore, cb: (s: StockStatus) => void) => onValue(ref(R(db), 'stocks/status'), s => cb(s.val()), () => cb(null))
export const watchStockInfo = (db: Firestore, cb: (s: Record<string, StockFacts>) => void) => onValue(ref(R(db), 'stocks/info'), s => cb(s.val() ?? {}), () => cb({}))

/** One stock's 5 years of daily closes. */
export function watchStockDaily(db: Firestore, sym: string, cb: (d: Daily | null) => void) {
  return onValue(ref(R(db), `stocks/d/${sym}`), s => { const v = s.val(); cb(v?.v?.length ? { d: v.d ?? [], v: v.v } : null) }, () => cb(null))
}
/** One stock's price changes over the last day, oldest first. */
export function watchStockToday(db: Firestore, sym: string, cb: (p: Sample[]) => void) {
  return onValue(query(ref(R(db), `stocks/h/${sym}`), orderByKey(), limitToLast(800)), s => {
    const out: Sample[] = []
    s.forEach(c => { out.push({ t: Number(c.key), v: c.val() }) })
    cb(out.sort((a, b) => a.t - b.t))
  }, () => cb([]))
}

/** Won with the right amount of detail; an index keeps two decimals. */
export const fmtStock = (p: number | undefined, index = false) =>
  p == null ? '-' : index ? p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p >= 1000 ? Math.round(p).toLocaleString() : p.toLocaleString(undefined, { maximumFractionDigits: 2 })
export const fmtSigned = (n: number, index = false) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtStock(Math.abs(n), index)}`
export const fmtPct = (f: number) => `${f > 0 ? '+' : f < 0 ? '−' : ''}${Math.abs(f * 100).toFixed(2)}%`
/** 4.913조, 1,505억, 320만 */
export function fmtCap(w: number | undefined) {
  if (!w) return '-'
  if (w >= 1e12) return `${(w / 1e12).toFixed(w >= 1e14 ? 0 : 1).replace(/\.0$/, '')}조`
  if (w >= 1e8) return `${Math.round(w / 1e8).toLocaleString()}억`
  return `${Math.round(w / 1e4).toLocaleString()}만`
}
export function fmtVolume(v: number | undefined) {
  if (!v) return '-'
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}억`
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}만`
  return v.toLocaleString()
}
export const stateLabel = (st?: string) => (st === 'REGULAR' ? '장중' : st === 'PRE' || st === 'PREPRE' ? '장 시작 전' : st === 'POST' || st === 'POSTPOST' ? '시간 외' : '장 마감')
