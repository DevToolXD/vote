import { limitToLast, onValue, orderByKey, query, ref, remove, type Database } from 'firebase/database'
import { FRAMES, SKINS } from '../data'

// 거래 내역: every change to someone's points, written by the background worker to the
// Realtime Database (ledger/{uid}; ledgerFeed and alerts for the admin). See
// .github/scripts/send-notifications.mjs (classify / record).

export type LedgerKind = 'vote' | 'giftSent' | 'giftClaim' | 'giftCancel' | 'buy' | 'pass' | 'grant' | 'season' | 'app' | 'revoke' | 'giftItemSent' | 'giftItemClaim' | 'bet' | 'betWin' | 'marketBuy' | 'marketSell' | 'marketList' | 'marketCancel' | 'coinBuy' | 'coinSell' | 'coinRefund' | 'heart' | 'song' | 'other'
/**
 * d = point change; n = how many votes / hearts / minutes one 'vote' / 'heart' / 'song' line adds up; b = the points
 * after this line; x = detail (item, other person; for votes, hearts and listens a list 'who|…|count;…', see entriesOf);
 * u = whose (feed only).
 */
export type LedgerRow = { id: string; at: number; d: number; k: LedgerKind; x?: string; n?: number; b?: number; u?: string }
/** The list in a vote / heart / song line: each entry is its parts ('uid' · 'posts/ID', 'uid' · 'vid', 'uid') and how many. */
export const entriesOf = (x?: string) => (x ?? '').split(';').filter(Boolean).map(e => { const p = e.split('|'); const n = Number(p.pop()) || 1; return { parts: p, n } })
/** 수상한 포인트 증가: gained within the worker's window (since → at). */
export type Alert = { uid: string; at: number; since: number; gain: number; votes: number; gifts: number; other: number; points: number }

const rows = (v: Record<string, Omit<LedgerRow, 'id'>> | null) => Object.entries(v ?? {}).map(([id, r]) => ({ ...r, id })).sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1))

export function subscribeLedger(rtdb: Database, uid: string, cb: (r: LedgerRow[]) => void) {
  return onValue(query(ref(rtdb, `ledger/${uid}`), orderByKey(), limitToLast(100)), s => cb(rows(s.val())), () => cb([]))
}
export function subscribeFeed(rtdb: Database, cb: (r: LedgerRow[]) => void) {
  return onValue(query(ref(rtdb, 'ledgerFeed'), orderByKey(), limitToLast(100)), s => cb(rows(s.val())), () => cb([]))
}
export function subscribeAlerts(rtdb: Database, cb: (a: Alert[]) => void) {
  return onValue(ref(rtdb, 'alerts'), s => cb(Object.entries((s.val() ?? {}) as Record<string, Omit<Alert, 'uid'>>).map(([uid, a]) => ({ ...a, uid })).sort((a, b) => b.gain - a.gain)), () => cb([]))
}
export const dismissAlert = (rtdb: Database, uid: string) => remove(ref(rtdb, `alerts/${uid}`))

export const ITEM_KIND: Record<string, string> = { frame: '프레임', plate: '이름표', skin: '막대 스킨', pass: '', set: '세트' }
export const itemName = (kind: string, key: string) => kind === 'set' ? FRAMES.find(([k]) => k === key)?.[1] ?? key : kind === 'pass' ? (key === 'pass2x' ? '투표 2배권' : key === 'passSpeed' ? '최대속도 3배 패스' : '페이크 선물 패스') : (kind === 'skin' ? SKINS : FRAMES).find(([k]) => k === key)?.[1] ?? key

