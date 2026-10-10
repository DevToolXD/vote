import { useEffect, useState, type ReactNode } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { APP_DESC, APP_GROUPS, APP_NAME, isInstalled, onHome, setInstalled, watchPhone, type AppId, type OpenableApp, type PhoneState, type StoreApp } from '../backend/phone'

// 폰 tab: an iPhone-style home screen, styled to the iOS spec (SF stack, system colours as tokens in
// styles.css, 60pt icons with ~22% corners, 44pt touch targets, the dock as a glass capsule).

const FONT = "-apple-system,BlinkMacSystemFont,system-ui,sans-serif"
const WALL = '#3d6ca6'

const TILE: Record<AppId, { bg: string; ink?: string; glyph: ReactNode }> = {
  admin: { bg: '#5856d6', glyph: <path d="M12 3.6 5.5 6v5.4c0 4 2.7 7.2 6.5 8.6 3.8-1.4 6.5-4.6 6.5-8.6V6zM9 12l2.2 2.2L15 10.4" /> },
  store: { bg: '#007aff', glyph: <path d="M7.4 17.4 12 6.6l4.6 10.8M9.2 13.6h5.6" /> },
  shop: { bg: '#ff2d55', glyph: <><path d="M5.5 8.5h13l-1 11.5h-11z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /></> },
  market: { bg: '#ff9500', glyph: <><path d="M9 9.5h6l-3 10z" /><path d="M12 9.5 10 5.8M12 9.5l1.6-3.7M12 9.5 14.4 6" /></> },
  coin: { bg: '#ffcc00', ink: '#191f28', glyph: <><circle cx="12" cy="12" r="7.5" /><path d="M10.2 16.4V7.6h2.7a2.4 2.4 0 0 1 0 4.8h-2.7" /></> },
}

/** An app icon: flat colour, one white glyph, 22.37% corner radius (iOS). */
export function AppIcon({ app, size = 60 }: { app: AppId; size?: number }) {
  const t = TILE[app]
  return (
    <span style={css(`flex:none;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${(size * 0.2237).toFixed(1)}px;background:${t.bg}`)}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={t.ink ?? '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.glyph}</svg>
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

/** The top bar of an app opened from 폰: ‹ 홈, and the app's name in the middle. */
export function PhoneAppBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div data-phone style={css(`flex:none;position:relative;z-index:2;height:calc(44px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 0 0;box-sizing:border-box;background:var(--ios-card);box-shadow:0 0.33px 0 var(--ios-sep);font-family:${FONT}`)}>
      <button className="pr-96" onClick={onBack} style={css('position:absolute;left:8px;top:env(safe-area-inset-top);height:44px;display:flex;align-items:center;gap:2px;padding:0 8px;background:none;color:var(--ios-blue);font-size:17px;line-height:22px')}>
        <BackChevron />홈
      </button>
      <span style={css('position:absolute;left:0;right:0;top:env(safe-area-inset-top);height:44px;display:flex;align-items:center;justify-content:center;font-size:17px;line-height:22px;font-weight:600;letter-spacing:-0.41px;color:var(--ios-label);pointer-events:none')}>{title}</span>
    </div>
  )
}

/** Time and status icons. Plain text colour unless `ink` says otherwise (white over the wallpaper). */
function StatusBar({ ink = '#fff' }: { ink?: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t) }, [])
  return (
    <div style={css(`flex:none;height:calc(44px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 26px 0 34px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;color:${ink};font-size:17px;line-height:22px;font-weight:600;font-variant-numeric:tabular-nums`)}>
      <span>{now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}</span>
      <span style={css('display:flex;align-items:center;gap:6px')}>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true"><path d="M8 11.5 5.6 8.9a3.4 3.4 0 0 1 4.8 0z" /><path d="M3.2 6.6a6.8 6.8 0 0 1 9.6 0l-1.3 1.4a4.9 4.9 0 0 0-7 0z" /><path d="M.6 4a10.2 10.2 0 0 1 14.8 0l-1.3 1.4a8.3 8.3 0 0 0-12.2 0z" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="20" height="9" rx="2.5" fill="currentColor" /><path d="M25 4.5v4" stroke="currentColor" opacity="0.4" strokeWidth="1.3" strokeLinecap="round" /></svg>
      </span>
    </div>
  )
}

