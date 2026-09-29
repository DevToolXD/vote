import type { ReactNode } from 'react'
import { css, sx } from '../css'
import { FRAMES, LEGENDARY, SKINS, isLimited, seriesItems, seriesMissing, seriesPrice, skinGeom, type ItemKind } from '../data'
import { FAKE_PASS_PRICE, PASS_PRICE, type PassKind } from '../backend/types'
import { Segmented } from './AccountScreen'
import { Avatar } from './Avatar'
import { BackIcon, LockIcon } from './icons'
import { Nameplate } from './Nameplate'
import { PointsChip } from './PointsChip'
import { TowerSkin } from './TowerSkin'

export type ShopTab = ItemKind | 'set' | 'pass' | 'inv' | 'market'

type Props = {
  loggedIn: boolean
  name: string
  bio: string
  photoCss: string
  equipped: Record<ItemKind, string>
  owned: Record<ItemKind, string[]>
  points: number
  onPoints: () => void
  tab: ShopTab
  onTab: (t: ShopTab) => void
  /** Equips an owned item or opens the purchase dialog for a locked one. */
  onPick: (kind: ItemKind, key: string, label: string) => void
  /** A whole 세트: buy what's missing, or put the whole series on if I have it. */
  onPickSet: (key: string) => void
  /** 투표 2배권: active for the current season? */
  passes: Record<PassKind, boolean>
  onBuyPass: (kind: PassKind) => void
  onLogin: () => void
  /** The 당근마켓 tab's content. */
  market?: ReactNode
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
/** Passes sold in the 패스 tab (each bought once and kept). */
export const PASSES: { key: PassKind; title: string; desc: string; icon: string; bg: string; price: number }[] = [
  { key: 'pass2x', title: '투표 2배권', desc: '한 사람에게 일주일에 두 번 투표', icon: '×2', bg: 'linear-gradient(135deg,#1b64da,#6a3cf0)', price: PASS_PRICE },
  { key: 'passFake', title: '페이크 선물 패스', desc: '채팅에서 페이크 선물을 보낼 수 있어요', icon: '🤡', bg: 'linear-gradient(135deg,#8b5cf6,#c026d3)', price: FAKE_PASS_PRICE },
]

export function ShopScreen({ loggedIn, name, bio, photoCss, equipped, owned, points, onPoints, tab, onTab, onPick, passes, onBuyPass, onLogin, market, onPickSet }: Props) {
  const item = (kind: ItemKind, k: string) => ({ on: equipped[kind] === k, locked: !owned[kind].includes(k), price: `세트 ${seriesMissing(k, owned).price.toLocaleString()}P` })
  // 악세사리 sells 세트 only: pieces are never sold one by one (보관함 lists them to wear; 당근마켓 trades them)
  const top = tab === 'pass' ? 'pass' : tab === 'market' ? 'market' : 'acc'
  const view: ShopTab = top === 'acc' && tab !== 'inv' ? 'set' : tab
  const priceTag = (price: string) => (
    <span style={css('position:absolute;top:8px;left:8px;z-index:3;height:20px;padding:0 7px;border-radius:9999px;background:#191f28;color:#ffffff;font-size:11px;font-weight:700;display:flex;align-items:center;gap:3px;font-variant-numeric:tabular-nums')}><LockIcon size={9} />{price}</span>
  )
  const tileColors = (on: boolean) => ({ background: on ? '#e8f3ff' : '#f9fafb', boxShadow: on ? 'inset 0 0 0 1.5px #3182f6' : 'none' })
  const tileFg = (on: boolean) => (on ? '#1b64da' : '#4e5968')
  // The 레전드 set gets a night-sky tile, a spinning spectrum edge and a tag.
  const legendTile = (on: boolean, k: string) => k === 'silver'
    ? { background: 'radial-gradient(120% 90% at 50% 100%,#2a2a2a 0%,#0a0a0a 55%,#000 100%)', boxShadow: on ? 'inset 0 0 0 2px #ffffff,0 6px 18px -6px rgba(220,228,245,0.7)' : 'inset 0 0 0 1px rgba(198,198,198,0.55),0 6px 18px -8px rgba(200,210,230,0.5)' }
    : k === 'korea'
    ? { background: 'linear-gradient(180deg,#fbf8f1 0%,#f3ede1 100%)', boxShadow: on ? 'inset 0 0 0 2px #1a1a1a,0 6px 16px -8px rgba(0,0,0,0.35)' : 'inset 0 0 0 1px rgba(26,26,26,0.16),0 6px 16px -10px rgba(0,0,0,0.3)' }
    : k === 'matrix'
    ? { background: 'radial-gradient(120% 90% at 50% 100%,#04351a 0%,#01140a 55%,#000 100%)', boxShadow: on ? 'inset 0 0 0 2px #eafff0,0 6px 18px -6px rgba(0,255,65,0.8)' : 'inset 0 0 0 1.5px rgba(0,255,65,0.6),0 6px 18px -8px rgba(0,255,65,0.7)' }
    : { background: 'radial-gradient(120% 90% at 50% 100%,#3a1380 0%,#160538 55%,#0a0220 100%)', boxShadow: on ? 'inset 0 0 0 2px #ffe27a,0 6px 18px -6px rgba(123,60,255,0.8)' : 'inset 0 0 0 1.5px rgba(181,140,255,0.55),0 6px 18px -8px rgba(123,60,255,0.7)' }
  const legendTag = (pos: string, k: string) => <span className={k === 'matrix' ? 'legend-tag mx-tag' : k === 'korea' ? 'legend-tag kr-tag' : k === 'silver' ? 'legend-tag sl-tag' : 'legend-tag'} style={css('position:absolute;z-index:4;height:18px;padding:0 7px;border-radius:9999px;font-size:10px;font-weight:800;letter-spacing:0.3px;display:flex;align-items:center;white-space:nowrap;' + (k === 'korea' ? 'color:#fbf8f1;' : k === 'silver' ? 'color:#f2f2f2;' : 'color:#1a0633;') + pos)}>{k === 'silver' ? '레전드 · 2500' : k === 'korea' ? '레전드 · 1300' : k === 'matrix' ? '레전드 · 2000' : '레전드 · 1000'}</span>
  const limitedTag = <span className="legend-tag kr-tag" style={css('position:absolute;z-index:4;top:-7px;left:50%;margin-left:-26px;height:18px;padding:0 8px;border-radius:9999px;font-size:10px;font-weight:800;letter-spacing:0.5px;color:#fbf8f1;display:flex;align-items:center;white-space:nowrap')}>LIMITED</span>
  // 보관함: only what I own, to wear with a tap.
  const inv = tab === 'inv'
  const mineOr = (list: [string, string][], kind: ItemKind) => (inv ? list.filter(([k]) => owned[kind].includes(k)) : list)

  return (
    <div data-g="clear" style={css('flex:1;background:#ffffff;padding-bottom:24px')}>
      <header data-g="head" style={css('position:sticky;top:0;z-index:20;height:56px;padding:0 16px 0 24px;display:flex;align-items:center;justify-content:space-between;background:#ffffff')}>
        <span style={css('display:flex;align-items:center;gap:2px')}>
          {inv && <button className="pr-dim" onClick={() => onTab('frame')} aria-label="상점으로" style={css('width:40px;height:40px;margin-left:-12px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#191f28')}><BackIcon /></button>}
          <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{inv ? '보관함' : '상점'}</span>
        </span>
        <span style={css('display:flex;align-items:center;gap:6px')}>
          {loggedIn && !inv && (
            <button className="pr-96" onClick={() => onTab('inv')} style={css('height:32px;padding:0 12px 0 10px;border-radius:9999px;background:#f2f4f6;color:#333d4b;font-size:14px;font-weight:600;display:flex;align-items:center;gap:5px')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" /><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" /></svg>보관함
            </button>
          )}
          {loggedIn && <PointsChip points={points} onClick={onPoints} />}
        </span>
      </header>
      <div className="anim-list" style={css('padding:8px 24px 8px;display:flex;flex-direction:column;gap:12px')}>
        <div style={{ height: 60 }}>
          <Nameplate kind={equipped.plate} person={name} sub={bio || '내 이름표예요'} frame={equipped.frame} photo={photoCss} style={{ width: '100%', height: 60 }} />
        </div>
        <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>{inv ? '내가 가진 아이템이에요. 누르면 바로 바꿔 껴요' : loggedIn ? '추천이든 비추천이든 투표를 1개 받을 때마다 10P예요. 산 아이템은 보관함에서도 바꿔 낄 수 있어요' : '로그인하면 포인트로 아이템을 살 수 있어요'}</span>
      </div>
      {!inv && (
        <div style={css('position:sticky;top:56px;z-index:19;padding:8px 24px 16px;background:#ffffff')}>
          <Segmented<'acc' | 'pass' | 'market'> options={['acc', 'pass', 'market']} labels={['악세사리', '패스', '🥕 당근마켓']} value={top} onPick={v => onTab(v === 'acc' ? 'set' : v)} />
        </div>
      )}

        {view === 'set' && (
          <div className="anim-list" style={css('display:flex;flex-direction:column;gap:10px;padding:0 24px 32px')}>
            <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>사면 그 시리즈가 전부 들어와요 · 프레임 + 이름표 (레전드는 막대 스킨까지)</span>
            {FRAMES.filter(([k]) => k !== 'none').map(([k, l]) => {
              const miss = seriesMissing(k, owned), all = miss.items.length === 0
              const wearing = seriesItems(k).every(([kind, x]) => equipped[kind] === x)
              const g = seriesItems(k).some(([kind]) => kind === 'skin') ? skinGeom(k, 56, false) : null
              return (
                <button key={k} className="pr-98" onClick={() => onPickSet(k)} style={sx('position:relative;display:flex;align-items:center;gap:10px;padding:10px 12px 10px 10px;border-radius:18px;text-align:left;transition:transform 200ms,box-shadow 200ms', LEGENDARY.has(k) ? legendTile(wearing, k) : tileColors(wearing))}>
                  {LEGENDARY.has(k) && legendTag('top:-7px;left:14px', k)}
                  <span style={css('flex:1;min-width:0;height:52px')}><Nameplate kind={k} person={l} sub={seriesItems(k).map(([kind]) => ({ frame: '프레임', plate: '이름표', skin: '막대 스킨' })[kind]).join(' + ')} frame={k} photo={photoCss} style={{ width: '100%', height: 52 }} /></span>
                  {g && <span style={css('position:relative;width:18px;height:56px;flex:none;margin:0 4px')}><TowerSkin g={g} /></span>}
                  <span style={css('flex:none;min-width:70px;display:flex;flex-direction:column;align-items:flex-end;gap:2px')}>
                    {all ? (
                      <span style={sx('font-size:13px;font-weight:800', { color: wearing ? '#3182f6' : LEGENDARY.has(k) && k !== 'korea' ? '#ffffff' : '#4e5968' })}>{wearing ? '착용중' : '보유 · 끼기'}</span>
                    ) : (
                      <>
                        <span style={css('height:26px;padding:0 10px;border-radius:9999px;background:#191f28;color:#ffffff;font-size:13px;font-weight:800;display:flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums')}><LockIcon size={10} />{miss.price.toLocaleString()}P</span>
                        {miss.price !== seriesPrice(k) && <span style={css('font-size:11px;color:#8b95a1')}>남은 것만</span>}
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {inv && <InvTitle>프레임</InvTitle>}
        {inv && (
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;padding:0 24px 32px')}>
            {mineOr(FRAMES, 'frame').map(([k, l]) => {
              const it = item('frame', k)
              return (
                <button key={k} className="pr-96" onClick={() => onPick('frame', k, l)} style={sx(tile + ';padding:22px 0 12px;gap:12px;transition:transform 150ms,background 200ms,box-shadow 200ms', LEGENDARY.has(k) ? legendTile(it.on, k) : tileColors(it.on))}>
                  {LEGENDARY.has(k) && legendTag('top:-7px;left:50%;margin-left:-' + 36 + 'px', k)}
                  <span style={css('width:52px;height:52px')}><Avatar frame={k} photo={photoCss} size={52} /></span>
                  <span style={{ fontSize: 13, fontWeight: LEGENDARY.has(k) ? 800 : 600, color: k === 'matrix' ? '#7dffa0' : k === 'korea' ? '#1a1a1a' : LEGENDARY.has(k) ? '#ffffff' : tileFg(it.on) }}>{l}</span>
                  {it.locked && priceTag(it.price)}
                  {it.on && check(20, 'top:8px;right:8px')}
                </button>
              )
            })}
          </div>
        )}

        {inv && <InvTitle>이름표</InvTitle>}
        {inv && (
          <div style={css('display:flex;flex-direction:column;gap:8px;padding:0 24px 32px')}>
            {mineOr(FRAMES, 'plate').map(([k, l]) => {
              const it = item('plate', k)
              return (
                <button key={k} className="pr-98" onClick={() => onPick('plate', k, l + ' 이름표')} aria-pressed={it.on} style={sx('position:relative;display:block;width:100%;height:60px;padding:2px;border-radius:17px;transition:transform 300ms cubic-bezier(0.34,1.4,0.64,1),box-shadow 200ms', { boxShadow: it.on ? '0 0 0 2px #3182f6' : 'none' })}>
                  <Nameplate kind={k} person={name} sub={l + ' 이름표'} frame={equipped.frame} photo={photoCss} style={{ width: '100%', height: 56 }} />
                  {LEGENDARY.has(k) && legendTag('top:-6px;left:12px', k)}
                  {it.locked && (
                    <span style={css('position:absolute;top:50%;right:14px;margin-top:-12px;z-index:3;height:24px;padding:0 9px;border-radius:9999px;background:#191f28;color:#ffffff;box-shadow:0 0 0 2px rgba(255,255,255,0.9);font-size:12px;font-weight:700;display:flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums')}><LockIcon size={10} />{it.price}</span>
                  )}
                  {it.on && check(22, 'top:50%;right:14px;margin-top:-11px;box-shadow:0 0 0 2px #ffffff')}
                </button>
              )
            })}
          </div>
        )}

        {inv && <InvTitle>막대 스킨</InvTitle>}
        {inv && (
          <>
            {!inv && <div style={css('padding:0 24px 8px;font-size:13px;line-height:19.5px;color:#6b7684')}>랭킹 그래프에서 내 막대가 이 모양으로 보여요. 마이너스면 거꾸로 뒤집혀요</div>}
            <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;padding:0 24px 32px')}>
              {mineOr(SKINS.filter(([k]) => !isLimited('skin', k) || owned.skin.includes(k)), 'skin').map(([k, l]) => {
                const it = item('skin', k), g = skinGeom(k, 132, false)
                return (
                  <button key={k} className="pr-97" onClick={() => onPick('skin', k, l)} aria-pressed={it.on} aria-label={`${l} 스킨`} style={sx(tile + ';height:200px;padding:12px 0 12px;justify-content:flex-end;gap:10px;transition:transform 300ms cubic-bezier(0.34,1.4,0.64,1),background 200ms,box-shadow 200ms', (LEGENDARY.has(k) ? legendTile(it.on, k) : tileColors(it.on)))}>
                    {isLimited('skin', k) ? limitedTag : LEGENDARY.has(k) && legendTag('top:-7px;left:50%;margin-left:-' + 36 + 'px', k)}
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

        {inv && (
          <>
            <InvTitle>패스</InvTitle>
            <div style={css('padding:0 24px 32px')}>
              {PASSES.some(x => passes[x.key]) ? (
                <div style={css('display:flex;flex-direction:column;gap:8px')}>
                  {PASSES.filter(x => passes[x.key]).map(x => (
                    <div key={x.key} style={sx('padding:16px 18px;border-radius:16px;color:#fff;display:flex;align-items:center;gap:12px', { background: x.bg })}>
                      <span style={css('font-size:22px;font-weight:800;min-width:30px;text-align:center')}>{x.icon}</span>
                      <span style={css('display:flex;flex-direction:column')}><span style={css('font-size:16px;font-weight:700')}>{x.title}</span><span style={css('font-size:13px;opacity:0.85')}>영구 · {x.desc}</span></span>
                    </div>
                  ))}
                </div>
              ) : (
                <button className="pr-dim" onClick={() => onTab('pass')} style={css('width:100%;padding:16px 18px;border-radius:16px;background:#f9fafb;text-align:left;font-size:15px;color:#6b7684')}>아직 없어요 · 패스 보러 가기 ›</button>
              )}
            </div>
          </>
        )}

        {tab === 'market' && market}

        {tab === 'pass' && (
          <div className="anim-list" style={css('padding:0 24px 32px;display:flex;flex-direction:column;gap:8px')}>
            {PASSES.map(x => (
              <div key={x.key} style={css('display:flex;flex-direction:column;gap:6px')}>
                <div data-g="l1" style={css('border-radius:18px;padding:14px;background:#f9fafb;display:flex;align-items:center;gap:12px')}>
                  <span aria-hidden="true" style={sx('width:48px;height:48px;flex:none;border-radius:14px;color:#fff;font-size:20px;font-weight:800;display:flex;align-items:center;justify-content:center', { background: x.bg })}>{x.icon}</span>
                  <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
                    <span style={css('display:flex;align-items:center;gap:6px')}>
                      <span style={css('font-size:16px;line-height:24px;font-weight:700;color:#191f28')}>{x.title}</span>
                      <span style={css('height:20px;padding:0 7px;border-radius:9999px;background:#f3eeff;color:#6a3cf0;font-size:11px;font-weight:700;display:flex;align-items:center')}>영구</span>
                    </span>
                    <span style={css('font-size:13px;line-height:18px;color:#6b7684')}>{x.desc}</span>
                  </span>
                  {passes[x.key] ? (
                    <span style={css('flex:none;height:34px;padding:0 12px;border-radius:10px;background:#e8f3ff;color:#1b64da;font-size:14px;font-weight:700;display:flex;align-items:center')}>보유중</span>
                  ) : (
                    <button data-g="primary" className="pr-96" onClick={loggedIn ? () => onBuyPass(x.key) : onLogin} aria-label={loggedIn ? `${x.title} ${x.price}P에 사기` : '로그인'}
                      style={sx('flex:none;height:34px;padding:0 12px;border-radius:10px;color:#ffffff;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;transition:transform 150ms', { background: x.key === 'passFake' ? '#8b5cf6' : '#3182f6' })}>
                      {loggedIn ? `${x.price.toLocaleString()}P` : '로그인'}
                    </button>
                  )}
                </div>
                {loggedIn && !passes[x.key] && points < x.price && <span style={css('padding:0 4px;font-size:13px;color:#8b95a1')}>{(x.price - points).toLocaleString()}P 더 필요해요</span>}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

function InvTitle({ children }: { children: string }) {
  return <div style={css('padding:4px 24px 10px;font-size:15px;line-height:22.5px;font-weight:700;color:#333d4b')}>{children}</div>
}
