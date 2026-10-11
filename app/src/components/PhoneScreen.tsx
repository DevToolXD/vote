import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { APP_NAME, onHome, setInstalled, watchPhone, type AppId, type OpenableApp, type PhoneState, type StoreApp } from '../backend/phone'
import { AppStore } from './AppStore'
import { AppIcon } from './PhoneIcons'

// 폰 tab: one iPhone. A black-bezel device (393 × 852 pt screen, Dynamic Island, home indicator) that
// scales to fit; ⤢ at its top right takes the screen full-screen (no bezel, over the tab bar) and
// "전체화면 풀기" there puts it back. There is no clock or battery: the top corners hold the controls,
// "‹ 홈" on the left (in every app, in 앱스토어 and in 검색) and the full-screen button on the right.
// Apps open on the screen (zoom from the icon) and close with ‹ 홈 or the home indicator.
// The screens follow the iOS spec: SF stack, system colours as tokens (styles.css), 60pt icons.

const FONT = "-apple-system,BlinkMacSystemFont,system-ui,sans-serif"
/** The app screens keep the app's own font. */
const APP_FONT = "'Toss Product Sans',Pretendard,'Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif"
const SW = 393, SH = 852, BEZEL = 11
const DW = SW + BEZEL * 2, DH = SH + BEZEL * 2
const WALL = 'radial-gradient(120% 16% at 50% 0%,#8faee0 0%,rgba(143,174,224,0) 100%),radial-gradient(90% 48% at 18% 12%,#9dbcec 0%,rgba(157,188,236,0) 72%),radial-gradient(80% 50% at 92% 34%,#4f84cf 0%,rgba(79,132,207,0) 70%),radial-gradient(90% 42% at 22% 74%,#2c3d33 0%,rgba(44,61,51,0) 72%),radial-gradient(80% 40% at 80% 96%,#6f8b45 0%,rgba(111,139,69,0) 70%),#28344a'
const WALL_TOP = '#8faee0' // the wallpaper's top colour (the status bar in full screen)
const FLAPPY_SKY = '#4ec0ca' // 플래피 버드 starts with the sky at the top, not the sand
// 블록 블라스트: its blue fills the screen, the top and bottom bars included
const BLOCK_BG = 'linear-gradient(180deg,#4a6fc4 0%,#2f4f9f 55%,#2a4790 100%)'
const BLOCK_TOP = '#4a6fc4'
const GLASS = 'background:rgba(255,255,255,0.26);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%)'

const BackChevron = () => (
  <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8" /></svg>
)

const DEFAULT_LAYOUT = { grid: ['admin', 'market', 'block', 'flappy'] as AppId[], dock: ['shop', 'coin', 'stock'] as AppId[] }
const REMOVABLE: AppId[] = ['shop', 'market', 'coin', 'stock', 'block', 'flappy', 'dino', 'bank']
const ALL_HOME: AppId[] = ['admin', 'market', 'block', 'flappy', 'dino', 'shop', 'coin', 'stock', 'bank']
// the apps that were on the home screen before 은행 (a saved layout from then doesn't know about the newer ones)
const BEFORE_BANK: AppId[] = ['admin', 'market', 'block', 'flappy', 'dino', 'shop', 'coin', 'stock']
type Layout = { grid: AppId[]; dock: AppId[] }
function loadLayout(): Layout {
  let l: Layout = DEFAULT_LAYOUT
  try {
    const v = JSON.parse(localStorage.getItem('phone-home') ?? 'null')
    if (v && Array.isArray(v.grid) && Array.isArray(v.dock)) l = { grid: v.grid, dock: v.dock }
  } catch { /* private window: the default */ }
  // an app added since the layout was saved joins the home screen once (an app removed on purpose stays removed)
  try {
    const known: AppId[] = JSON.parse(localStorage.getItem('phone-known') ?? 'null') ?? BEFORE_BANK
    const fresh = ALL_HOME.filter(a => !known.includes(a) && !l.grid.includes(a) && !l.dock.includes(a))
    localStorage.setItem('phone-known', JSON.stringify(ALL_HOME))
    if (fresh.length) l = { ...l, grid: [...l.grid, ...fresh] }
  } catch { /* no storage: nothing new to add */ }
  return l
}
function saveLayout(l: Layout) { try { localStorage.setItem('phone-home', JSON.stringify(l)) } catch { /* private window */ } }

