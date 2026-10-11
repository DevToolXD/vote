import { useState, type ReactNode } from 'react'
import { css, sx } from '../css'
import { BANNERS, BLUE, FRAMES, LEGENDARY, SKINS, seriesItems, seriesMissing, seriesPrice, skinGeom, type ItemKind } from '../data'
import { FAKE_PASS_PRICE, PASS_PRICE, type PassKind } from '../backend/types'
import { Avatar } from './Avatar'
import { ChevronRight } from './icons'
import { Nameplate } from './Nameplate'
import { PointsChip } from './PointsChip'
import { TowerSkin } from './TowerSkin'

// 상점, in the App Store's way (the reference screens): a big title, white rounded cards on grey,
// category pills, and a floating bar at the bottom with the sections and a search button.
export type ShopTab = ItemKind | 'set' | 'pass' | 'inv' | 'feat'

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
  /** Equips an owned item (보관함). */
  onPick: (kind: ItemKind, key: string, label: string) => void
  /** A whole 세트: buy what's missing, or put the whole series on if I have it. */
  onPickSet: (key: string) => void
  /** 투표 2배권 / 패스: active for the current season? */
  passes: Record<PassKind, boolean>
  onBuyPass: (kind: PassKind) => void
  onLogin: () => void
}

/** Passes sold in the 패스 tab (each bought once and kept). */
export const PASSES: { key: PassKind; title: string; desc: string; icon: string; bg: string; price: number }[] = [
  { key: 'pass2x', title: '투표 2배권', desc: '한 사람에게 일주일에 두 번 투표', icon: '×2', bg: 'linear-gradient(135deg,#1b64da,#6a3cf0)', price: PASS_PRICE },
  { key: 'passFake', title: '페이크 선물 패스', desc: '채팅에서 페이크 선물을 보낼 수 있어요', icon: '🤡', bg: 'linear-gradient(135deg,#8b5cf6,#c026d3)', price: FAKE_PASS_PRICE },
]

/** The sets a person can buy as a whole, and the pills that sort them. */
const SET_FILTERS = [['all', '모든 장신구'], ['legend', '레전드'], ['normal', '일반'], ['skin', '막대 스킨 포함']] as const
/** The newest sets, shown first on 추천. */
const FEATURED = ['chroma', 'gargantua'] as const

const CARD = 'position:relative;overflow:hidden;background:#ffffff;border-radius:26px;box-shadow:0 1px 2px rgba(0,0,0,0.04)'
const SECTION = 'font-size:22px;line-height:28px;font-weight:700;letter-spacing:-0.3px;color:#1d1d1f;padding:0 20px'

/** 레전드 tile: a night-sky card with a spectrum edge (what the legend sets look like). */
const legendTile = (on: boolean, k: string) => k === 'silver'
  ? { background: 'radial-gradient(120% 90% at 50% 100%,#2a2a2a 0%,#0a0a0a 55%,#000 100%)', boxShadow: on ? 'inset 0 0 0 2px #ffffff,0 6px 18px -6px rgba(220,228,245,0.7)' : 'inset 0 0 0 1px rgba(198,198,198,0.55),0 6px 18px -8px rgba(200,210,230,0.5)' }
  : k === 'chroma'
  ? { background: 'radial-gradient(120% 90% at 50% 100%,#2a2a33 0%,#0a0a0c 55%,#000 100%)', boxShadow: on ? 'inset 0 0 0 2px #ffffff,0 6px 18px -6px rgba(255,160,230,0.7)' : 'inset 0 0 0 1px rgba(255,255,255,0.45),0 6px 18px -8px rgba(160,200,255,0.55)' }
  : k === 'gargantua'
  ? { background: 'radial-gradient(120% 90% at 50% 100%,#3a1a00 0%,#120800 55%,#000 100%)', boxShadow: on ? 'inset 0 0 0 2px #ffd6a0,0 6px 18px -6px rgba(255,140,50,0.8)' : 'inset 0 0 0 1.5px rgba(255,170,90,0.6),0 6px 18px -8px rgba(255,130,40,0.7)' }
  : k === 'korea'
  ? { background: 'linear-gradient(180deg,#fbf8f1 0%,#f3ede1 100%)', boxShadow: on ? 'inset 0 0 0 2px #1a1a1a,0 6px 16px -8px rgba(0,0,0,0.35)' : 'inset 0 0 0 1px rgba(26,26,26,0.16),0 6px 16px -10px rgba(0,0,0,0.3)' }
  : k === 'matrix'
  ? { background: 'radial-gradient(120% 90% at 50% 100%,#04351a 0%,#01140a 55%,#000 100%)', boxShadow: on ? 'inset 0 0 0 2px #eafff0,0 6px 18px -6px rgba(0,255,65,0.8)' : 'inset 0 0 0 1.5px rgba(0,255,65,0.6),0 6px 18px -8px rgba(0,255,65,0.7)' }
  : { background: 'radial-gradient(120% 90% at 50% 100%,#3a1380 0%,#160538 55%,#0a0220 100%)', boxShadow: on ? 'inset 0 0 0 2px #ffe27a,0 6px 18px -6px rgba(123,60,255,0.8)' : 'inset 0 0 0 1.5px rgba(181,140,255,0.55),0 6px 18px -8px rgba(123,60,255,0.7)' }

