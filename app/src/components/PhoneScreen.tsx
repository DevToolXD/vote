import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { APP_NAME, onHome, watchPhone, type AppId, type OpenableApp, type PhoneState, type StoreApp } from '../backend/phone'
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
const GLASS = 'background:rgba(255,255,255,0.26);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%)'

const BackChevron = () => (
  <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8" /></svg>
)

function AppTile({ app, badge = 0, onOpen }: { app: AppId; badge?: number; onOpen: (el: HTMLElement) => void }) {
  return (
    <button className="pr-96" onClick={e => onOpen(e.currentTarget)} aria-label={APP_NAME[app]} style={css('width:72px;display:flex;flex-direction:column;align-items:center;gap:7px;background:none;color:#fff;font-family:inherit')}>
      <span style={css('position:relative;display:flex')}>
        <AppIcon app={app} />
        {badge > 0 && (
          <span aria-label={`읽지 않은 대화 ${badge}개`} style={css('position:absolute;top:-7px;right:-7px;min-width:22px;height:22px;padding:0 6px;border-radius:9999px;background:#ff3b30;color:#fff;font-size:14px;line-height:22px;font-weight:600;text-align:center;box-sizing:border-box')}>{badge > 99 ? '99+' : badge}</span>
        )}
      </span>
      <span style={css('max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:14px;text-shadow:0 1px 3px rgba(0,0,0,0.4)')}>{APP_NAME[app]}</span>
    </button>
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

  const dock: AppId[] = (['shop', 'coin', 'stock'] as StoreApp[]).filter(a => onHome(phone, a))
  const grid: AppId[] = [...(isAdmin ? ['admin' as const] : []), ...(['market', 'block', 'flappy'] as StoreApp[]).filter(a => onHome(phone, a))]
  const inApp = !!shown
  const dark = shown === 'stock' || shown === 'block' || shown === 'coin' // 주식, 코인 and the game are black apps
  const away = inApp || view !== 'home'
  const backInk = dark ? '#0a84ff' : inApp ? '#007aff' : view === 'store' ? 'var(--ios-blue)' : '#fff'
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
    <div ref={screen} data-phone onContextMenu={e => e.preventDefault()} style={css(`${screenBox};overflow:hidden;background:${WALL};color:#fff;${vars}`)}>
      {/* home screen */}
      <div style={css(`position:absolute;inset:0;display:flex;flex-direction:column;padding-top:var(--phone-top);box-sizing:border-box;visibility:${covered ? 'hidden' : 'visible'}`)}>
        <div style={css('flex:1;min-height:0;display:grid;grid-template-columns:repeat(4,72px);justify-content:space-between;align-content:start;row-gap:24px;padding:30px 21px 0;box-sizing:border-box')}>
          {grid.map(a => <AppTile key={a} app={a} badge={a === 'admin' ? adminUnread : 0} onOpen={el => launch(a, el)} />)}
        </div>
        <button className="pr-96" onClick={() => setView('search')} aria-label="검색" style={css(`flex:none;align-self:center;height:40px;margin:0 0 14px;padding:0 24px;display:flex;align-items:center;gap:6px;border-radius:20px;${GLASS};color:#fff;font-family:${FONT};font-size:17px;line-height:22px`)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          검색
        </button>
        <div style={css(`flex:none;margin:0 12px calc(var(--phone-bottom) - 20px);padding:17px 12px;border-radius:38px;${GLASS};display:flex;justify-content:space-around;box-sizing:border-box`)}>
          {[...dock, 'store' as AppId].map(a => (
            <button key={a} className="pr-96" onClick={e => launch(a, e.currentTarget)} aria-label={APP_NAME[a]} style={css('background:none;padding:0;display:flex')}>
              <AppIcon app={a} />
            </button>
          ))}
        </div>
      </div>

      {view === 'store' && <AppStore db={db} uid={uid} phone={phone} onOpen={a => launch(a)} onLogin={onLogin} onToast={onToast} />}
      {view === 'search' && <SearchView phone={phone} isAdmin={isAdmin} onOpen={a => launch(a)} onClose={() => setView('home')} />}

      {/* the open app */}
      {shown && (
        <div className="phone-app" data-phone-app style={css(`position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;padding-top:var(--phone-top);box-sizing:border-box;background:${dark ? '#000000' : shown === 'flappy' ? '#ded895' : '#ffffff'};border-radius:${full ? 0 : 53}px;overflow:hidden;color:${dark ? '#ffffff' : '#191f28'};font-family:${APP_FONT};word-break:keep-all;transform-origin:${origin.x}px ${origin.y}px;animation:${closing ? 'appClose' : 'appOpen'} ${closing ? 280 : 420}ms cubic-bezier(0.32,0.72,0,1) both`)}>
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
          {full ? createPortal(screenEl, document.getElementById('overlay-root') ?? document.body) : screenEl}
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
