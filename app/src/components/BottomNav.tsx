import { css, sx } from '../css'
import type { Tab } from '../data'

const TABS: [Tab, string][] = [['home', '홈'], ['acct', '계정'], ['rank', '랭킹']]

const icons: Record<Tab, JSX.Element> = {
  home: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10.6 3.5a2 2 0 0 1 2.8 0l6.9 6.4c.4.4.7 1 .7 1.5V19a2 2 0 0 1-2 2h-3.5a1 1 0 0 1-1-1v-4.5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1V20a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-7.6c0-.6.3-1.1.7-1.5z" /></svg>,
  acct: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3.5 19.5C3.5 15.9 7.3 14 12 14s8.5 1.9 8.5 5.5c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5z" /></svg>,
  rank: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="5" height="10" rx="1.5" /><rect x="9.5" y="4" width="5" height="17" rx="1.5" /><rect x="16" y="14" width="5" height="7" rx="1.5" /></svg>,
}

export function BottomNav({ tab, onGo }: { tab: Tab; onGo: (t: Tab) => void }) {
  const idx = TABS.findIndex(([k]) => k === tab)
  return (
    <nav data-g="nav" style={css('position:sticky;bottom:0;z-index:50;background:#ffffff;box-shadow:0 -0.5px 0 rgba(0,0,33,0.07);display:grid;grid-template-columns:repeat(3,1fr);padding-bottom:env(safe-area-inset-bottom)')}>
      {/* Sliding capsule — only visible in the glass theme. */}
      <span data-g="navpill" aria-hidden="true" style={sx('display:none;position:absolute;top:6px;bottom:6px;width:calc(33.333% - 12px);border-radius:24px;transition:left 520ms cubic-bezier(0.34,1.4,0.64,1)', { left: `calc(${idx * 33.333}% + 6px)` })} />
      {TABS.map(([k, l]) => (
        <button key={k} className="pr-96" onClick={() => onGo(k)} style={sx('height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:color 200ms,transform 150ms', { color: tab === k ? '#191f28' : '#b0b8c1' })}>
          {icons[k]}
          <span style={css('font-size:11px;line-height:14px;font-weight:500')}>{l}</span>
        </button>
      ))}
    </nav>
  )
}