/** One line of 거래 내역 in words, and an emoji for it. */
export function describe(r: LedgerRow, nameOf: (uid: string) => string): { icon: string; text: string; sub?: string } {
  const who = (uids: string[]) => { const u = [...new Set(uids)].map(id => nameOf(id) || '탈퇴한 사람'); return u.length ? (u.length > 2 ? `${u.slice(0, 2).join(', ')} 외 ${u.length - 2}명` : u.join(', ')) + '님' : '' }
  const people = entriesOf(r.x).map(e => e.parts[e.parts.length - 1] ?? '')
  switch (r.k) {
    case 'vote': return r.d > 0 ? { icon: '🗳️', text: r.n && r.n > 1 ? `투표 ${r.n}개 받음` : '투표 받음', sub: who(people) } : { icon: '↩️', text: '투표 취소됨' }
    case 'heart': return { icon: '❤️', text: r.n && r.n > 1 ? `하트 ${r.n}개 받음` : '하트 받음', sub: who(people) }
    case 'song': return { icon: '🎧', text: `내 곡이 ${r.n ?? 1}분 들렸어요`, sub: who(people) }
    case 'giftSent': return { icon: '🎁', text: r.x && !r.x.includes('_') && nameOf(r.x) ? `${nameOf(r.x)}님에게 선물` : '포인트 선물 보냄' }
    case 'giftClaim': return { icon: '🎁', text: r.x ? `${nameOf(r.x) || '누군가'}님이 준 선물 받음` : '선물 받음' }
    case 'giftItemSent': case 'giftItemClaim': {
      const [item, who] = (r.x ?? '').split('|'), [k, key] = item.split(':')
      const label = `${itemName(k, key)} ${ITEM_KIND[k] ?? ''}`
      return r.k === 'giftItemSent'
        ? { icon: '🛍️', text: who && nameOf(who) ? `${nameOf(who)}님에게 ${label} 선물` : `${label} 선물 보냄` }
        : { icon: '🛍️', text: `${nameOf(who) || '누군가'}님이 준 ${label} 받음` }
    }
    case 'giftCancel': return { icon: '↩️', text: '선물 취소 · 돌려받음' }
    case 'buy': return { icon: '🛒', text: (r.x ?? '').split(',').filter(Boolean).map(s => { const [k, key] = s.split(':'); return `${ITEM_KIND[k] ?? ''} ${itemName(k, key)}` }).join(', ') + ' 구매' }
    case 'revoke': return { icon: '📦', text: (r.x ?? '').split(',').filter(Boolean).map(s => { if (s === 'pass2x') return '투표 2배권'; if (s === 'passFake') return '페이크 선물 패스'; const [k, key] = s.split(':'); return `${ITEM_KIND[k] ?? ''} ${itemName(k, key)}` }).join(', ') + ' 관리자가 수거' }
    case 'pass': return { icon: r.x === 'passFake' ? '🤡' : r.x === 'passSpeed' ? '🚀' : '×2', text: (r.x === 'passFake' ? '페이크 선물 패스' : r.x === 'passSpeed' ? '최대속도 3배 패스' : '투표 2배권') + ' 구매' }
    case 'grant': return { icon: '🛠️', text: r.d > 0 ? '관리자가 지급' : '관리자가 회수' }
    case 'season': return { icon: '🏆', text: '시즌 보상' }
    case 'app': return { icon: '📱', text: '앱 설치 보너스' }
    case 'marketBuy': case 'marketSell': case 'marketList': case 'marketCancel': {
      const [item, who] = (r.x ?? '').split('|'), [k, key] = item.split(':')
      const label = key ? `${itemName(k, key)} ${ITEM_KIND[k] ?? ''}`.trim() : '아이템'
      if (r.k === 'marketBuy') return { icon: '🥕', text: `당근마켓에서 ${label} 구매${who && nameOf(who) ? ` · ${nameOf(who)}님` : ''}` }
      if (r.k === 'marketSell') return { icon: '🥕', text: `당근마켓에서 ${label} 판매${who && nameOf(who) ? ` · ${nameOf(who)}님` : ''}` }
      if (r.k === 'marketList') return { icon: '🥕', text: `${label} 당근마켓에 올림${who ? ` · ${Number(who).toLocaleString()}P` : ''}` }
      return { icon: '🥕', text: `${label} 판매 내림 · 돌려받음` }
    }
    case 'bet': return { icon: '🎰', text: '몰래 도박장 배팅' }
    case 'betWin': return { icon: '💰', text: '몰래 도박장 2배 당첨' }
    case 'coinBuy': return { icon: '🪙', text: '코인·주식 구매' }
    case 'coinSell': return { icon: '🪙', text: '코인·주식 판매' }
    case 'coinRefund': return { icon: '↩️', text: '코인 환불 · 실제 시세로 바뀌어서 돌려받았어요' }
    default: return { icon: '•', text: '포인트 변동' }
  }
}