/** The tag on a 레전드 card; its price is the set's (seriesPrice), so it can't drift from what the set costs. */
const legendTag = (pos: string, k: string) => (
  <span className={k === 'matrix' ? 'legend-tag mx-tag' : k === 'korea' ? 'legend-tag kr-tag' : k === 'silver' ? 'legend-tag sl-tag' : k === 'chroma' ? 'legend-tag ch-tag' : k === 'gargantua' ? 'legend-tag ga-tag' : 'legend-tag'}
    style={css('position:absolute;z-index:4;height:18px;padding:0 7px;border-radius:9999px;font-size:10px;font-weight:800;letter-spacing:0.3px;display:flex;align-items:center;white-space:nowrap;' + (k === 'korea' ? 'color:#fbf8f1;' : k === 'silver' ? 'color:#f2f2f2;' : k === 'chroma' ? 'color:#1a1a1f;' : k === 'gargantua' ? 'color:#ffd9a6;' : 'color:#1a0633;') + pos)}>
    {`레전드 · ${seriesPrice(k)}`}
  </span>
)

/** A small pill: the price (black) or the state (blue text). */
const pill = (text: string, dark: boolean) => (
  <span style={sx('height:30px;padding:0 13px;border-radius:9999px;display:flex;align-items:center;gap:4px;font-size:14px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums', dark ? { background: '#1d1d1f', color: '#ffffff' } : { background: '#e8f1ff', color: BLUE })}>{text}</span>
)

const check = (on: boolean) => on ? (
  <span style={css('width:22px;height:22px;flex:none;border-radius:9999px;background:#3182f6;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800')}>✓</span>
) : null

/** The icons of the bottom bar (outline, like the App Store's). */
const TAB_ICONS: Record<'feat' | 'set' | 'pass' | 'inv', ReactNode> = {
  feat: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.9z" /><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg>,
  set: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12l3 5-9 11L3 9z" /><path d="M3 9h18" /></svg>,
  pass: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>,
  inv: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" /><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" /></svg>,
}
const SEARCH_ICON = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>

