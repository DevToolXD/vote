import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { APP_DESC, APP_GROUPS, APP_NAME, isInstalled, onHome, setInstalled, watchPhone, type AppId, type OpenableApp, type PhoneState, type StoreApp } from '../backend/phone'

// 폰 tab: one iPhone. A black-bezel device (393 × 852 pt screen, Dynamic Island, home indicator) that
// scales to fit, with a home screen, 앱스토어 and 검색 inside it; apps open on its screen (zoom from
// the icon) and close with the home indicator (tap or swipe up). The screens follow the iOS spec:
// SF stack, system colours as tokens (styles.css), 60pt icons with ~22% corners, 44pt touch targets.

const FONT = "-apple-system,BlinkMacSystemFont,system-ui,sans-serif"
/** The app screens keep the app's own font. */
const APP_FONT = "'Toss Product Sans',Pretendard,'Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif"
const SW = 393, SH = 852, BEZEL = 11
const DW = SW + BEZEL * 2, DH = SH + BEZEL * 2
const WALL = 'radial-gradient(90% 48% at 18% 12%,#9dbcec 0%,rgba(157,188,236,0) 72%),radial-gradient(80% 50% at 92% 34%,#4f84cf 0%,rgba(79,132,207,0) 70%),radial-gradient(90% 42% at 22% 74%,#2c3d33 0%,rgba(44,61,51,0) 72%),radial-gradient(80% 40% at 80% 96%,#6f8b45 0%,rgba(111,139,69,0) 70%),#28344a'
const GLASS = 'background:rgba(255,255,255,0.26);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%)'

const TILE: Record<AppId, { top: string; bottom: string; ink?: string; glyph: ReactNode }> = {
  admin: { top: '#7f7de8', bottom: '#5856d6', glyph: <path d="M12 3.6 5.5 6v5.4c0 4 2.7 7.2 6.5 8.6 3.8-1.4 6.5-4.6 6.5-8.6V6zM9 12l2.2 2.2L15 10.4" /> },
  store: { top: '#35a8ff', bottom: '#0a6cf0', glyph: <path d="M7.4 17.4 12 6.6l4.6 10.8M9.2 13.6h5.6" /> },
  shop: { top: '#ff6a86', bottom: '#ff2d55', glyph: <><path d="M5.5 8.5h13l-1 11.5h-11z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /></> },
  market: { top: '#ffb84d', bottom: '#ff9500', glyph: <><path d="M9 9.5h6l-3 10z" /><path d="M12 9.5 10 5.8M12 9.5l1.6-3.7M12 9.5 14.4 6" /></> },
  coin: { top: '#ffe35c', bottom: '#ffc700', ink: '#191f28', glyph: <><circle cx="12" cy="12" r="7.5" /><path d="M10.2 16.4V7.6h2.7a2.4 2.4 0 0 1 0 4.8h-2.7" /></> },
}

/** An app icon: a soft top-to-bottom shade of one colour, one glyph, 22.37% corners (iOS). */
export function AppIcon({ app, size = 60 }: { app: AppId; size?: number }) {
  const t = TILE[app]
  return (
    <span style={css(`flex:none;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${(size * 0.2237).toFixed(1)}px;background:linear-gradient(180deg,${t.top},${t.bottom});box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.28)`)}>
      <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24" fill="none" stroke={t.ink ?? '#fff'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.glyph}</svg>
    </span>
  )
}

/** The phone-shaped tab icon: an iPhone 8 outline with the home button. */
export function PhoneTabIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.8" />
      <path d="M10.6 5.6h2.8" strokeLinecap="round" />
      <circle cx="12" cy="18.1" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  )
}

const BackChevron = () => (
  <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8" /></svg>
)

