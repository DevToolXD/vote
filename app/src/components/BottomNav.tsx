import { css, sx } from '../css'
import type { Tab } from '../data'

// Five tabs: Spotify · 인스타그램 · 홈 (랭킹, 게임, 공지, and 계정 from the profile) · 메시지 · 돈 (은행, 투자, 상점).
const TABS: [Tab, string][] = [['spotify', 'Spotify'], ['insta', '인스타그램'], ['rank', '홈'], ['msg', '메시지'], ['money', '돈']]

const icons: Partial<Record<Tab, JSX.Element>> = {
  spotify: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.2" /><path d="M7 9.6c3.6-1 7.4-.7 10.4 1" /><path d="M7.6 12.8c3-.8 6.2-.5 8.7.9" /><path d="M8.3 15.8c2.4-.5 4.7-.3 6.7.7" /></svg>,
  insta: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.9" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>,
  rank: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 11 12 3.8l8.5 7.2" /><path d="M5.5 9.7V20h13V9.7" /><path d="M10 20v-5.5h4V20" /></svg>,
  msg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round"><path d="M22 3 9.218 10.083" /><path d="M11.698 20.334 22 3.001H2l7.218 7.083z" /></svg>,
  money: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="3.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" /></svg>,
}

/** The five tabs. `unread` badges 메시지; the admin's open tickets badge 홈 (관리 is inside 계정). Dark over Spotify. */
export function BottomNav({ tab, onGo, isAdmin = false, unread = 0, adminUnread = 0 }: { tab: Tab; onGo: (t: Tab) => void; isAdmin?: boolean; unread?: number; adminUnread?: number }) {
  const tabs = TABS
  const dark = tab === 'spotify'
  const idx = tabs.findIndex(([k]) => k === tab)
  const w = 100 / tabs.length
  return (
    // A normal row under the scrolling <main> (not fixed or sticky): it can't float mid-screen.
    <nav data-g="nav" style={sx('position:relative;flex:none;z-index:50;transition:background 350ms,box-shadow 350ms;display:grid;padding-bottom:env(safe-area-inset-bottom)', { gridTemplateColumns: `repeat(${tabs.length},1fr)`, background: dark ? '#121212' : '#ffffff', boxShadow: dark ? '0 -0.5px 0 rgba(255,255,255,0.08)' : '0 -0.5px 0 rgba(0,0,33,0.07)' })}>
      {/* Sliding capsule — only visible in the glass theme. */}
      <span data-g="navpill" aria-hidden="true" style={sx('display:none;position:absolute;top:6px;bottom:6px;border-radius:24px;transition:left 520ms cubic-bezier(0.34,1.4,0.64,1)', { width: `calc(${w}% - 12px)`, left: `calc(${idx * w}% + 6px)` })} />
      {tabs.map(([k, l]) => (
        <button key={k} className="pr-96" onClick={() => onGo(k)} style={sx('height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:color 200ms,transform 150ms', { color: tab === k ? (dark ? '#ffffff' : '#191f28') : (dark ? '#6a6a6a' : '#b0b8c1') })}>
          <span style={sx('position:relative;display:flex;transition:transform 420ms cubic-bezier(0.34,1.56,0.64,1)', { transform: tab === k ? 'scale(1.1)' : 'scale(1)' })}>
            {icons[k]}
            {(k === 'msg' ? unread : k === 'rank' && isAdmin ? adminUnread : 0) > 0 && (
              <span aria-label={`읽지 않은 대화 ${k === 'msg' ? unread : adminUnread}개`} style={css('position:absolute;top:-5px;left:14px;min-width:18px;height:18px;padding:0 5px;border-radius:9999px;background:#f04452;color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;box-shadow:0 0 0 2px #fff')}>{(k === 'msg' ? unread : adminUnread) > 99 ? '99+' : (k === 'msg' ? unread : adminUnread)}</span>
            )}
          </span>
          <span style={css('font-size:11px;line-height:14px;font-weight:500')}>{l}</span>
        </button>
      ))}
    </nav>
  )
}
