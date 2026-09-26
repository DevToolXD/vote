import { css, sx } from '../css'
import { FRAMES, SKINS, priceOf, skinGeom, type ItemKind } from '../data'
import { PASS_PRICE } from '../backend/types'
import { Segmented } from './AccountScreen'
import { Avatar } from './Avatar'
import { LockIcon } from './icons'
import { Nameplate } from './Nameplate'
import { PointsChip } from './PointsChip'
import { TowerSkin } from './TowerSkin'

export type ShopTab = ItemKind | 'pass'

type Props = {
  loggedIn: boolean
  name: string
  bio: string
  photoCss: string
  equipped: Record<ItemKind, string>
  owned: Record<ItemKind, string[]>
  points: number
  tab: ShopTab
  onTab: (t: ShopTab) => void
  /** Equips an owned item or opens the purchase dialog for a locked one. */
  onPick: (kind: ItemKind, key: string, label: string) => void
  /** 투표 2배권: active for the current season? */
  passActive: boolean
  onBuyPass: () => void
  onLogin: () => void
}

const check = (size: number, style: string) => (
  <span style={sx(`position:absolute;z-index:3;border-radius:9999px;background:#3182f6;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;${style}`, { width: size, height: size })}>✓</span>
)
const tile = 'position:relative;border-radius:16px;display:flex;flex-direction:column;align-items:center'

export function CartIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3.5h2.2l2.4 11.2a1.8 1.8 0 0 0 1.8 1.4h8.6a1.8 1.8 0 0 0 1.7-1.3L21 8H6" />
      <circle cx="9.5" cy="20" r="1.5" fill="currentColor" stroke="none" /><circle cx="17.5" cy="20" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** 상점: frames, nameplates and bar skins bought with points, plus the 패스 (투표 2배권). */