/** Time on the left of the Dynamic Island, signal / Wi-Fi / battery on the right. */
function StatusBar({ ink }: { ink: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t) }, [])
  const ear = 'width:133px;height:37px;display:flex;align-items:center;justify-content:center;gap:6px'
  return (
    <div style={css(`position:absolute;z-index:60;left:0;right:0;top:0;height:54px;padding-top:11px;box-sizing:border-box;display:flex;justify-content:space-between;pointer-events:none;color:${ink};transition:color 220ms;font-size:17px;line-height:22px;font-weight:600;font-variant-numeric:tabular-nums`)}>
      <span style={css(ear)}>{now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}</span>
      <span style={css(ear)}>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true"><path d="M8 11.5 5.6 8.9a3.4 3.4 0 0 1 4.8 0z" /><path d="M3.2 6.6a6.8 6.8 0 0 1 9.6 0l-1.3 1.4a4.9 4.9 0 0 0-7 0z" /><path d="M.6 4a10.2 10.2 0 0 1 14.8 0l-1.3 1.4a8.3 8.3 0 0 0-12.2 0z" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="20" height="9" rx="2.5" fill="currentColor" /><path d="M25 4.5v4" stroke="currentColor" opacity="0.4" strokeWidth="1.3" strokeLinecap="round" /></svg>
      </span>
    </div>
  )
}

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