export function ShopScreen({ loggedIn, name, bio, photoCss, equipped, owned, points, onPoints, tab, onTab, onPick, passes, onBuyPass, onLogin, onPickSet }: Props) {
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [filter, setFilter] = useState<(typeof SET_FILTERS)[number][0]>('all')
  // the tabs: 추천 (featured), 장신구 (the sets), 패스, 보관함 (what I own); an older tab value opens 장신구
  const section: 'feat' | 'set' | 'pass' | 'inv' = tab === 'feat' || tab === 'pass' || tab === 'inv' ? tab : 'set'
  const title = section === 'feat' ? '추천' : section === 'set' ? '장신구' : section === 'pass' ? '패스' : '보관함'

  // a set is in the list when its name matches the search and it's in the filter
  const sets = FRAMES.filter(([k, l]) => k !== 'none' && (!q.trim() || l.includes(q.trim()))
    && (filter === 'all' || (filter === 'legend' && LEGENDARY.has(k)) || (filter === 'normal' && !LEGENDARY.has(k)) || (filter === 'skin' && seriesItems(k).some(([kind]) => kind === 'skin'))))
  const setLabel = (k: string) => seriesItems(k).map(([kind]) => ({ frame: '프레임', plate: '이름표', skin: '막대 스킨' })[kind]).join(' + ')

  /** A set as a card: its frame (and bar, for the 레전드 sets), its name, and what it costs or whether I have it. */
  const setCard = (k: string, l: string, big: boolean) => {
    const miss = seriesMissing(k, owned), all = miss.items.length === 0
    const wearing = seriesItems(k).every(([kind, x]) => equipped[kind] === x)
    const leg = LEGENDARY.has(k)
    const g = seriesItems(k).some(([kind]) => kind === 'skin') ? skinGeom(k, big ? 110 : 84, false) : null
    const state = all ? (wearing ? '착용중' : '보유 · 끼기') : `${miss.price.toLocaleString()}P`
    return (
      <button key={k} className="pr-98" onClick={() => onPickSet(k)} aria-label={`${l} 세트 ${state}`}
        style={sx(CARD + ';width:100%;padding:0;text-align:left;transition:transform 200ms,box-shadow 200ms', leg ? legendTile(wearing, k) : { background: '#ffffff' })}>
        {leg && legendTag('top:14px;left:14px', k)}
        <span style={sx('position:relative;height:' + (big ? 200 : 132) + 'px;display:flex;align-items:center;justify-content:center;gap:22px;background-repeat:no-repeat;background-size:cover', { background: leg ? 'transparent' : (BANNERS[k] ?? '#f5f5f7') })}>
          <span style={css('width:' + (big ? 104 : 80) + 'px;height:' + (big ? 104 : 80) + 'px;flex:none')}><Avatar frame={k} photo={photoCss} size={big ? 104 : 80} /></span>
          {g && <span style={css('position:relative;width:22px;height:' + (big ? 110 : 88) + 'px;flex:none')}><TowerSkin g={g} /></span>}
        </span>
        <span style={css('display:flex;align-items:center;gap:12px;padding:14px 18px 18px')}>
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px')}>
            <span style={sx('font-size:' + (big ? 22 : 18) + 'px;line-height:1.25;font-weight:700;letter-spacing:-0.2px', { color: leg && k !== 'korea' ? '#ffffff' : '#1d1d1f' })}>{l}</span>
            <span style={sx('font-size:13px;line-height:18px', { color: leg && k !== 'korea' ? 'rgba(255,255,255,0.7)' : '#6e6e73' })}>{setLabel(k)}</span>
          </span>
          {all
            ? (wearing ? check(true) : pill('보유 · 끼기', false))
            : pill(`${miss.price.toLocaleString()}P`, true)}
        </span>
      </button>
    )
  }

  /** A pass as a card (the 패스 tab). */
  const passCard = (x: (typeof PASSES)[number]) => (
    <div key={x.key} style={css(CARD + ';padding:16px 18px;display:flex;align-items:center;gap:14px')}>
      <span aria-hidden="true" style={sx('width:56px;height:56px;flex:none;border-radius:16px;color:#ffffff;font-size:22px;font-weight:800;display:flex;align-items:center;justify-content:center', { background: x.bg })}>{x.icon}</span>
      <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px')}>
        <span style={css('font-size:17px;line-height:23px;font-weight:700;color:#1d1d1f')}>{x.title}</span>
        <span style={css('font-size:13px;line-height:18px;color:#6e6e73')}>{x.desc}</span>
        {loggedIn && !passes[x.key] && points < x.price && <span style={css('font-size:12px;color:#8e8e93')}>{(x.price - points).toLocaleString()}P 더 필요해요</span>}
      </span>
      {passes[x.key] ? pill('보유중', false) : (
        <button data-g="primary" className="pr-96" onClick={loggedIn ? () => onBuyPass(x.key) : onLogin} aria-label={loggedIn ? `${x.title} ${x.price}P에 사기` : '로그인'}
          style={sx('flex:none;height:32px;padding:0 14px;border-radius:9999px;color:#ffffff;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;background:#3182f6;transition:transform 150ms')}>
          {loggedIn ? `${x.price.toLocaleString()}P` : '로그인'}
        </button>
      )}
    </div>
  )

  /** Owned pieces, for 보관함: a row each, a tap wears it. */
  const ownedRow = (kind: ItemKind, k: string, l: string, thumb: ReactNode) => {
    const on = equipped[kind] === k
    return (
      <button key={kind + k} className="pr-98" onClick={() => onPick(kind, k, l)} aria-pressed={on} aria-label={`${l} ${on ? '착용중' : '끼기'}`}
        style={css(CARD + ';width:100%;padding:12px 16px;display:flex;align-items:center;gap:14px;text-align:left')}>
        <span style={css('width:56px;height:56px;flex:none;display:flex;align-items:center;justify-content:center')}>{thumb}</span>
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
          <span style={css('font-size:16px;font-weight:700;color:#1d1d1f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{l}</span>
          <span style={css('font-size:13px;color:#8e8e93')}>{kind === 'frame' ? '프레임' : kind === 'plate' ? '이름표' : '막대 스킨'}</span>
        </span>
        {on ? check(true) : <span style={css('font-size:14px;font-weight:600;color:#3182f6')}>끼기</span>}
      </button>
    )
  }

  const mine = (list: [string, string][], kind: ItemKind) => list.filter(([k]) => owned[kind].includes(k))
  const sectionHead = (text: string) => <h2 style={css(SECTION + ';margin:22px 0 10px')}>{text}</h2>

  // ---- the four sections ----
  const featured = (
    <>
      <div style={css('padding:0 20px;display:flex;flex-direction:column;gap:12px')}>
        <span style={css('font-size:13px;color:#6e6e73')}>{loggedIn ? '지금 끼고 있는 것' : '로그인하면 포인트로 장신구를 살 수 있어요'}</span>
        <div style={{ height: 60 }}>
          <Nameplate kind={equipped.plate} person={name} sub={bio || '내 이름표예요'} frame={equipped.frame} photo={photoCss} style={{ width: '100%', height: 60 }} />
        </div>
      </div>
      {sectionHead('새로운 장신구')}
      <div style={css('padding:0 16px;display:flex;flex-direction:column;gap:14px')}>
        {FEATURED.map(k => setCard(k, FRAMES.find(([x]) => x === k)?.[1] ?? k, true))}
      </div>
      {sectionHead('더 살펴보기')}
      <div style={css('margin:0 16px;background:#ffffff;border-radius:26px;overflow:hidden')}>
        {([
          ['set', '장신구', '세트로 사면 프레임과 이름표가 함께 와요'],
          ['pass', '패스', '투표 2배권, 페이크 선물 패스'],
          ['inv', '보관함', '내가 가진 장신구를 골라 껴요'],
        ] as const).map(([v, t, d], i) => (
          <button key={v} className="pr-98" onClick={() => onTab(v)} style={css('width:100%;display:flex;align-items:center;gap:14px;padding:16px 18px;text-align:left;' + (i ? 'border-top:0.5px solid #e5e5ea' : ''))}>
            <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
              <span style={css('font-size:17px;font-weight:700;color:#1d1d1f')}>{t}</span>
              <span style={css('font-size:13px;color:#6e6e73')}>{d}</span>
            </span>
            <ChevronRight size={18} stroke="#c7c7cc" />
          </button>
        ))}
      </div>
    </>
  )

  const setsView = (
    <>
      {searching && (
        <label style={css('margin:4px 16px 0;display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:12px;background:rgba(118,118,128,0.14)')}>
          <span style={css('color:#8e8e93;display:flex')}>{SEARCH_ICON}</span>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="장신구 검색" aria-label="장신구 검색" style={css('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:17px;color:#1d1d1f')} />
        </label>
      )}
      <div className="anim-list" style={css('display:flex;gap:8px;overflow-x:auto;padding:14px 16px 4px;scrollbar-width:none')}>
        {SET_FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={sx('flex:none;height:34px;padding:0 14px;border-radius:9999px;font-size:14px;font-weight:600;white-space:nowrap;transition:background 200ms,color 200ms', filter === v ? { background: '#1d1d1f', color: '#ffffff' } : { background: '#ffffff', color: '#1d1d1f' })}>{l}</button>
        ))}
      </div>
      {sectionHead('세트')}
      <p style={css('margin:-4px 20px 12px;font-size:13px;line-height:19px;color:#6e6e73')}>사면 그 시리즈가 전부 들어와요. 레전드는 막대 스킨까지 함께예요.</p>
      <div className="anim-list" style={css('display:flex;flex-direction:column;gap:14px;padding:0 16px')}>
        {sets.length ? sets.map(([k, l]) => setCard(k, l, false)) : <span style={css('padding:24px 4px;font-size:15px;color:#8e8e93;text-align:center')}>맞는 장신구가 없어요</span>}
      </div>
    </>
  )

  const passView = (
    <>
      {sectionHead('패스')}
      <p style={css('margin:-4px 20px 12px;font-size:13px;line-height:19px;color:#6e6e73')}>한 번 사면 계속 가지고 있어요.</p>
      <div className="anim-list" style={css('display:flex;flex-direction:column;gap:12px;padding:0 16px')}>
        {PASSES.map(passCard)}
      </div>
    </>
  )

  const invView = (() => {
    const frames = mine(FRAMES, 'frame'), plates = mine(FRAMES, 'plate'), skins = SKINS.filter(([k]) => owned.skin.includes(k))
    const none = !frames.length && !plates.length && !skins.length
    return (
      <>
        {none && <div style={css(CARD + ';margin:16px;padding:28px 20px;text-align:center;font-size:15px;color:#8e8e93')}>아직 가진 장신구가 없어요. 장신구에서 세트를 사 보세요</div>}
        {frames.length > 0 && sectionHead('프레임')}
        {frames.length > 0 && <div style={css('display:flex;flex-direction:column;gap:10px;padding:0 16px')}>{frames.map(([k, l]) => ownedRow('frame', k, l, <Avatar frame={k} photo={photoCss} size={52} />))}</div>}
        {plates.length > 0 && sectionHead('이름표')}
        {plates.length > 0 && <div style={css('display:flex;flex-direction:column;gap:10px;padding:0 16px')}>{plates.map(([k, l]) => ownedRow('plate', k, l + ' 이름표', <span style={sx('width:56px;height:56px;border-radius:16px', { background: BANNERS[k] ?? '#f5f5f7' })} />))}</div>}
        {skins.length > 0 && sectionHead('막대 스킨')}
        {skins.length > 0 && <div style={css('display:flex;flex-direction:column;gap:10px;padding:0 16px')}>{skins.map(([k, l]) => {
          const g = skinGeom(k, 52, false)
          return ownedRow('skin', k, l, g ? <span style={css('position:relative;width:20px;height:52px;display:block')}><TowerSkin g={g} /></span> : null)
        })}</div>}
        {PASSES.some(x => passes[x.key]) && sectionHead('패스')}
        {PASSES.some(x => passes[x.key]) && <div style={css('display:flex;flex-direction:column;gap:10px;padding:0 16px')}>{PASSES.filter(x => passes[x.key]).map(x => (
          <div key={x.key} style={css(CARD + ';padding:14px 16px;display:flex;align-items:center;gap:14px')}>
            <span aria-hidden="true" style={sx('width:48px;height:48px;flex:none;border-radius:14px;color:#ffffff;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center', { background: x.bg })}>{x.icon}</span>
            <span style={css('flex:1;display:flex;flex-direction:column;gap:2px')}><span style={css('font-size:16px;font-weight:700;color:#1d1d1f')}>{x.title}</span><span style={css('font-size:13px;color:#8e8e93')}>영구 · {x.desc}</span></span>
          </div>
        ))}</div>}
      </>
    )
  })()

  const TABS: ('feat' | 'set' | 'pass' | 'inv')[] = ['feat', 'set', 'pass', 'inv']
  const TAB_LABEL = { feat: '추천', set: '장신구', pass: '패스', inv: '보관함' }

  return (
    <div data-g="clear" style={css('flex:1;display:flex;flex-direction:column;min-height:100%;background:#f2f2f7;padding-bottom:6px')}>
      <header data-g="head" style={css('padding:16px 20px 6px;display:flex;align-items:center;justify-content:space-between;gap:8px')}>
        <span style={css('font-size:34px;line-height:41px;font-weight:700;letter-spacing:-0.5px;color:#1d1d1f')}>{title}</span>
        {loggedIn && <PointsChip points={points} onClick={onPoints} />}
      </header>

      <div style={css('flex:1;display:flex;flex-direction:column;padding-bottom:12px')}>
        {section === 'feat' && featured}
        {section === 'set' && setsView}
        {section === 'pass' && passView}
        {section === 'inv' && invView}
      </div>

      {/* the floating bar: the sections and the search (it only searches 장신구) */}
      <nav aria-label="상점 메뉴" style={css('position:sticky;bottom:12px;z-index:20;margin:0 16px;display:flex;align-items:center;gap:10px')}>
        <div style={css('flex:1;display:flex;justify-content:space-around;align-items:center;height:64px;padding:0 6px;border-radius:9999px;background:rgba(250,250,252,0.78);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);box-shadow:0 8px 28px rgba(0,0,0,0.12),inset 0 0 0 0.5px rgba(0,0,0,0.06)')}>
          {TABS.map(t => {
            const on = section === t
            return (
              <button key={t} onClick={() => onTab(t)} aria-current={on ? 'page' : undefined}
                style={sx('flex:1;height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:9999px;font-size:11px;font-weight:600;transition:color 200ms', { color: on ? BLUE : '#1d1d1f' })}>
                {TAB_ICONS[t]}
                <span>{TAB_LABEL[t]}</span>
              </button>
            )
          })}
        </div>
        <button onClick={() => { setSearching(s => !s); if (section !== 'set') onTab('set') }} aria-label="장신구 검색" aria-pressed={searching}
          style={sx('flex:none;width:64px;height:64px;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#1d1d1f;background:rgba(250,250,252,0.78);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);box-shadow:0 8px 28px rgba(0,0,0,0.12),inset 0 0 0 0.5px rgba(0,0,0,0.06)', searching ? { color: BLUE } : {})}>
          {SEARCH_ICON}
        </button>
      </nav>
    </div>
  )
}

