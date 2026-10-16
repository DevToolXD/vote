import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { css, sx } from '../css'
import { db } from '../firebase'
import { describe, entriesOf, itemName, ITEM_KIND, type LedgerKind, type LedgerRow } from '../backend/ledger'
import { thumbOf } from '../backend/songs'
import { BottomSheet } from './Overlays'
import { shortPoints } from './PointsChip'

const EASE = 'cubic-bezier(0.22,1,0.36,1)'

/** One stop of the money's way: a person, a place (a photo, a song, the shop…) or the account itself. */
type Node = { icon: string; label: string; sub?: string; uid?: string; tone?: 'me' | 'sys'; ref?: string }
type Step = { nodes: Node[]; note?: string }
/** Which of the other person's lines matches this one (so the admin lands on it when following the money). */
export const COUNTER: Partial<Record<LedgerKind, LedgerKind[]>> = {
  giftSent: ['giftClaim', 'giftCancel'], giftClaim: ['giftSent'], giftItemSent: ['giftItemClaim'], giftItemClaim: ['giftItemSent'],
  marketBuy: ['marketSell'], marketSell: ['marketBuy'],
}

const KIND_NAME: Record<LedgerKind, string> = {
  vote: '투표 보상', giftSent: '포인트 선물', giftClaim: '선물 받기', giftCancel: '선물 취소', buy: '상점 구매', pass: '패스 구매', grant: '관리자',
  season: '시즌 보상', app: '앱 설치 보너스', revoke: '아이템 수거', giftItemSent: '아이템 선물', giftItemClaim: '아이템 선물 받기', bet: '몰래 도박장', betWin: '몰래 도박장',
  marketBuy: '당근마켓 구매', marketSell: '당근마켓 판매', marketList: '당근마켓 등록', marketCancel: '당근마켓 내림', coinBuy: '코인·주식 구매', coinSell: '코인·주식 판매',
  coinRefund: '코인 환불', heart: '하트 보상', song: '음악 보상', other: '기타',
}

function stepsOf(r: LedgerRow, me: Node, nameOf: (id: string) => string): Step[] {
  const person = (uid: string, icon = '👤'): Node => ({ icon, label: nameOf(uid) || '탈퇴한 사람', uid })
  const sys = (icon: string, label: string, sub?: string): Node => ({ icon, label, sub, tone: 'sys' })
  const uniq = (a: string[]) => [...new Set(a.filter(Boolean))]
  const es = entriesOf(r.x), who = uniq(es.map(e => e.parts[e.parts.length - 1] ?? ''))
  const gain = r.d > 0
  switch (r.k) {
    case 'heart': {
      const posts = uniq(es.map(e => e.parts[0]))
      return [{ nodes: who.map(u => person(u, '❤️')) }, { nodes: posts.map(p => ({ icon: p.startsWith('homework') ? '📄' : '📸', label: p.startsWith('homework') ? '문서' : '인스타그램 사진', ref: p })), note: '하트 1개 = 3P' }, { nodes: [me], note: `+${r.d}P` }]
    }
    case 'song': {
      const songs = uniq(es.map(e => e.parts[0]))
      return [{ nodes: who.map(u => person(u, '🎧')) }, { nodes: songs.map(v => ({ icon: '🎵', label: '노래', ref: 'song/' + v })), note: '1분 = 6P' }, { nodes: [me], note: `+${r.d}P` }]
    }
    case 'vote':
      return gain
        ? [{ nodes: who.length ? who.map(u => person(u, '🗳️')) : [sys('🗳️', '투표한 사람들', '한 표에 10P')] }, { nodes: [me], note: `+${r.d}P` }]
        : [{ nodes: [me] }]
    case 'giftSent': return [{ nodes: [me] }, { nodes: [sys('🎁', '선물함', '받을 때까지 맡겨져요')], note: `${r.d}P` }, ...(r.x && nameOf(r.x) ? [{ nodes: [person(r.x)], note: '받으면 이 사람에게' }] : [])]
    case 'giftClaim': return [...(r.x ? [{ nodes: [person(r.x)] }] : []), { nodes: [sys('🎁', '선물함')], note: '받았어요' }, { nodes: [me], note: `+${r.d}P` }]
    case 'giftCancel': return [{ nodes: [sys('🎁', '선물함', '받는 사람이 받지 않았어요')] }, { nodes: [me], note: `+${r.d}P` }]
    case 'giftItemSent': case 'giftItemClaim': {
      const [item, other] = (r.x ?? '').split('|'), [k, key] = item.split(':')
      const thing = sys('🛍️', `${itemName(k, key)} ${ITEM_KIND[k] ?? ''}`.trim())
      return r.k === 'giftItemSent' ? [{ nodes: [me] }, { nodes: [thing] }, ...(other ? [{ nodes: [person(other)] }] : [])] : [...(other ? [{ nodes: [person(other)] }] : []), { nodes: [thing] }, { nodes: [me] }]
    }
    case 'marketBuy': case 'marketSell': {
      const [item, other] = (r.x ?? '').split('|'), [k, key] = item.split(':')
      const thing = sys('🥕', key ? `${itemName(k, key)} ${ITEM_KIND[k] ?? ''}`.trim() : '아이템', '당근마켓')
      return r.k === 'marketBuy' ? [{ nodes: [me], note: `${r.d}P` }, { nodes: [thing] }, ...(other ? [{ nodes: [person(other)], note: '판 사람' }] : [])] : [...(other ? [{ nodes: [person(other)], note: '산 사람' }] : []), { nodes: [thing], note: `+${r.d}P` }, { nodes: [me] }]
    }
    case 'buy': case 'pass': return [{ nodes: [me], note: `${r.d}P` }, { nodes: [sys('🛒', '상점', '쓴 포인트는 사라져요')] }]
    case 'grant': return [{ nodes: [sys('🛠️', '관리자')] }, { nodes: [me], note: `${gain ? '+' : ''}${r.d}P` }]
    case 'season': return [{ nodes: [sys('🏆', '시즌 보상', '시즌이 끝나면 나눠줘요')] }, { nodes: [me], note: `+${r.d}P` }]
    case 'app': return [{ nodes: [sys('📱', '앱 설치 보너스')] }, { nodes: [me], note: `+${r.d}P` }]
    case 'bet': case 'betWin': return gain ? [{ nodes: [sys('🎰', '몰래 도박장')] }, { nodes: [me], note: `+${r.d}P` }] : [{ nodes: [me], note: `${r.d}P` }, { nodes: [sys('🎰', '몰래 도박장')] }]
    case 'coinBuy': case 'coinSell': case 'coinRefund': return gain ? [{ nodes: [sys('🪙', '코인·주식')] }, { nodes: [me], note: `+${r.d}P` }] : [{ nodes: [me], note: `${r.d}P` }, { nodes: [sys('🪙', '코인·주식')] }]
    default: return [{ nodes: [me] }]
  }
}