/** A 앱스토어 row: icon, name, one line about it, and the action (받기 / 열기 · 삭제 / 준비 중). */
function StoreRow({ app, phone, uid, db, last, onOpen, onLogin, onToast }: {
  app: StoreApp; phone: PhoneState; uid: string | null; db: Firestore | null; last: boolean
  onOpen: (app: OpenableApp) => void; onLogin: () => void; onToast: (msg: string) => void
}) {
  const off = phone.catalog[app] === false
  const mine = isInstalled(phone, app)
  const change = (on: boolean) => { if (db && uid) setInstalled(db, uid, app, on).catch(() => onToast('바꾸지 못했어요')) }
  const pill = (label: string, tone: 'solid' | 'tint' | 'plain', onTap: () => void) => (
    <span style={css('flex:none;display:flex;align-items:center;height:44px')}>
      <button className="pr-96" onClick={onTap} style={css(`height:32px;min-width:64px;padding:0 14px;border-radius:16px;font-family:${FONT};font-size:15px;font-weight:600;background:${tone === 'solid' ? 'var(--ios-blue)' : tone === 'tint' ? 'var(--ios-fill)' : 'none'};color:${tone === 'solid' ? '#fff' : tone === 'tint' ? 'var(--ios-blue)' : 'var(--ios-red)'}`)}>{label}</button>
    </span>
  )
  return (
    <div style={css('position:relative;display:flex;align-items:center;gap:12px;min-height:44px;padding:8px 16px;box-sizing:border-box')}>
      <AppIcon app={app} size={40} />
      <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
        <span style={css('font-size:17px;line-height:22px;letter-spacing:-0.41px;color:var(--ios-label)')}>{APP_NAME[app]}</span>
        <span style={css('font-size:13px;line-height:18px;color:var(--ios-sec);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{APP_DESC[app]}</span>
      </span>
      {off ? <span style={css('flex:none;font-size:13px;color:var(--ios-sec)')}>준비 중</span>
        : !uid ? pill('로그인', 'solid', onLogin)
        : mine ? <>{pill('열기', 'tint', () => onOpen(app))}{pill('삭제', 'plain', () => change(false))}</>
        : pill('받기', 'solid', () => change(true))}
      {!last && <span style={css('position:absolute;left:68px;right:0;bottom:0;height:0.33px;background:var(--ios-sep)')} />}
    </div>
  )
}

/** 앱스토어: the apps to install and remove, by section. */
function StoreView({ db, uid, phone, onOpen, onClose, onLogin, onToast }: {
  db: Firestore | null; uid: string | null; phone: PhoneState
  onOpen: (app: OpenableApp) => void; onClose: () => void; onLogin: () => void; onToast: (msg: string) => void
}) {
  return (
    <div style={css(`position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;padding-top:54px;box-sizing:border-box;background:var(--ios-bg);color:var(--ios-label);font-family:${FONT};animation:fade 240ms ease both`)}>
      <div style={css('flex:none;position:relative;height:44px;display:flex;align-items:center;justify-content:center')}>
        <button className="pr-96" onClick={onClose} style={css('position:absolute;left:8px;top:0;height:44px;display:flex;align-items:center;gap:2px;padding:0 8px;background:none;color:var(--ios-blue);font-size:17px;line-height:22px')}>
          <BackChevron />홈
        </button>
        <span style={css('font-size:17px;line-height:22px;font-weight:600;letter-spacing:-0.41px')}>앱스토어</span>
      </div>
      <div style={css('flex:1;min-height:0;overflow-y:auto;padding:0 0 48px')}>
        {!uid && <span style={css('display:block;padding:8px 32px 0;font-size:13px;line-height:18px;color:var(--ios-sec)')}>로그인하면 앱을 받을 수 있어요</span>}
        {APP_GROUPS.map((g, i) => (
          <section key={g.title} style={css(`margin-top:${i ? 35 : 8}px`)}>
            <span style={css('display:block;padding:0 32px 6px;font-size:13px;line-height:18px;color:var(--ios-sec)')}>{g.title}</span>
            <div style={css('margin:0 16px;border-radius:10px;background:var(--ios-card);overflow:hidden')}>
              {g.apps.map((app, j) => (
                <StoreRow key={app} app={app} phone={phone} uid={uid} db={db} last={j === g.apps.length - 1} onOpen={onOpen} onLogin={onLogin} onToast={onToast} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/** 검색: find an app by name; an app you do not have yet is pointed at 앱스토어. */
function SearchView({ phone, isAdmin, onOpen, onClose }: { phone: PhoneState; isAdmin: boolean; onOpen: (app: OpenableApp) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const all: OpenableApp[] = [...(isAdmin ? ['admin' as const] : []), 'shop', 'market', 'coin']
  const list = all.filter(a => APP_NAME[a].includes(q.trim()))
  return (
    <div onClick={onClose} style={css(`position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;padding:70px 16px 0;box-sizing:border-box;background:rgba(0,0,0,0.4);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);animation:fade 200ms ease both;font-family:${FONT}`)}>
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
  useEffect(() => (db ? watchPhone(db, uid, setPhone) : undefined), [db, uid])

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
      const r = el.getBoundingClientRect(), s = screen.current.getBoundingClientRect()
      setOrigin({ x: (r.left + r.width / 2 - s.left) / scale, y: (r.top + r.height / 2 - s.top) / scale })
    }
    onOpen(a)
  }
  const goHome = () => { if (view !== 'home') setView('home'); else if (app) onClose() }
  const swipe = useRef(0)

  const dock: AppId[] = (['shop', 'coin'] as StoreApp[]).filter(a => onHome(phone, a))
  const grid: AppId[] = [...(isAdmin ? ['admin' as const] : []), ...(['market'] as StoreApp[]).filter(a => onHome(phone, a))]
  const lightScreen = !!shown || view === 'store'
  const ink = view === 'search' ? '#fff' : view === 'store' ? 'var(--ios-label)' : shown ? '#000' : '#fff'

  const side = (pos: string) => <span aria-hidden="true" style={css(`position:absolute;width:3px;border-radius:2px;background:#2b2b30;${pos}`)} />

  return (
    <div ref={box} style={css('height:100%;min-height:0;display:flex;align-items:center;justify-content:center;background:#f2f4f6;overflow:hidden')}>
      <div style={{ width: DW * scale, height: DH * scale, flex: 'none' }}>
        <div data-phone style={{ ...css(`position:relative;width:${DW}px;height:${DH}px;box-sizing:border-box;padding:${BEZEL}px;border-radius:64px;background:#0b0b0d;box-shadow:inset 0 0 0 1.5px #44444a,0 8px 24px rgba(0,0,0,0.16);transform-origin:0 0;font-family:${FONT}`), transform: `scale(${scale})` }}>
          {side('left:-3px;top:120px;height:26px;border-radius:2px 0 0 2px')}
          {side('left:-3px;top:178px;height:52px;border-radius:2px 0 0 2px')}
          {side('left:-3px;top:244px;height:52px;border-radius:2px 0 0 2px')}
          {side('right:-3px;top:210px;height:84px;border-radius:0 2px 2px 0')}
          <div ref={screen} style={css(`position:relative;width:${SW}px;height:${SH}px;border-radius:53px;overflow:hidden;clip-path:inset(0 round 53px);isolation:isolate;background:${WALL};color:#fff`)}>
            {/* home screen */}
            <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;padding-top:54px;box-sizing:border-box')}>
              <div style={css('flex:1;min-height:0;display:grid;grid-template-columns:repeat(4,72px);justify-content:space-between;align-content:start;row-gap:24px;padding:30px 21px 0;box-sizing:border-box')}>
                {grid.map(a => <AppTile key={a} app={a} badge={a === 'admin' ? adminUnread : 0} onOpen={el => launch(a, el)} />)}
              </div>
              <button className="pr-96" onClick={() => setView('search')} aria-label="검색" style={css(`flex:none;align-self:center;height:40px;margin:0 0 14px;padding:0 24px;display:flex;align-items:center;gap:6px;border-radius:20px;${GLASS};color:#fff;font-family:${FONT};font-size:17px;line-height:22px`)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                검색
              </button>
              <div style={css(`flex:none;margin:0 12px 26px;padding:17px 12px;border-radius:38px;${GLASS};display:flex;justify-content:space-around;box-sizing:border-box`)}>
                {[...dock, 'store' as AppId].map(a => (
                  <button key={a} className="pr-96" onClick={e => launch(a, e.currentTarget)} aria-label={APP_NAME[a]} style={css('background:none;padding:0;display:flex')}>
                    <AppIcon app={a} />
                  </button>
                ))}
              </div>
            </div>

            {view === 'store' && <StoreView db={db} uid={uid} phone={phone} onOpen={a => launch(a)} onClose={() => setView('home')} onLogin={onLogin} onToast={onToast} />}
            {view === 'search' && <SearchView phone={phone} isAdmin={isAdmin} onOpen={a => launch(a)} onClose={() => setView('home')} />}

            {/* the open app */}
            {shown && (
              <div className="phone-app" data-phone-app style={css(`position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;padding-top:54px;box-sizing:border-box;background:#ffffff;border-radius:53px;overflow:hidden;clip-path:inset(0 round 53px);color:#191f28;font-family:${APP_FONT};word-break:keep-all;transform-origin:${origin.x}px ${origin.y}px;animation:${closing ? 'appClose' : 'appOpen'} ${closing ? 280 : 420}ms cubic-bezier(0.32,0.72,0,1) both`)}>
                <div data-phone-scroll style={css('flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto;padding-bottom:34px')}>
                  {renderApp(shown)}
                </div>
              </div>
            )}

            <StatusBar ink={ink} />
            <span aria-hidden="true" style={css('position:absolute;z-index:70;top:11px;left:50%;margin-left:-63px;width:126px;height:37px;border-radius:19px;background:#000')} />

            {/* home indicator: tap or swipe up to go home */}
            <button aria-label="홈으로" onClick={goHome}
              onPointerDown={e => { swipe.current = e.clientY }}
              onPointerUp={e => { if (swipe.current - e.clientY > 24 * scale) goHome() }}
              style={css('position:absolute;z-index:80;left:50%;bottom:0;margin-left:-110px;width:220px;height:34px;background:none;touch-action:none;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;box-sizing:border-box')}>
              <span style={css(`width:134px;height:5px;border-radius:3px;background:${lightScreen ? (view === 'store' ? 'var(--ios-label)' : '#000') : '#fff'};opacity:0.9;transition:background 220ms`)} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
