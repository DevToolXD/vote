import { css, sx } from '../css'
import type { Tab } from '../data'

const BASE_TABS: [Tab, string][] = [['home', '홈'], ['acct', '계정'], ['rank', '랭킹'], ['msg', '메시지']]
const ADMIN_TAB: [Tab, string] = ['admin', '관리']

const icons: Record<Tab, JSX.Element> = {
  home: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10.6 3.5a2 2 0 0 1 2.8 0l6.9 6.4c.4.4.7 1 .7 1.5V19a2 2 0 0 1-2 2h-3.5a1 1 0 0 1-1-1v-4.5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1V20a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-7.6c0-.6.3-1.1.7-1.5z" /></svg>,
  acct: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3.5 19.5C3.5 15.9 7.3 14 12 14s8.5 1.9 8.5 5.5c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5z" /></svg>,
  rank: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="5" height="10" rx="1.5" /><rect x="9.5" y="4" width="5" height="17" rx="1.5" /><rect x="16" y="14" width="5" height="7" rx="1.5" /></svg>,
  msg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round"><path d="M22 3 9.218 10.083" /><path d="M11.698 20.334 22 3.001H2l7.218 7.083z" /></svg>,
  admin: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5 4.5 5.3v5.9c0 4.6 3.1 8.8 7.5 10.3 4.4-1.5 7.5-5.7 7.5-10.3V5.3z" /><path d="m8.6 12 2.4 2.4 4.4-4.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
}

/** 홈 · 계정 · 랭킹 · 메시지, plus 관리 for the admin. `unread` badges 메시지. */
export function BottomNav({ tab, onGo, isAdmin = false, unread = 0, adminUnread = 0 }: { tab: Tab; onGo: (t: Tab) => void; isAdmin?: boolean; unread?: number; adminUnread?: number }) {
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS
  const idx = tabs.findIndex(([k]) => k === tab)
  const w = 100 / tabs.length
  return (
    <nav data-g="nav" style={sx('position:sticky;bottom:0;z-index:50;background:#ffffff;box-shadow:0 -0.5px 0 rgba(0,0,33,0.07);display:grid;padding-bottom:env(safe-area-inset-bottom)', { gridTemplateColumns: `repeat(${tabs.length},1fr)` })}>
      {/* Sliding capsule — only visible in the glass theme. */}
      <span data-g="navpill" aria-hidden="true" style={sx('display:none;position:absolute;top:6px;bottom:6px;border-radius:24px;transition:left 520ms cubic-bezier(0.34,1.4,0.64,1)', { width: `calc(${w}% - 12px)`, left: `calc(${idx * w}% + 6px)` })} />
      {tabs.map(([k, l]) => (
        <button key={k} className="pr-96" onClick={() => onGo(k)} style={sx('height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:color 200ms,transform 150ms', { color: tab === k ? '#191f28' : '#b0b8c1' })}>
          <span style={css('position:relative;display:flex')}>
            {icons[k]}
            {(k === 'msg' ? unread : k === 'admin' ? adminUnread : 0) > 0 && (
              <span aria-label={`읽지 않은 대화 ${k === 'msg' ? unread : adminUnread}개`} style={css('position:absolute;top:-5px;left:14px;min-width:18px;height:18px;padding:0 5px;border-radius:9999px;background:#f04452;color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;box-shadow:0 0 0 2px #fff')}>{(k === 'msg' ? unread : adminUnread) > 99 ? '99+' : (k === 'msg' ? unread : adminUnread)}</span>
            )}
          </span>
          <span style={css('font-size:11px;line-height:14px;font-weight:500')}>{l}</span>
        </button>
      ))}
    </nav>
  )
}