/** An icon on the home screen: a short press opens it; a long press starts the edit mode (wiggle). */
function AppTile({ app, badge = 0, editing, wiggle, removable, slot, idx, dragging, onPress, onDelete }: {
  app: AppId; badge?: number; editing: boolean; wiggle: number; removable: boolean; slot: 'grid' | 'dock'; idx: number; dragging: boolean
  onPress: (e: React.PointerEvent<HTMLElement>, app: AppId) => void; onDelete: (app: AppId) => void
}) {
  return (
    <div data-slot={slot} data-idx={idx} className={editing && !dragging ? 'jiggle' : undefined} style={css(`position:relative;width:72px;display:flex;flex-direction:column;align-items:center;gap:7px;opacity:${dragging ? 0.35 : 1};animation-delay:${(wiggle % 5) * -0.07}s`)}>
      <button className={editing ? undefined : 'pr-96'} onPointerDown={e => onPress(e, app)} onClick={e => e.preventDefault()} aria-label={APP_NAME[app]} style={css('background:none;color:#fff;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:7px;touch-action:none;-webkit-touch-callout:none')}>
        <span style={css('position:relative;display:flex')}>
          <AppIcon app={app} />
          {badge > 0 && (
            <span aria-label={`읽지 않은 대화 ${badge}개`} style={css('position:absolute;top:-7px;right:-7px;min-width:22px;height:22px;padding:0 6px;border-radius:9999px;background:#ff3b30;color:#fff;font-size:14px;line-height:22px;font-weight:600;text-align:center;box-sizing:border-box')}>{badge > 99 ? '99+' : badge}</span>
          )}
        </span>
        <span style={css('max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:14px;text-shadow:0 1px 3px rgba(0,0,0,0.4)')}>{APP_NAME[app]}</span>
      </button>
      {editing && removable && (
        <button aria-label={`${APP_NAME[app]} 삭제`} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete(app) }} style={css('position:absolute;top:-8px;left:-6px;z-index:4;width:24px;height:24px;border-radius:9999px;background:#8e8e93;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #fff')}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M2 2l8 8M10 2 2 10" /></svg>
        </button>
      )}
    </div>
  )
}