/** Title and picture of the photos and songs a line points at (read once when the detail opens). */
function useRefs(steps: Step[]) {
  const [info, setInfo] = useState<Record<string, { label: string; sub?: string; src?: string }>>({})
  const key = steps.flatMap(s => s.nodes.map(n => n.ref ?? '')).filter(Boolean).join(',')
  useEffect(() => {
    if (!db || !key) return
    let dead = false
    for (const ref of key.split(',')) {
      if (ref.startsWith('song/')) {
        const vid = ref.slice(5)
        getDoc(doc(db, 'songs', vid)).then(s => { if (!dead) setInfo(i => ({ ...i, [ref]: { label: s.exists() ? s.get('title') : '지워진 노래', src: thumbOf(vid) } })) }).catch(() => {})
      } else {
        getDoc(doc(db, ref)).then(s => {
          if (dead) return
          const photo = s.get('photo'), text = (s.get('caption') || s.get('title') || '').toString().slice(0, 40)
          setInfo(i => ({ ...i, [ref]: s.exists() ? { label: text || (ref.startsWith('homework') ? '문서' : '사진'), src: typeof photo === 'string' && photo.startsWith('data:image') ? photo : undefined } : { label: '지워진 게시물' } }))
        }).catch(() => {})
      }
    }
    return () => { dead = true }
  }, [key])
  return info
}

const fullWhen = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

