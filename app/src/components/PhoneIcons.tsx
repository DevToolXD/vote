import type { ReactNode } from 'react'
import { css } from '../css'
import type { AppId } from '../backend/phone'

// App icons for 폰. 당근마켓 and 앱스토어 are drawn after the real icons (orange tile with a white
// carrot; blue tile with the white "A" made of three tools); the rest are this app's own.

type Tile = { top: string; bottom: string; ink?: string; scale: number; line?: number; glyph: ReactNode }

const TILE: Record<AppId, Tile> = {
  admin: { top: '#7f7de8', bottom: '#5856d6', scale: 0.54, glyph: <path d="M12 3.6 5.5 6v5.4c0 4 2.7 7.2 6.5 8.6 3.8-1.4 6.5-4.6 6.5-8.6V6zM9 12l2.2 2.2L15 10.4" /> },
  shop: { top: '#ff6a86', bottom: '#ff2d55', scale: 0.54, glyph: <><path d="M5.5 8.5h13l-1 11.5h-11z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /></> },
  coin: { top: '#ffe35c', bottom: '#ffc700', ink: '#191f28', scale: 0.54, glyph: <><circle cx="12" cy="12" r="7.5" /><path d="M10.2 16.4V7.6h2.7a2.4 2.4 0 0 1 0 4.8h-2.7" /></> },
  // 당근마켓: orange, a white carrot with two green leaves
  market: {
    top: '#ff8a3d', bottom: '#ff6f0f', scale: 0.7,
    glyph: (
      <>
        <path d="M12 21.2C8 17.2 6.4 14.3 6.4 11.6a5.6 5.6 0 0 1 11.2 0c0 2.7-1.6 5.6-5.6 9.6z" fill="#fff" stroke="none" />
        <path d="M12 6.4C11.6 4.4 10.2 3 8.2 2.7c.1 2.1 1.4 3.4 3.8 3.7zM12 6.4c.4-2 1.8-3.4 3.8-3.7-.1 2.1-1.4 3.4-3.8 3.7z" fill="#5fcf80" stroke="none" />
      </>
    ),
  },
  // 앱스토어: blue, the white "A" built from a brush, a pencil and a ruler
  store: {
    top: '#1ec9ff', bottom: '#0a6cf5', scale: 0.66, line: 2.3,
    glyph: (
      <>
        <path d="M14.4 5.2 19.2 15.8" />
        <path d="M9.6 5.2 4.8 15.8" />
        <path d="M7 12.8h10" />
        <path d="M4.2 18.8h6.2" />
      </>
    ),
  },
}

/** An app icon: a soft top-to-bottom shade of one colour, one glyph, 22.37% corners (iOS). */
export function AppIcon({ app, size = 60 }: { app: AppId; size?: number }) {
  const t = TILE[app]
  return (
    <span style={css(`flex:none;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${(size * 0.2237).toFixed(1)}px;background:linear-gradient(180deg,${t.top},${t.bottom});box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.28)`)}>
      <svg width={size * t.scale} height={size * t.scale} viewBox="0 0 24 24" fill="none" stroke={t.ink ?? '#fff'} strokeWidth={t.line ?? 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.glyph}</svg>
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