/** 검색: find an app by name; an app you do not have yet is pointed at 앱스토어. */
function SearchView({ phone, isAdmin, onOpen, onClose }: { phone: PhoneState; isAdmin: boolean; onOpen: (app: OpenableApp) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const all: OpenableApp[] = [...(isAdmin ? ['admin' as const] : []), 'shop', 'market', 'coin']
  const list = all.filter(a => APP_NAME[a].includes(q.trim()))
  return (
    <div onClick={onClose} style={css(`position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;padding:calc(var(--phone-top) + 16px) 16px 0;box-sizing:border-box;border-radius:var(--phone-r);overflow:hidden;background:rgba(0,0,0,0.4);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);animation:fade 200ms ease both;font-family:${FONT}`)}>
      <div onClick={e => e.stopPropagation()} style={css('display:flex;flex-direction:column;gap:8px')}>
        <input value={q} onChange={e => setQ(e.target.value.slice(0, 20))} placeholder="앱 검색" aria-label="앱 검색" style={css('height:36px;padding:0 12px;border:0;border-radius:10px;background:rgba(255,255,255,0.92);color:#000;font-size:17px;outline:none;font-family:inherit;box-sizing:border-box')} />
        {list.map(app => {
          const ok = app === 'admin' || onHome(phone, app)
          return (
            <button key={app} className="pr-96" onClick={() => { if (ok) { onOpen(app); onClose() } }} style={css('height:52px;display:flex;align-items:center;gap:12px;padding:0 12px;border-radius:12px;background:rgba(255,255,255,0.92);color:#000;text-align:left;font-family:inherit')}>
              <AppIcon app={app} size={36} />
              <span style={css('flex:1;font-size:17px;line-height:22px')}>{APP_NAME[app]}</span>
              <span style={css('font-size:13px;color:rgba(60,60,67,0.6)')}>{ok ? '열기' : '앱스토어에서 받아요'}</span>
            </button>
          )
        })}
        {!!q.trim() && list.length === 0 && <span style={css('padding:12px 4px;font-size:15px;color:#fff')}>찾는 앱이 없어요</span>}
      </div>
    </div>
  )
}

type Props = {
  db: Firestore | null
  uid: string | null
  isAdmin: boolean
  adminUnread: number
  /** The app on screen (null: the home screen). */
  app: OpenableApp | null
  onOpen: (app: OpenableApp) => void
  onClose: () => void
  /** The screen an app shows. */
  renderApp: (app: OpenableApp) => ReactNode
  onLogin: () => void
  onToast: (msg: string) => void
}

/** The 폰 tab: the phone, with its home screen, 앱스토어, 검색 and the open app. */
export function PhoneScreen({ db, uid, isAdmin, adminUnread, app, onOpen, onClose, renderApp, onLogin, onToast }: Props) {
  const [phone, setPhone] = useState<PhoneState>({ mine: {}, catalog: {} })
  const [view, setView] = useState<'home' | 'store' | 'search'>('home')
  const [full, setFull] = useState(false)
  useEffect(() => (db ? watchPhone(db, uid, setPhone) : undefined), [db, uid])
  useEffect(() => {
    if (!full) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [full])

  // The device is drawn at its real size and scaled down to fit the space (never up).
  const box = useRef<HTMLDivElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  // The screen is one element that is moved between the phone and the full-screen layer, never
  // re-rendered there: React would otherwise remount the open app and lose its state (a game in progress).
  const [host] = useState(() => document.createElement('div'))
  const slot = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    host.style.display = 'contents'
    const target = full ? document.getElementById('overlay-root') ?? document.body : slot.current
    target?.appendChild(host)
  }, [full, host])
  useEffect(() => () => host.remove(), [host])
  const [scale, setScale] = useState(0.85)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.min(1, (el.clientWidth - 16) / DW, (el.clientHeight - 16) / DH))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // An app zooms out of its icon and back into it: `shown` outlives `app` while it closes.
  const [shown, setShown] = useState<OpenableApp | null>(app)
  const [closing, setClosing] = useState(false)
  const [origin, setOrigin] = useState({ x: SW / 2, y: SH * 0.6 })
  // once an app has finished opening, the home screen under it is hidden (its glass dock painted
  // outside the rounded corners)
  const [covered, setCovered] = useState(false)
  useEffect(() => {
    if (!shown || closing) { setCovered(false); return }
    const t = setTimeout(() => setCovered(true), 480)
    return () => clearTimeout(t)
  }, [shown, closing])
  useEffect(() => {
    if (app) { setShown(app); setClosing(false); return }
    if (!shown) return
    setClosing(true)
    const t = setTimeout(() => { setShown(null); setClosing(false) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app])

  const launch = (a: AppId, el?: HTMLElement) => {
    if (a === 'store') { setView('store'); return }
    if (el && screen.current) {
      const k = full ? 1 : scale
      const r = el.getBoundingClientRect(), s = screen.current.getBoundingClientRect()
      setOrigin({ x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k })
    }
    onOpen(a)
  }
  /** Home from anywhere: the open app, 앱스토어 and 검색 all close. */
  const goHome = () => { setView('home'); if (app) onClose() }
  const swipe = useRef(0)

  // the home screen's layout (this device's): which apps are in the grid and which in the dock
  const [layout, setLayout] = useState<Layout>(loadLayout)
  const [editing, setEditing] = useState(false)
  const [drag, setDrag] = useState<{ app: AppId; x: number; y: number } | null>(null)
  const [askDelete, setAskDelete] = useState<AppId | null>(null)
  const visibleApp = (a: AppId) => (a === 'admin' ? isAdmin : onHome(phone, a as StoreApp))
  const seen = new Set([...layout.grid, ...layout.dock])
  const missing = ALL_HOME.filter(a => !seen.has(a))
  const grid = [...layout.grid, ...missing].filter((a, i, arr) => arr.indexOf(a) === i && visibleApp(a))
  const dock = layout.dock.filter((a, i, arr) => arr.indexOf(a) === i && visibleApp(a)).slice(0, 3)
  const commit = (l: Layout) => { setLayout(l); saveLayout(l) }

  /** Drops the app where the finger is: on the dock (up to 3) or into the grid at that place. */
  const drop = (app: AppId, x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-slot]') as HTMLElement | null
    if (!el) return
    const slot = el.dataset.slot
    const g = [...grid.filter(a => a !== app)], d = [...dock.filter(a => a !== app)]
    if (slot === 'dock') { if (d.length >= 3) return; d.push(app) }
    else if (slot === 'grid') { const at = Number(el.dataset.idx ?? g.length); g.splice(Math.min(Math.max(at, 0), g.length), 0, app) }
    else return
    commit({ grid: g, dock: d })
  }
  /** A press on an icon: a short tap opens it, a long press edits the home screen, and in edit mode it drags. */
  const press = (e: React.PointerEvent<HTMLElement>, app: AppId) => {
    if (app === 'store') { if (!editing) launch(app, e.currentTarget); return }
    e.stopPropagation()
    const el = e.currentTarget
    const x0 = e.clientX, y0 = e.clientY
    let started = editing
    let timer = 0
    if (editing) setDrag({ app, x: x0, y: y0 })
    else timer = window.setTimeout(() => { started = true; setEditing(true); setDrag({ app, x: x0, y: y0 }) }, 450)
    const move = (ev: PointerEvent) => {
      if (!started) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) cleanup(); return }
      setDrag(d => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))
    }
    const up = (ev: PointerEvent) => {
      cleanup()
      if (started) { setDrag(null); drop(app, ev.clientX, ev.clientY) }
      else if (!editing) launch(app, el)
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cleanup)
      if (!started) return
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', () => { setDrag(null); cleanup() })
  }
  const doDelete = (app: AppId) => {
    setAskDelete(null)
    if (db && uid) setInstalled(db, uid, app as StoreApp, false).catch(() => onToast('지우지 못했어요'))
    commit({ grid: layout.grid.filter(a => a !== app), dock: layout.dock.filter(a => a !== app) })
  }
  const inApp = !!shown
  const dark = shown === 'stock' || shown === 'block' // 주식 and the game are black apps (코인 is white)
  // the whole screen takes the open app's colour, so the strip above it is not the wallpaper
  const appBg = shown ? (shown === 'block' ? BLOCK_BG : dark ? '#000000' : shown === 'flappy' ? FLAPPY_SKY : '#ffffff') : WALL
  // In full screen the phone covers the page, so the browser tints the status bar from the screen's top colour
  const topColour = !shown ? WALL_TOP : shown === 'block' ? BLOCK_TOP : appBg
  useEffect(() => {
    if (!full) return
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', topColour)
    return () => { meta?.setAttribute('content', '#ffffff') }
  }, [full, topColour])
  const away = inApp || view !== 'home'
  const backInk = shown === 'block' ? '#ffffff' : dark ? '#0a84ff' : inApp ? '#007aff' : view === 'store' ? 'var(--ios-blue)' : '#fff'
  const btnInk = dark ? '#fff' : inApp ? '#191f28' : view === 'store' ? 'var(--ios-label)' : '#fff'
  const indicator = dark ? '#fff' : inApp ? '#000' : view === 'store' ? 'var(--ios-label)' : '#fff'

  const side = (pos: string) => <span aria-hidden="true" style={css(`position:absolute;z-index:95;width:3px;border-radius:2px;background:#2b2b30;${pos}`)} />
  const vars = full
    ? '--phone-top:calc(env(safe-area-inset-top) + 48px);--phone-bottom:calc(env(safe-area-inset-bottom) + 34px);--phone-r:0px'
    : '--phone-top:54px;--phone-bottom:34px;--phone-r:53px'
  const screenBox = full
    ? 'position:fixed;top:0;left:0;right:0;bottom:0;max-width:var(--app-w);margin:0 auto;z-index:150'
    : `position:relative;width:${SW}px;height:${SH}px;border-radius:53px;contain:paint`

  const screenEl = (
    <div ref={screen} data-phone onContextMenu={e => e.preventDefault()} style={css(`${screenBox};overflow:hidden;background:${appBg};color:#fff;${vars}`)}>
      {/* home screen */}
      <div onClick={() => { if (editing) setEditing(false) }} style={css(`position:absolute;inset:0;display:flex;flex-direction:column;padding-top:var(--phone-top);box-sizing:border-box;visibility:${covered ? 'hidden' : 'visible'}`)}>
        {editing && (
          <button className="pr-96" onClick={e => { e.stopPropagation(); setEditing(false) }} style={css(`position:absolute;z-index:5;top:calc(var(--phone-top) - 40px);left:50%;transform:translateX(-50%);height:34px;padding:0 18px;border-radius:17px;${GLASS};color:#fff;font-family:${FONT};font-size:16px;font-weight:700`)}>완료</button>
        )}
        <div data-slot="grid" style={css('flex:1;min-height:0;display:grid;grid-template-columns:repeat(4,72px);justify-content:space-between;align-content:start;row-gap:24px;padding:30px 21px 0;box-sizing:border-box')}>
          {grid.map((a, i) => (
            <AppTile key={a} app={a} badge={a === 'admin' ? adminUnread : 0} editing={editing} wiggle={i} removable={REMOVABLE.includes(a) && !!uid} slot="grid" idx={i} dragging={!!drag && drag.app === a} onPress={press} onDelete={setAskDelete} />
          ))}
        </div>
        <button className="pr-96" onClick={e => { e.stopPropagation(); setView('search') }} aria-label="검색" style={css(`flex:none;align-self:center;height:40px;margin:0 0 14px;padding:0 24px;display:flex;align-items:center;gap:6px;border-radius:20px;${GLASS};color:#fff;font-family:${FONT};font-size:17px;line-height:22px`)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          검색
        </button>
        <div data-slot="dock" style={css(`flex:none;margin:0 12px calc(var(--phone-bottom) - 20px);padding:17px 12px;border-radius:38px;${GLASS};display:flex;justify-content:space-around;box-sizing:border-box;min-height:94px;${editing ? 'outline:2px dashed rgba(255,255,255,0.5);outline-offset:4px' : ''}`)}>
          {dock.map((a, i) => (
            <AppTile key={a} app={a} editing={editing} wiggle={i + 1} removable={REMOVABLE.includes(a) && !!uid} slot="dock" idx={i} dragging={!!drag && drag.app === a} onPress={press} onDelete={setAskDelete} />
          ))}
          <AppTile app="store" editing={editing} wiggle={0} removable={false} slot="dock" idx={dock.length} dragging={false} onPress={press} onDelete={() => {}} />
        </div>
      </div>
      {drag && (() => {
        // the lifted icon follows the finger, in the screen's own units (the phone may be scaled down)
        const sr = screen.current?.getBoundingClientRect()
        const k = full || !sr ? 1 : scale
        const left = sr ? (drag.x - sr.left) / k - 36 : drag.x - 36
        const top = sr ? (drag.y - sr.top) / k - 36 : drag.y - 36
        return (
        <div style={{ position: 'absolute', left, top, zIndex: 60, pointerEvents: 'none', transform: 'scale(1.08)' }}>
          <AppIcon app={drag.app} />
        </div>
        )
      })()}
      {askDelete && (
        <div onClick={() => setAskDelete(null)} style={css('position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.25);animation:fade 160ms ease both')}>
          <div onClick={e => e.stopPropagation()} style={css(`width:270px;padding:18px 16px 10px;border-radius:14px;background:rgba(246,246,248,0.96);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);text-align:center;font-family:${FONT}`)}>
            <div style={css('font-size:17px;font-weight:600;color:#000')}>“{APP_NAME[askDelete]}”를 삭제할까요?</div>
            <div style={css('margin-top:6px;font-size:13px;line-height:18px;color:#3c3c43')}>다시 받으려면 앱스토어에서 받을 수 있어요</div>
            <div style={css('margin-top:14px;display:flex;border-top:0.5px solid rgba(60,60,67,0.3);margin-left:-16px;margin-right:-16px')}>
              <button onClick={() => setAskDelete(null)} style={css('flex:1;height:44px;background:none;color:#007aff;font-size:17px;border-right:0.5px solid rgba(60,60,67,0.3)')}>취소</button>
              <button onClick={() => doDelete(askDelete)} style={css('flex:1;height:44px;background:none;color:#ff3b30;font-size:17px;font-weight:600')}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {view === 'store' && <AppStore db={db} uid={uid} phone={phone} onOpen={a => launch(a)} onLogin={onLogin} onToast={onToast} />}
      {view === 'search' && <SearchView phone={phone} isAdmin={isAdmin} onOpen={a => launch(a)} onClose={() => setView('home')} />}

      {/* the open app */}
      {shown && (
        <div className="phone-app" data-phone-app style={css(`position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;padding-top:var(--phone-top);box-sizing:border-box;background:${shown === 'block' ? BLOCK_BG : dark ? '#000000' : shown === 'flappy' ? FLAPPY_SKY : '#ffffff'};border-radius:${full ? 0 : 53}px;overflow:hidden;color:${dark ? '#ffffff' : '#191f28'};font-family:${APP_FONT};word-break:keep-all;transform-origin:${origin.x}px ${origin.y}px;animation:${closing ? 'appClose' : 'appOpen'} ${closing ? 280 : 420}ms cubic-bezier(0.32,0.72,0,1) both`)}>
          <div data-phone-scroll style={css('flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto;padding-bottom:var(--phone-bottom)')}>
            {renderApp(shown)}
          </div>
        </div>
      )}

      {/* top corners: ‹ 홈 on the left, full screen on the right (no clock, Wi-Fi or battery) */}
      {away && (
        <button className="pr-96" onClick={goHome} aria-label="뒤로 가기" style={css(`position:absolute;z-index:60;left:8px;top:calc(var(--phone-top) - 47px);height:44px;padding:0 10px;display:flex;align-items:center;gap:3px;background:none;color:${backInk};font-family:${FONT};font-size:17px;line-height:22px;transition:color 220ms`)}>
          <BackChevron />홈
        </button>
      )}
      <button className="pr-96" onClick={() => setFull(f => !f)} aria-label={full ? '전체화면 풀기' : '전체화면'} title={full ? '전체화면 풀기' : '전체화면'} style={css(`position:absolute;z-index:60;right:12px;top:calc(var(--phone-top) - 46px);width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:none;color:${btnInk};filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45));transition:color 220ms`)}>
              {/* YouTube's full-screen mark: four corner brackets (out to enter, in to leave) */}
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
              </svg>
            </button>
      {!full && <span aria-hidden="true" style={css('position:absolute;z-index:70;top:11px;left:50%;margin-left:-63px;width:126px;height:37px;border-radius:19px;background:#000;pointer-events:none')} />}

      {/* home indicator: tap or swipe up to go home (full screen has no bar at the bottom) */}
      {!full && (
        <button aria-label="홈으로" onClick={goHome}
          onPointerDown={e => { swipe.current = e.clientY }}
          onPointerUp={e => { if (swipe.current - e.clientY > 24 * (full ? 1 : scale)) goHome() }}
          style={css('position:absolute;z-index:80;left:50%;bottom:0;margin-left:-110px;width:220px;height:var(--phone-bottom);background:none;touch-action:none;display:flex;align-items:flex-end;justify-content:center;padding-bottom:calc(var(--phone-bottom) - 26px);box-sizing:border-box')}>
          <span style={css(`width:134px;height:5px;border-radius:3px;background:${indicator};opacity:0.9;transition:background 220ms`)} />
        </button>
      )}
    </div>
  )

  return (
    <div ref={box} style={css('height:100%;min-height:0;display:flex;align-items:center;justify-content:center;background:#f2f4f6;overflow:hidden')}>
      <div style={{ width: DW * scale, height: DH * scale, flex: 'none' }}>
        <div data-phone style={{ ...css(`position:relative;width:${DW}px;height:${DH}px;box-sizing:border-box;padding:${full ? 0 : BEZEL}px;border-radius:${full ? 0 : 64}px;background:${full ? 'transparent' : '#0b0b0d'};box-shadow:${full ? 'none' : 'inset 0 0 0 1.5px #44444a'};transform-origin:0 0;font-family:${FONT}`), transform: full ? 'none' : `scale(${scale})` }}>
          {!full && <>
            {side('left:-3px;top:120px;height:26px;border-radius:2px 0 0 2px')}
            {side('left:-3px;top:178px;height:52px;border-radius:2px 0 0 2px')}
            {side('left:-3px;top:244px;height:52px;border-radius:2px 0 0 2px')}
            {side('right:-3px;top:210px;height:84px;border-radius:0 2px 2px 0')}
          </>}
          {createPortal(screenEl, host)}
          <div ref={slot} style={{ display: 'contents' }} />
          {/* The bezel's inner corners drawn over the screen: whatever a busy layer paints outside the
              screen's rounded corners (some browsers let animated layers out of the clip) is covered. */}
          {!full && (
            <>
              <span aria-hidden="true" style={css('position:absolute;inset:0;border-radius:64px;overflow:hidden;pointer-events:none;z-index:90')}>
                <span style={css(`position:absolute;inset:${BEZEL}px;border-radius:53px;box-shadow:0 0 0 40px #0b0b0d`)} />
              </span>
              {/* and outside the device: the page colour, over anything that got past the corners */}
              <span aria-hidden="true" style={css('position:absolute;inset:0;border-radius:64px;box-shadow:0 0 0 40px #f2f4f6;pointer-events:none;z-index:91')} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
