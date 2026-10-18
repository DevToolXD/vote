import { useState } from 'react'
import { css, sx } from '../css'
import { FRAMES, SKINS, type ItemKind } from '../data'
import type { Person } from '../model'
import type { TradeKind } from '../backend/gifts'
import { itemLabel } from '../backend/gifts'
import { MAX_PRICE, type Listing } from '../backend/market'
import { Avatar } from './Avatar'
import { GiftThumb } from './MessagesScreen'
import { BottomSheet } from './Overlays'
import { PASSES } from './ShopScreen'
import { shortPoints } from './PointsChip'

const ACCENT = '#3182f6'
const handle = <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />

type Mine = { id: string; owned: Record<ItemKind, string[]>; pass2x?: boolean | number; passFake?: boolean; passSpeed?: boolean }
type Props = {
  loggedIn: boolean
  rows: Listing[]
  me?: Mine
  byId: Map<string, Person>
  points: number
  onLogin: () => void
  onBuy: (l: Listing) => Promise<void>
  onList: (kind: TradeKind, key: string, price: number) => Promise<void>
  onCancel: (l: Listing) => Promise<void>
}

const ago = (ms: number) => {
  const m = Math.floor((Date.now() - ms) / 60_000)
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`
}
const hasItem = (me: Mine | undefined, kind: TradeKind, key: string) => !!me && (kind === 'pass' ? !!me[key as 'pass2x' | 'passFake' | 'passSpeed'] : me.owned[kind].includes(key))

/** 🥕 당근마켓, inside 상점 and in its App Store look: a card to sell from, then everyone's listings as white cards (사기 / 내리기). */
export function MarketView({ loggedIn, rows, me, byId, points, onLogin, onBuy, onList, onCancel }: Props) {
  const [sell, setSell] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // a seller who deleted their account can't be paid: hide those
  const live = rows.filter(l => byId.has(l.seller) && (!mineOnly || l.seller === me?.id))
  const act = async (id: string, f: () => Promise<void>) => { setBusy(id); try { await f() } finally { setBusy(null) } }
  const card = 'background:#ffffff;border-radius:26px;box-shadow:0 1px 2px rgba(0,0,0,0.04)'

  return (
    <div className="anim-list" style={css('padding:0 16px 24px;display:flex;flex-direction:column;gap:12px')}>
      <div style={css(card + ';padding:16px 18px;display:flex;align-items:center;gap:14px')}>
        <span aria-hidden="true" style={css('width:56px;height:56px;flex:none;border-radius:16px;background:linear-gradient(135deg,#fff4ea,#ffe3cc);display:flex;align-items:center;justify-content:center;font-size:30px')}>🥕</span>
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px')}>
          <span style={css('font-size:17px;line-height:23px;font-weight:700;color:#1d1d1f')}>당근마켓</span>
          <span style={css('font-size:13px;line-height:18px;color:#6e6e73')}>가진 장신구를 원하는 가격에 사고팔아요. 올려둔 동안엔 보관함에서 빠져요</span>
        </span>
        <button data-g="primary" className="pr-96" onClick={loggedIn ? () => setSell(true) : onLogin} style={css('flex:none;height:32px;padding:0 15px;border-radius:9999px;background:#3182f6;color:#fff;font-size:14px;font-weight:700')}>{loggedIn ? '팔기' : '로그인'}</button>
      </div>

      <div style={css('display:flex;gap:8px')}>
        {([[false, '전체'], [true, '내 판매글']] as [boolean, string][]).map(([v, l]) => (
          <button key={l} className="pr-96" onClick={() => setMineOnly(v)} style={sx('height:34px;padding:0 14px;border-radius:9999px;font-size:14px;font-weight:600;white-space:nowrap;transition:background 250ms,color 250ms', mineOnly === v ? { background: '#1d1d1f', color: '#ffffff' } : { background: '#ffffff', color: '#1d1d1f' })}>{l}</button>
        ))}
      </div>

      {live.length === 0 && <div style={css(card + ';padding:36px 20px;text-align:center;font-size:15px;color:#8e8e93')}>{mineOnly ? '올린 판매글이 없어요' : '아직 올라온 물건이 없어요'}</div>}
      {live.map(l => {
        const seller = byId.get(l.seller)!, mine = l.seller === me?.id, have = hasItem(me, l.kind, l.key), short = points < l.price
        return (
          <div key={l.id} data-g="l1" style={css(card + ';padding:14px 16px;display:flex;align-items:center;gap:14px')}>
            <span style={css('width:60px;height:60px;flex:none;border-radius:16px;background:#f5f5f7;display:flex;align-items:center;justify-content:center;overflow:visible')}><GiftThumb kind={l.kind} k={l.key} /></span>
            <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
              <span style={css('font-size:16px;line-height:22px;font-weight:700;color:#1d1d1f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{itemLabel(l.kind, l.key)}</span>
              <span style={css('display:flex;align-items:center;gap:6px;font-size:13px;color:#8e8e93;min-width:0')}>
                <Avatar frame={seller.frame} photo={seller.photoCss} size={16} />
                <span style={css('white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{mine ? '내 판매글' : seller.name}</span>
                {l.createdAt && <span style={css('flex:none')}>· {ago(l.createdAt.toMillis())}</span>}
              </span>
              <span style={css('font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:#1d1d1f')}>{shortPoints(l.price)}P</span>
            </span>
            {mine ? (
              <button data-g="secondary" className="pr-96" disabled={busy === l.id} onClick={() => act(l.id, () => onCancel(l))} style={css('flex:none;height:32px;padding:0 14px;border-radius:9999px;background:#e8f1ff;color:#3182f6;font-size:14px;font-weight:700')}>내리기</button>
            ) : have ? (
              <span style={css('flex:none;height:32px;padding:0 14px;border-radius:9999px;background:#e8f1ff;color:#3182f6;font-size:14px;font-weight:700;display:flex;align-items:center')}>보유중</span>
            ) : (
              <button data-g="primary" className="pr-96" disabled={busy === l.id || !loggedIn || short} onClick={() => act(l.id, () => onBuy(l))} style={sx('flex:none;height:32px;padding:0 15px;border-radius:9999px;background:#3182f6;color:#fff;font-size:14px;font-weight:700;transition:opacity 200ms', { opacity: !loggedIn || short ? 0.4 : 1 })}>{short && loggedIn ? '포인트 부족' : '사기'}</button>
            )}
          </div>
        )
      })}

      {sell && me && <SellSheet me={me} onClose={() => setSell(false)} onList={async (k, key, price) => { await onList(k, key, price); setSell(false) }} />}
    </div>
  )
}

/** 팔기: one of my items (not 기본) or passes, and a price. */
function SellSheet({ me, onClose, onList }: { me: Mine; onClose: () => void; onList: (kind: TradeKind, key: string, price: number) => Promise<void> }) {
  const items: [TradeKind, string][] = [
    ...me.owned.frame.filter(k => k !== 'none').map(k => ['frame', k] as [TradeKind, string]),
    ...me.owned.plate.filter(k => k !== 'none').map(k => ['plate', k] as [TradeKind, string]),
    ...me.owned.skin.filter(k => k !== 'none').map(k => ['skin', k] as [TradeKind, string]),
    ...PASSES.filter(p => !!me[p.key]).map(p => ['pass', p.key] as [TradeKind, string]),
  ]
  const [pick, setPick] = useState<[TradeKind, string] | null>(null)
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const n = Number(price)
  const ok = !!pick && Number.isSafeInteger(n) && n >= 1 && n <= MAX_PRICE && !busy
  // keep FRAMES / SKINS order
  const order = (k: TradeKind, key: string) => (k === 'pass' ? 900 : (k === 'skin' ? SKINS : FRAMES).findIndex(([x]) => x === key) + (k === 'plate' ? 300 : k === 'skin' ? 600 : 0))
  items.sort((a, b) => order(...a) - order(...b))
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.25)" sheetStyle="border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms cubic-bezier(0.22,1,0.36,1) both;max-height:88vh;overflow-y:auto">
      {handle}
      <div style={css('padding:18px 24px 12px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>🥕 뭘 팔까요?</span>
        <span style={css('font-size:14px;line-height:21px;color:#6b7684')}>팔리면 그 가격만큼 포인트가 들어와요. 끼고 있던 건 벗겨져요</span>
      </div>
      {items.length === 0 ? (
        <div style={css('padding:24px;text-align:center;font-size:15px;color:#8b95a1')}>팔 수 있는 아이템이 없어요</div>
      ) : (
        <div style={css('padding:0 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px')}>
          {items.map(([k, key]) => {
            const on = pick?.[0] === k && pick?.[1] === key
            return (
              <button key={k + key} className="pr-96" onClick={() => setPick([k, key])} style={sx('height:96px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:6px', on ? { background: '#e8f1ff', boxShadow: `inset 0 0 0 2px ${ACCENT}` } : { background: '#f9fafb' })}>
                <GiftThumb kind={k} k={key} />
                <span style={css('font-size:12px;line-height:16px;font-weight:600;color:#4e5968;text-align:center;word-break:keep-all')}>{itemLabel(k, key)}</span>
              </button>
            )
          })}
        </div>
      )}
      <div style={css('padding:16px 24px 0;display:flex;flex-direction:column;gap:10px')}>
        <label style={css('height:56px;padding:0 16px;border-radius:16px;background:#f2f4f6;display:flex;align-items:center;gap:8px')}>
          <input inputMode="numeric" placeholder="가격" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, '').slice(0, 13))} style={css('flex:1;min-width:0;height:100%;background:transparent;border:none;outline:none;font-size:18px;font-weight:700;color:#191f28;font-variant-numeric:tabular-nums')} />
          <span style={css('font-size:17px;font-weight:700;color:#8b95a1')}>P</span>
        </label>
        <button data-g="primary" className="pr-96" disabled={!ok} onClick={async () => { if (!ok || !pick) return; setBusy(true); try { await onList(pick[0], pick[1], n) } finally { setBusy(false) } }}
          style={sx('height:56px;border-radius:16px;color:#fff;font-size:17px;font-weight:800;transition:opacity 200ms', { background: ACCENT, opacity: ok ? 1 : 0.4 })}>
          {pick ? `${itemLabel(pick[0], pick[1])} ${n ? shortPoints(n) + 'P에 ' : ''}올리기` : '팔 아이템을 골라요'}
        </button>
      </div>
    </BottomSheet>
  )
}