export function ShopScreen({ loggedIn, name, bio, photoCss, equipped, owned, points, tab, onTab, onPick, passActive, onBuyPass, onLogin }: Props) {
  const item = (kind: ItemKind, k: string) => ({ on: equipped[kind] === k, locked: !owned[kind].includes(k), price: priceOf(kind, k) + 'P' })
  const priceTag = (price: string) => (
    <span style={css('position:absolute;top:8px;left:8px;z-index:3;height:20px;padding:0 7px;border-radius:9999px;background:#191f28;color:#ffffff;font-size:11px;font-weight:700;display:flex;align-items:center;gap:3px;font-variant-numeric:tabular-nums')}><LockIcon size={9} />{price}</span>
  )
  const tileColors = (on: boolean) => ({ background: on ? '#e8f3ff' : '#f9fafb', boxShadow: on ? 'inset 0 0 0 1.5px #3182f6' : 'none' })
  const tileFg = (on: boolean) => (on ? '#1b64da' : '#4e5968')

  return (
    <div data-g="clear" style={css('flex:1;background:#ffffff;padding-bottom:24px')}>
      <header data-g="head" style={css('position:sticky;top:0;z-index:20;height:56px;padding:0 16px 0 24px;display:flex;align-items:center;justify-content:space-between;background:#ffffff')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>상점</span>
        {loggedIn && <PointsChip points={points} />}
      </header>
      <div className="anim-list" style={css('padding:8px 24px 8px;display:flex;flex-direction:column;gap:12px')}>
        <div style={{ height: 60 }}>
          <Nameplate kind={equipped.plate} person={name} sub={bio || '내 이름표예요'} frame={equipped.frame} photo={photoCss} style={{ width: '100%', height: 60 }} />
        </div>
        <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>{loggedIn ? '받은 추천 1개가 1P예요. 산 아이템은 눌러서 바로 바꿔 낄 수 있어요' : '로그인하면 포인트로 아이템을 살 수 있어요'}</span>
      </div>
      <div style={css('position:sticky;top:56px;z-index:19;padding:8px 24px 16px;background:#ffffff')}>
        <Segmented<ShopTab> options={['frame', 'plate', 'skin', 'pass']} labels={['프레임', '이름표', '막대 스킨', '패스']} value={tab} onPick={onTab} />
      </div>

        {tab === 'frame' && (
          <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 24px 32px')}>
            {FRAMES.map(([k, l]) => {
              const it = item('frame', k)
              return (
                <button key={k} className="pr-96" onClick={() => onPick('frame', k, l)} style={sx(tile + ';padding:22px 0 12px;gap:12px;transition:transform 150ms,background 200ms,box-shadow 200ms', tileColors(it.on))}>
                  <span style={css('width:52px;height:52px')}><Avatar frame={k} photo={photoCss} size={52} /></span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: tileFg(it.on) }}>{l}</span>
                  {it.locked && priceTag(it.price)}
                  {it.on && check(20, 'top:8px;right:8px')}
                </button>
              )
            })}
          </div>
        )}

        {tab === 'plate' && (
          <div style={css('display:flex;flex-direction:column;gap:8px;padding:0 24px 32px')}>
            {FRAMES.map(([k, l]) => {
              const it = item('plate', k)
              return (
                <button key={k} className="pr-98" onClick={() => onPick('plate', k, l + ' 이름표')} aria-pressed={it.on} style={sx('position:relative;display:block;width:100%;height:60px;padding:2px;border-radius:17px;transition:transform 300ms cubic-bezier(0.34,1.4,0.64,1),box-shadow 200ms', { boxShadow: it.on ? '0 0 0 2px #3182f6' : 'none' })}>
                  <Nameplate kind={k} person={name} sub={l + ' 이름표'} frame={equipped.frame} photo={photoCss} style={{ width: '100%', height: 56 }} />
                  {it.locked && (
                    <span style={css('position:absolute;top:50%;right:14px;margin-top:-12px;z-index:3;height:24px;padding:0 9px;border-radius:9999px;background:#191f28;color:#ffffff;box-shadow:0 0 0 2px rgba(255,255,255,0.9);font-size:12px;font-weight:700;display:flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums')}><LockIcon size={10} />{it.price}</span>
                  )}
                  {it.on && check(22, 'top:50%;right:14px;margin-top:-11px;box-shadow:0 0 0 2px #ffffff')}
                </button>
              )
            })}
          </div>
        )}

        {tab === 'skin' && (
          <>
            <div style={css('padding:0 24px 8px;font-size:13px;line-height:19.5px;color:#6b7684')}>랭킹 그래프에서 내 막대가 이 모양으로 보여요. 마이너스면 거꾸로 뒤집혀요</div>
            <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 24px 32px')}>
              {SKINS.map(([k, l]) => {
                const it = item('skin', k), g = skinGeom(k, 132, false)
                return (
                  <button key={k} className="pr-97" onClick={() => onPick('skin', k, l)} aria-pressed={it.on} aria-label={`${l} 스킨`} style={sx(tile + ';height:200px;padding:12px 0 12px;justify-content:flex-end;gap:10px;transition:transform 300ms cubic-bezier(0.34,1.4,0.64,1),background 200ms,box-shadow 200ms', tileColors(it.on))}>
                    <span style={css('position:relative;width:32px;height:132px;flex:none')}>
                      {g ? <TowerSkin g={g} /> : <span style={css('position:absolute;left:2px;right:2px;bottom:0;height:86px;border:1.5px solid #191f28;border-radius:6px;background:#ffffff;box-sizing:border-box')} />}
                    </span>
                    <span style={css('width:44px;height:1px;background:#d1d6db;flex:none')} />
                    <span style={sx('font-size:13px;line-height:18px;font-weight:600;text-align:center;word-break:keep-all', { color: tileFg(it.on) })}>{l}</span>
                    {it.locked && priceTag(it.price)}
                    {it.on && check(20, 'top:8px;right:8px')}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {tab === 'pass' && (
          <div className="anim-list" style={css('padding:0 24px 32px;display:flex;flex-direction:column;gap:12px')}>
            <div data-g="l1" style={css('position:relative;overflow:hidden;border-radius:24px;padding:24px 20px 20px;background:linear-gradient(135deg,#1b64da,#6a3cf0);color:#ffffff;display:flex;flex-direction:column;gap:6px')}>
              <span aria-hidden="true" style={css('position:absolute;right:-18px;top:-22px;font-size:120px;line-height:1;font-weight:800;opacity:0.14')}>×2</span>
              <span style={css('align-self:flex-start;height:24px;padding:0 10px;border-radius:9999px;background:rgba(255,255,255,0.2);font-size:12px;font-weight:700;display:flex;align-items:center')}>이번 시즌 패스</span>
              <span style={css('margin-top:6px;font-size:24px;line-height:32px;font-weight:800')}>투표 2배권</span>
              <span style={css('font-size:15px;line-height:22.5px;opacity:0.9')}>한 사람에게 일주일에 두 번까지 투표할 수 있어요. 추천이나 비추천을 한 번 더 할 수 있어요</span>
              <span style={css('margin-top:10px;font-size:13px;line-height:19.5px;opacity:0.75')}>시즌이 끝나면 사라져요 · 다음 시즌에 다시 살 수 있어요</span>
            </div>
            {passActive ? (
              <div style={css('height:56px;border-radius:16px;background:#e8f3ff;color:#1b64da;font-size:17px;font-weight:700;display:flex;align-items:center;justify-content:center')}>✓ 이번 시즌 사용 중이에요</div>
            ) : (
              <button data-g="primary" className="pr-96" onClick={loggedIn ? onBuyPass : onLogin}
                style={css('height:56px;border-radius:16px;background:#3182f6;color:#ffffff;font-size:17px;font-weight:600;transition:transform 150ms')}>
                {loggedIn ? `${PASS_PRICE.toLocaleString()}P로 사기` : '로그인하고 사기'}
              </button>
            )}
            {loggedIn && !passActive && <span style={css('text-align:center;font-size:13px;color:#8b95a1')}>내 포인트 {points.toLocaleString()}P{points < PASS_PRICE ? ` · ${(PASS_PRICE - points).toLocaleString()}P 더 필요해요` : ''}</span>}
          </div>
        )}
    </div>
  )
}
