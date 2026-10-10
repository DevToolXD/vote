import type { ReactNode } from 'react'
import { css } from '../css'
import type { AppId } from '../backend/phone'
import appstorePng from '../assets/phone/appstore.png'
import daangnPng from '../assets/phone/daangn.png'
import upbitPng from '../assets/phone/upbit.png'
import stocksPng from '../assets/phone/stocks.png'

// 앱스토어, 당근마켓, 코인 and 주식 use the real pictures (rounded and cropped to an icon shape);
// 관리 and 상점 are drawn here.
const PICTURE: Partial<Record<AppId, string>> = { store: appstorePng, market: daangnPng, coin: upbitPng, stock: stocksPng }

type Tile = { top: string; bottom: string; ink?: string; scale: number; line?: number; glyph: ReactNode }

const TILE: Record<Exclude<AppId, 'store' | 'market' | 'coin' | 'stock'>, Tile> = {
  admin: { top: '#7f7de8', bottom: '#5856d6', scale: 0.54, glyph: <path d="M12 3.6 5.5 6v5.4c0 4 2.7 7.2 6.5 8.6 3.8-1.4 6.5-4.6 6.5-8.6V6zM9 12l2.2 2.2L15 10.4" /> },
  shop: { top: '#ff6a86', bottom: '#ff2d55', scale: 0.54, glyph: <><path d="M5.5 8.5h13l-1 11.5h-11z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /></> },
}

/** An app icon: a soft top-to-bottom shade of one colour, one glyph, 22.37% corners (iOS). */
export function AppIcon({ app, size = 60 }: { app: AppId; size?: number }) {
  const pic = PICTURE[app]
  if (pic) return <img src={pic} alt="" draggable={false} style={css(`flex:none;display:block;width:${size}px;height:${size}px;border-radius:${(size * 0.2237).toFixed(1)}px;box-shadow:0 0 0 0.5px rgba(0,0,0,0.12);object-fit:cover;pointer-events:none`)} />
  const t = TILE[app as keyof typeof TILE]
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