function AppTile({ app, badge = 0, onOpen }: { app: AppId; badge?: number; onOpen: () => void }) {
  return (
    <button className="pr-96" onClick={onOpen} aria-label={APP_NAME[app]} style={css('width:76px;display:flex;flex-direction:column;align-items:center;gap:6px;background:none;color:#fff;font-family:inherit')}>
      <span style={css('position:relative;display:flex')}>
        <AppIcon app={app} />
        {badge > 0 && (
          <span aria-label={`읽지 않은 대화 ${badge}개`} style={css(`position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 6px;border-radius:9999px;background:#ff3b30;color:#fff;font-size:13px;line-height:20px;font-weight:600;text-align:center;box-shadow:0 0 0 2px ${WALL}`)}>{badge > 99 ? '99+' : badge}</span>
        )}
      </span>
      <span style={css('max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:13px;text-shadow:0 1px 2px rgba(0,0,0,0.35)')}>{APP_NAME[app]}</span>
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

/** 앱스토어: the apps to install and remove, by section. Its own screen inside 폰. */
function StoreView({ db, uid, phone, onOpen, onClose, onLogin, onToast }: {
  db: Firestore | null; uid: string | null; phone: PhoneState
  onOpen: (app: OpenableApp) => void; onClose: () => void; onLogin: () => void; onToast: (msg: string) => void
}) {
  return (
    <div data-phone style={css(`position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;background:var(--ios-bg);color:var(--ios-label);font-family:${FONT};animation:fade 240ms ease both`)}>
      <StatusBar ink="var(--ios-label)" />
      <div style={css('flex:none;position:relative;height:44px;display:flex;align-items:center;justify-content:center')}>
        <button className="pr-96" onClick={onClose} style={css('position:absolute;left:8px;top:0;height:44px;display:flex;align-items:center;gap:2px;padding:0 8px;background:none;color:var(--ios-blue);font-size:17px;line-height:22px')}>
          <BackChevron />홈
        </button>
        <span style={css('font-size:17px;line-height:22px;font-weight:600;letter-spacing:-0.41px')}>앱스토어</span>
      </div>
      <div style={css('flex:1;min-height:0;overflow-y:auto;padding:0 0 calc(24px + env(safe-area-inset-bottom))')}>
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
    <div onClick={onClose} style={css(`position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top) + 56px) 16px 0;box-sizing:border-box;background:rgba(0,0,0,0.45);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);animation:fade 200ms ease both;font-family:${FONT}`)}>
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
  onOpen: (app: OpenableApp) => void
  onLogin: () => void
  onToast: (msg: string) => void
}

/** The 폰 tab: the home screen, 앱스토어 and 검색. Apps with a screen open through `onOpen`. */
export function PhoneScreen({ db, uid, isAdmin, adminUnread, onOpen, onLogin, onToast }: Props) {
  const [phone, setPhone] = useState<PhoneState>({ mine: {}, catalog: {} })
  const [view, setView] = useState<'home' | 'store' | 'search'>('home')
  useEffect(() => (db ? watchPhone(db, uid, setPhone) : undefined), [db, uid])

  const open = (app: AppId) => { if (app === 'store') setView('store'); else onOpen(app) }
  const dock: AppId[] = (['shop', 'coin'] as StoreApp[]).filter(a => onHome(phone, a))
  const grid: AppId[] = [...(isAdmin ? ['admin' as const] : []), ...(['market'] as StoreApp[]).filter(a => onHome(phone, a))]

  return (
    <div data-phone style={css(`position:relative;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:${WALL};color:#fff;font-family:${FONT};box-sizing:border-box`)}>
      <StatusBar />
      <div style={css('flex:1;min-height:0;display:grid;grid-template-columns:repeat(4,76px);justify-content:space-between;align-content:start;row-gap:24px;padding:24px 22px 0;box-sizing:border-box')}>
        {grid.map(app => <AppTile key={app} app={app} badge={app === 'admin' ? adminUnread : 0} onOpen={() => open(app)} />)}
      </div>
      <button className="pr-96" onClick={() => setView('search')} aria-label="검색" style={css(`flex:none;align-self:center;height:36px;margin:0 0 16px;padding:0 18px;display:flex;align-items:center;gap:6px;border-radius:18px;background:rgba(255,255,255,0.28);-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);color:#fff;font-family:${FONT};font-size:17px;line-height:22px`)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        검색
      </button>
      <div style={css('flex:none;margin:0 10px calc(10px + env(safe-area-inset-bottom));padding:12px 14px;border-radius:32px;background:rgba(255,255,255,0.28);-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);display:flex;justify-content:space-around;box-sizing:border-box')}>
        {[...dock, 'store' as AppId].map(app => (
          <button key={app} className="pr-96" onClick={() => open(app)} aria-label={APP_NAME[app]} style={css('background:none;padding:0;display:flex')}>
            <AppIcon app={app} />
          </button>
        ))}
      </div>
      {view === 'store' && <StoreView db={db} uid={uid} phone={phone} onOpen={onOpen} onClose={() => setView('home')} onLogin={onLogin} onToast={onToast} />}
      {view === 'search' && <SearchView phone={phone} isAdmin={isAdmin} onOpen={onOpen} onClose={() => setView('home')} />}
    </div>
  )
}
