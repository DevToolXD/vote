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

const CARROT = '#ff6f0f'
const handle = <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />

type Mine = { id: string; owned: Record<ItemKind, string[]>; pass2x?: boolean | number; passFake?: boolean }
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
const hasItem = (me: Mine | undefined, kind: TradeKind, key: string) => !!me && (kind === 'pass' ? !!me[key as 'pass2x' | 'passFake'] : me.owned[kind].includes(key))

/** 🥕 당근마켓: everyone's listings, 사기 / 내리기, and 팔기 (pick something of mine, set a price). */
export function MarketView({ loggedIn, rows, me, byId, points, onLogin, onBuy, onList, onCancel, carrot = false, sellOpen, onSellClose }: Props & { carrot?: boolean; sellOpen?: boolean; onSellClose?: () => void }) {
  const [sellLocal, setSellLocal] = useState(false)
  const sell = sellOpen ?? sellLocal
  const setSell = (v: boolean) => { setSellLocal(v); if (!v) onSellClose?.() }
  const [mineOnly, setMineOnly] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // the intro can be closed for good (✕)
  const [intro, setIntro] = useState(() => { try { return localStorage.getItem('market-intro-off') !== '1' } catch { return true } })
  const closeIntro = () => { setIntro(false); try { localStorage.setItem('market-intro-off', '1') } catch { /* private mode */ } }
  // a seller who deleted their account can't be paid: hide those
  const live = rows.filter(l => byId.has(l.seller) && (!mineOnly || l.seller === me?.id))
  const act = async (id: string, f: () => Promise<void>) => { setBusy(id); try { await f() } finally { setBusy(null) } }

  return (
    <div style={css(carrot ? 'padding:0 16px 24px;display:flex;flex-direction:column;gap:12px;background:#ffffff' : 'padding:0 24px 32px;display:flex;flex-direction:column;gap:12px')}>
      {!carrot && <div style={css('position:relative;border-radius:18px;padding:16px;background:linear-gradient(135deg,#fff4ea,#ffe3cc);display:flex;align-items:center;gap:12px')}>
        <span aria-hidden="true" style={css('font-size:34px')}>🥕</span>
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
          <span style={css('font-size:17px;font-weight:800;color:#7a3300')}>당근마켓</span>
          {intro && <span style={css('font-size:13px;line-height:18px;color:#9a5a2a;padding-right:8px')}>내가 가진 아이템을 원하는 가격에 팔아요. 세트 아이템도 하나씩 따로 팔 수 있어요. 올려둔 동안엔 보관함에서 빠져요</span>}
        </span>
        {intro && <button className="pr-dim" onClick={closeIntro} aria-label="안내 닫기" style={css('position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:9999px;color:#b07a52;font-size:13px;display:flex;align-items:center;justify-content:center')}>✕</button>}
        <button data-g="primary" className="pr-96" onClick={loggedIn ? () => setSell(true) : onLogin} style={sx('flex:none;height:40px;padding:0 16px;border-radius:12px;color:#fff;font-size:15px;font-weight:800', { background: CARROT })}>{loggedIn ? '팔기' : '로그인'}</button>
      </div>}

      <div style={css('display:flex;gap:6px')}>
        {([[false, '전체'], [true, '내 판매글']] as [boolean, string][]).map(([v, l]) => (
          <button key={l} className="pr-96" onClick={() => setMineOnly(v)} style={sx('height:32px;padding:0 12px;border-radius:9999px;font-size:14px;font-weight:700', mineOnly === v ? { background: '#191f28', color: '#fff' } : { background: '#f2f4f6', color: '#4e5968' })}>{l}</button>
        ))}
      </div>

      {live.length === 0 && <div style={css('padding:40px 0;text-align:center;font-size:15px;color:#8b95a1')}>{mineOnly ? '올린 판매글이 없어요' : '아직 올라온 물건이 없어요'}</div>}
      {live.map(l => {
        const seller = byId.get(l.seller)!, mine = l.seller === me?.id, have = hasItem(me, l.kind, l.key), short = points < l.price
        return (
          <div key={l.id} data-g="l1" style={css(carrot ? 'padding:12px 0;border-bottom:0.5px solid #e5e5ea;display:flex;align-items:center;gap:12px' : 'border-radius:18px;padding:14px;background:#f9fafb;display:flex;align-items:center;gap:12px')}>
            <span style={css(carrot ? 'width:84px;height:84px;flex:none;border-radius:16px;background:#fff4ea;display:flex;align-items:center;justify-content:center;overflow:hidden' : 'width:56px;height:56px;flex:none;border-radius:14px;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:visible')}><GiftThumb kind={l.kind} k={l.key} /></span>
            <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
              <span style={css('font-size:16px;line-height:22px;font-weight:700;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{itemLabel(l.kind, l.key)}</span>
              <span style={css('display:flex;align-items:center;gap:6px;font-size:13px;color:#8b95a1;min-width:0')}>
                <Avatar frame={seller.frame} photo={seller.photoCss} size={16} />
                <span style={css('white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{mine ? '내 판매글' : seller.name}</span>
                {l.createdAt && <span style={css('flex:none')}>· {ago(l.createdAt.toMillis())}</span>}
              </span>
              <span style={sx('font-size:17px;font-weight:800;font-variant-numeric:tabular-nums', { color: CARROT })}>{shortPoints(l.price)}P</span>
            </span>
            {mine ? (
              <button data-g="secondary" className="pr-96" disabled={busy === l.id} onClick={() => act(l.id, () => onCancel(l))} style={css('flex:none;height:36px;padding:0 12px;border-radius:10px;background:#f2f4f6;color:#4e5968;font-size:14px;font-weight:700')}>내리기</button>
            ) : have ? (
              <span style={css('flex:none;height:36px;padding:0 12px;border-radius:10px;background:#e8f3ff;color:#1b64da;font-size:14px;font-weight:700;display:flex;align-items:center')}>보유중</span>
            ) : (
              <button data-g="primary" className="pr-96" disabled={busy === l.id || !loggedIn || short} onClick={() => act(l.id, () => onBuy(l))} style={sx('flex:none;height:36px;padding:0 14px;border-radius:10px;color:#fff;font-size:14px;font-weight:800;transition:opacity 200ms', { background: CARROT, opacity: !loggedIn || short ? 0.4 : 1 })}>{short && loggedIn ? '포인트 부족' : '사기'}</button>
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
              <button key={k + key} className="pr-96" onClick={() => setPick([k, key])} style={sx('height:96px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:6px', on ? { background: '#fff4ea', boxShadow: `inset 0 0 0 2px ${CARROT}` } : { background: '#f9fafb' })}>
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
          style={sx('height:56px;border-radius:16px;color:#fff;font-size:17px;font-weight:800;transition:opacity 200ms', { background: CARROT, opacity: ok ? 1 : 0.4 })}>
          {pick ? `${itemLabel(pick[0], pick[1])} ${n ? shortPoints(n) + 'P에 ' : ''}올리기` : '팔 아이템을 골라요'}
        </button>
      </div>
    </BottomSheet>
  )
}

/** 당근마켓 as its own app: the orange title bar, the list of things for sale, and 팔기 at the bottom. */
export function MarketApp(props: Props) {
  const [sell, setSell] = useState(false)
  return (
    <div style={css('position:relative;min-height:100%;display:flex;flex-direction:column;background:#ffffff;color:#000')}>
      <div style={css('position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;background:#ffffff;box-shadow:0 0.5px 0 #e5e5ea')}>
        <span style={css('display:flex;align-items:center;gap:8px;font-size:22px;font-weight:800;color:#ff6f0f')}>🥕 당근마켓</span>
        <span style={css('font-size:14px;color:#8e8e93;font-variant-numeric:tabular-nums')}>{props.points.toLocaleString()}P</span>
      </div>
      <MarketView {...props} carrot sellOpen={sell} onSellClose={() => setSell(false)} />
      {props.loggedIn && (
        <div style={css('position:sticky;bottom:12px;display:flex;justify-content:flex-end;padding:0 16px 16px;pointer-events:none')}>
          <button className="pr-96" onClick={() => setSell(true)} style={css('pointer-events:auto;height:48px;padding:0 18px;border-radius:24px;background:#ff6f0f;color:#fff;font-size:16px;font-weight:700;box-shadow:0 8px 20px rgba(255,111,15,0.35);display:flex;align-items:center;gap:6px')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M8 2v12M2 8h12" /></svg>
            팔기
          </button>
        </div>
      )}
    </div>
  )
}
