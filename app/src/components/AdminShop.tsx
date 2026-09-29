import { useState } from 'react'
import { createPortal } from 'react-dom'
import { css, sx } from '../css'
import { FRAMES, SKINS, isBundled, isLimited, priceOf, skinGeom, type ItemKind } from '../data'
import type { PassKind } from '../backend/types'
import { Segmented } from './AccountScreen'
import { Avatar } from './Avatar'
import { Nameplate } from './Nameplate'
import { PASSES } from './ShopScreen'
import { TowerSkin } from './TowerSkin'

type Props = {
  name: string
  photoCss: string
  equipped: Record<ItemKind, string>
  owned: Record<ItemKind, string[]>
  passes: Record<PassKind, boolean>
  points: number
  /** Owned → put it on; not owned → buy it on its own at its price (리미티드 and set pieces too). */
  onPick: (kind: ItemKind, key: string, label: string) => void
  onBuyPass: (kind: PassKind) => void
  onClose: () => void
}
type Tab = ItemKind | 'pass'
const GOLD = '#e6b54a'

/**
 * 관리자샵 (admins only; opened from a chat — see App): everything the shop ever sold, one by
 * one at its price, 리미티드 and set pieces included.
 */
export function AdminShop({ name, photoCss, equipped, owned, passes, points, onPick, onBuyPass, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('frame')
  const tag = (kind: ItemKind, k: string) => isLimited(kind, k) ? 'LIMITED' : isBundled(kind, k) ? '세트 구성품' : null
  const badge = (t: string | null) => t && <span style={css(`position:absolute;top:-7px;left:50%;transform:translateX(-50%);z-index:3;height:18px;padding:0 8px;border-radius:9999px;background:#1a1a1a;color:${GOLD};font-size:10px;font-weight:800;letter-spacing:0.4px;display:flex;align-items:center;white-space:nowrap`)}>{t}</span>
  const state = (kind: ItemKind, k: string) => equipped[kind] === k
    ? <span style={css('font-size:12px;font-weight:800;color:#3182f6')}>착용중</span>
    : owned[kind].includes(k)
      ? <span style={css('font-size:12px;font-weight:700;color:#8b95a1')}>보유</span>
      : <span style={css(`font-size:12px;font-weight:800;color:${GOLD};font-variant-numeric:tabular-nums`)}>{priceOf(kind, k).toLocaleString()}P</span>
  const cell = 'position:relative;border-radius:16px;background:#1d1a14;box-shadow:inset 0 0 0 1px rgba(230,181,74,0.25);display:flex;flex-direction:column;align-items:center;gap:8px'

  return createPortal(
    <div style={css('position:fixed;inset:0;z-index:280;display:flex;justify-content:center;background:rgba(0,0,0,0.5);animation:fade 200ms ease both')}>
      <div style={css('width:100%;max-width:var(--app-w);height:100%;overflow-y:auto;background:linear-gradient(180deg,#14110b 0%,#0b0a07 100%);color:#fff;animation:sheetUp 420ms cubic-bezier(0.22,1,0.36,1) both')}>
        <div style={css('position:sticky;top:0;z-index:5;padding:0 8px;height:56px;display:flex;align-items:center;background:#14110b')}>
          <button className="pr-dim" onClick={onClose} aria-label="닫기" style={css('width:44px;height:44px;border-radius:12px;color:#fff;font-size:20px')}>✕</button>
          <span style={css(`flex:1;font-size:18px;font-weight:800;color:${GOLD}`)}>👑 관리자샵</span>
          <span style={css(`padding:0 12px;font-size:16px;font-weight:800;color:${GOLD};font-variant-numeric:tabular-nums`)}>{points.toLocaleString()}P</span>
        </div>
        <div style={css('padding:4px 24px 12px;font-size:13px;line-height:19px;color:rgba(255,255,255,0.55)')}>관리자만 들어올 수 있어요. 역대 모든 아이템을 하나씩 살 수 있어요 · 리미티드, 세트 구성품 포함</div>
        <div style={css('position:sticky;top:56px;z-index:4;padding:0 24px 14px;background:#14110b')}>
          <Segmented<Tab> options={['frame', 'plate', 'skin', 'pass']} labels={['프레임', '이름표', '막대 스킨', '패스']} value={tab} onPick={setTab} />
        </div>

        {tab === 'frame' && (
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;padding:8px 24px 32px')}>
            {FRAMES.filter(([k]) => k !== 'none').map(([k, l]) => (
              <button key={k} className="pr-96" onClick={() => onPick('frame', k, l)} style={css(cell + ';padding:20px 0 12px')}>
                {badge(tag('frame', k))}
                <span style={css('width:48px;height:48px')}><Avatar frame={k} photo={photoCss} size={48} /></span>
                <span style={css('font-size:13px;font-weight:700')}>{l}</span>
                {state('frame', k)}
              </button>
            ))}
          </div>
        )}
        {tab === 'plate' && (
          <div style={css('display:flex;flex-direction:column;gap:10px;padding:8px 24px 32px')}>
            {FRAMES.filter(([k]) => k !== 'none').map(([k, l]) => (
              <button key={k} className="pr-98" onClick={() => onPick('plate', k, l + ' 이름표')} style={css('position:relative;display:flex;align-items:center;gap:10px;padding:6px 12px 6px 6px;border-radius:18px;background:#1d1a14;box-shadow:inset 0 0 0 1px rgba(230,181,74,0.25)')}>
                <span style={css('flex:1;min-width:0;height:52px')}><Nameplate kind={k} person={name} sub={l + ' 이름표'} frame={equipped.frame} photo={photoCss} style={{ width: '100%', height: 52 }} /></span>
                <span style={css('flex:none;min-width:64px;display:flex;flex-direction:column;align-items:flex-end;gap:2px')}>
                  {tag('plate', k) && <span style={css(`font-size:10px;font-weight:800;color:${GOLD}`)}>{tag('plate', k)}</span>}
                  {state('plate', k)}
                </span>
              </button>
            ))}
          </div>
        )}
        {tab === 'skin' && (
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;padding:8px 24px 32px')}>
            {SKINS.filter(([k]) => k !== 'none').map(([k, l]) => {
              const g = skinGeom(k, 120, false)
              return (
                <button key={k} className="pr-96" onClick={() => onPick('skin', k, l)} style={css(cell + ';height:196px;padding:12px 0;justify-content:flex-end')}>
                  {badge(tag('skin', k))}
                  <span style={css('position:relative;width:30px;height:120px;flex:none')}>{g && <TowerSkin g={g} />}</span>
                  <span style={css('font-size:13px;font-weight:700')}>{l}</span>
                  {state('skin', k)}
                </button>
              )
            })}
          </div>
        )}
        {tab === 'pass' && (
          <div style={css('display:flex;flex-direction:column;gap:10px;padding:8px 24px 32px')}>
            {PASSES.map(x => (
              <div key={x.key} style={css('border-radius:18px;padding:14px;background:#1d1a14;box-shadow:inset 0 0 0 1px rgba(230,181,74,0.25);display:flex;align-items:center;gap:12px')}>
                <span style={sx('width:44px;height:44px;flex:none;border-radius:12px;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center', { background: x.bg })}>{x.icon}</span>
                <span style={css('flex:1;font-size:16px;font-weight:700')}>{x.title}</span>
                {passes[x.key]
                  ? <span style={css('font-size:13px;font-weight:700;color:#8b95a1')}>보유</span>
                  : <button className="pr-96" onClick={() => onBuyPass(x.key)} style={css(`height:34px;padding:0 12px;border-radius:10px;background:${GOLD};color:#1a1a1a;font-size:14px;font-weight:800`)}>{x.price.toLocaleString()}P</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.getElementById('overlay-root') ?? document.body,
  )
}