/** One line of 거래 내역 opened up: what it was, and the way the points went (from whom, through what, to whom). */
export function TraceSheet({ r, ownerName, nameOf, canTrace, onPerson, onClose }: {
  r: LedgerRow; ownerName: string; nameOf: (id: string) => string; canTrace: boolean
  onPerson: (uid: string, focus: { at: number; kinds: LedgerKind[] }) => void; onClose: () => void
}) {
  const { icon, text, sub } = describe(r, nameOf)
  const me: Node = { icon: '🙋', label: ownerName, tone: 'me' }
  const steps = stepsOf(r, me, nameOf)
  const refs = useRefs(steps)
  const amount = r.k === 'revoke' ? '수거' : r.k === 'giftItemClaim' ? '받음' : (r.d > 0 ? '+' : r.d < 0 ? '−' : '') + Math.abs(r.d).toLocaleString() + 'P'
  const facts: [string, string][] = [['시각', fullWhen(r.at)], ['종류', KIND_NAME[r.k] ?? '기타']]
  if (r.n && r.n > 1) facts.push([r.k === 'song' ? '들은 시간' : '개수', `${r.n}${r.k === 'song' ? '분' : '개'}`])
  if (r.b != null) facts.push(['이 거래 뒤 포인트', r.b.toLocaleString() + 'P'])
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(16px + env(safe-area-inset-bottom));animation:sheetUp 380ms ${EASE} both`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 4px;display:flex;align-items:center;gap:14px')}>
        <span style={css('width:52px;height:52px;flex:none;border-radius:9999px;background:#f2f4f6;display:flex;align-items:center;justify-content:center;font-size:24px')}>{icon}</span>
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
          <span style={css('font-size:17px;line-height:25px;font-weight:700;color:#191f28')}>{text}</span>
          {sub && <span style={css('font-size:13px;line-height:19px;color:#6b7684')}>{sub}</span>}
        </span>
        <span style={sx('flex:none;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums', { color: r.d > 0 ? '#1b64da' : r.d < 0 ? '#f04452' : '#8b95a1' })}>{amount}</span>
      </div>
      <div style={css('padding:12px 24px 0;display:flex;flex-direction:column')}>
        {facts.map(([k, v]) => (
          <span key={k} style={css('display:flex;justify-content:space-between;gap:12px;padding:7px 0;font-size:14px;line-height:20px')}>
            <span style={css('color:#8b95a1')}>{k}</span><span style={css('color:#333d4b;font-weight:600;text-align:right')}>{v}</span>
          </span>
        ))}
      </div>
      <div style={css('margin:12px 24px 0;height:1px;background:#f2f4f6')} />
      <div style={css('padding:16px 24px 4px;font-size:15px;font-weight:700;color:#191f28')}>포인트가 간 길</div>
      <div style={css('padding:0 24px;display:flex;flex-direction:column')}>
        {steps.map((st, i) => (
          <div key={i} style={css('display:flex;flex-direction:column')}>
            {i > 0 && (
              <span style={css('display:flex;align-items:center;gap:8px;padding:4px 0 4px 19px;color:#b0b8c1;font-size:12px;font-weight:600')}>
                <span style={css('width:2px;height:18px;border-radius:1px;background:#d1d6db')} />↓ {st.note ?? steps[i - 1].note ?? ''}
              </span>
            )}
            <span style={css('display:flex;flex-direction:column;gap:6px')}>
              {st.nodes.map((n, j) => {
                const ri = n.ref ? refs[n.ref] : undefined
                const label = ri?.label ?? n.label, tappable = canTrace && !!n.uid
                const body = (
                  <>
                    {ri?.src
                      ? <span style={sx('width:40px;height:40px;flex:none;border-radius:10px;background:#f2f4f6 center/cover no-repeat', { backgroundImage: `url("${ri.src}")` })} />
                      : <span style={sx('width:40px;height:40px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:18px', { background: n.tone === 'me' ? '#e8f3ff' : '#f2f4f6' })}>{n.icon}</span>}
                    <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;text-align:left')}>
                      <span style={css('font-size:15px;line-height:22px;font-weight:600;color:#191f28;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{label}{n.tone === 'me' ? ' (이 계정)' : ''}</span>
                      {n.sub && <span style={css('font-size:12px;line-height:17px;color:#8b95a1')}>{n.sub}</span>}
                    </span>
                    {tappable && <span style={css('flex:none;font-size:12px;font-weight:600;color:#3182f6')}>거래 내역 ›</span>}
                  </>
                )
                const style = sx('display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:14px;width:100%', { background: n.tone === 'me' ? '#f2f8ff' : '#f9fafb' })
                return tappable
                  ? <button key={j} className="pr-96" onClick={() => onPerson(n.uid!, { at: r.at, kinds: COUNTER[r.k] ?? [] })} style={style}>{body}</button>
                  : <span key={j} style={style}>{body}</span>
              })}
            </span>
          </div>
        ))}
      </div>
      {canTrace && steps.some(s => s.nodes.some(n => n.uid)) && <div style={css('padding:12px 24px 0;font-size:12px;line-height:18px;color:#8b95a1')}>사람을 누르면 그 사람의 거래 내역이 열려요. 선물·마켓은 서로 짝이 되는 줄이 파랗게 표시돼요 · {shortPoints(Math.abs(r.d))}P가 어디로 갔는지 따라갈 수 있어요</div>}
    </BottomSheet>
  )
}
