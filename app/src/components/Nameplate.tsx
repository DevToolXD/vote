import { memo, type CSSProperties } from 'react'
import type React from 'react'
import { css } from '../css'
import { Avatar } from './Avatar'
import { PLATE_ART } from './plateArt'

const PLATES: Record<string, { bg: string; fg: string; sub: string; dark: boolean }> = {
  none: { bg: '#f2f4f6', fg: '#191f28', sub: '#6b7684', dark: false },
  neon: { bg: 'linear-gradient(90deg,#07081a 0%,#0d0f2b 45%,#1c0b3d 100%)', fg: '#ffffff', sub: '#9fe9ff', dark: true },
  crown: { bg: 'linear-gradient(90deg,#2a0612 0%,#5c0f2a 55%,#8a1c3c 100%)', fg: '#ffe7a3', sub: '#f5c88a', dark: true },
  sakura: { bg: 'linear-gradient(90deg,#fff3f7 0%,#ffe0ea 55%,#ffc9da 100%)', fg: '#7a1f3d', sub: '#b0506f', dark: false },
  cat: { bg: 'linear-gradient(90deg,#1f2024 0%,#2b2d31 55%,#3c3f47 100%)', fg: '#ffffff', sub: '#c7c9d1', dark: true },
  stars: { bg: 'linear-gradient(90deg,#0b0826 0%,#1d1552 55%,#2d1f7a 100%)', fg: '#ffffff', sub: '#c9c0ff', dark: true },
  flame: { bg: 'linear-gradient(90deg,#140400 0%,#3a0c00 50%,#6a1800 100%)', fg: '#ffe2c2', sub: '#ffb37a', dark: true },
  ocean: { bg: 'linear-gradient(90deg,#021a2b 0%,#064b6b 60%,#0b7fa0 100%)', fg: '#ffffff', sub: '#bff6ff', dark: true },
  bunny: { bg: 'linear-gradient(90deg,#fff8fa 0%,#ffeaf1 55%,#ffdbe7 100%)', fg: '#6b2a45', sub: '#a8577a', dark: false },
  halo: { bg: 'linear-gradient(90deg,#fffdf6 0%,#fff5d9 60%,#ffeab0 100%)', fg: '#5b4510', sub: '#8a6d1f', dark: false },
  devil: { bg: 'linear-gradient(90deg,#120002 0%,#3a0008 60%,#6b0012 100%)', fg: '#ffd1d1', sub: '#ff8a8a', dark: true },
  butterfly: { bg: 'linear-gradient(90deg,#f6f2ff 0%,#e8ecff 60%,#dff5ff 100%)', fg: '#3b2a78', sub: '#6a58b0', dark: false },
}

type Props = {
  kind?: string
  person: string
  sub?: string
  frame?: string
  photo?: string
  showAvatar?: boolean
  style?: CSSProperties
}

/** Animated name tag (name + bio line) themed to match the avatar frames. */
export const Nameplate = memo(function Nameplate({ kind = 'none', person, sub, frame = 'none', photo = 'none', showAvatar = true, style }: Props) {
  const k = PLATES[kind] ? kind : 'none'
  const p = PLATES[k]
  const shadow = p.dark ? '0 1px 2px rgba(0,0,0,0.45)' : 'none'
  const edge = p.dark
    ? 'inset 0 0 0 1px rgba(255,255,255,0.12),inset 0 1px 0 rgba(255,255,255,0.14)'
    : 'inset 0 0 0 1px rgba(0,0,0,0.05),inset 0 1px 0 rgba(255,255,255,0.8)'
  const art = PLATE_ART[k]?.before
  return (
    <div style={{ display: 'block', ...style }}>
      <div style={{ ...css('position:relative;width:100%;height:100%;border-radius:14px;overflow:hidden;isolation:isolate'), background: p.bg }}>
        {art && <div className="av-art" dangerouslySetInnerHTML={{ __html: art }} />}
        {k !== 'none' && (
          <div style={css('position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.22),rgba(255,255,255,0));animation:npShine 5s ease-in-out infinite;pointer-events:none')} />
        )}
        <div style={css('position:relative;z-index:1;height:100%;display:flex;align-items:center;gap:10px;padding:0 14px')}>
          {showAvatar && (
            <span style={css('width:34px;height:34px;flex:none;margin:0 2px')}>
              <Avatar frame={frame} photo={photo} size={34} />
            </span>
          )}
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
            <span style={{ ...css('font-size:16px;line-height:22px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), color: p.fg, textShadow: shadow }}>{person}</span>
            {sub && (
              <span style={{ ...css('font-size:12px;line-height:17px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), color: p.sub, textShadow: shadow }}>{sub}</span>
            )}
          </span>
        </div>
        <div style={{ ...css('position:absolute;inset:0;border-radius:14px;pointer-events:none;z-index:2'), boxShadow: edge }} />
      </div>
    </div>
  )
})

/**
 * The nameplate art as a profile banner: full strength at the top, fading to
 * transparent toward the bottom, with the name and bio on it. Without a
 * nameplate it falls back to the frame's banner colours.
 */
export function PlateBanner({ kind = 'none', fallback, name, sub, height, children }: { kind?: string; fallback: string; name: string; sub: string; height: number; children?: React.ReactNode }) {
  const k = PLATES[kind] ? kind : 'none'
  const p = PLATES[k]
  const art = k !== 'none' ? PLATE_ART[k]?.before : undefined
  const fade = 'linear-gradient(180deg,#000 0%,#000 42%,rgba(0,0,0,0.55) 72%,rgba(0,0,0,0) 100%)'
  const dark = k !== 'none' ? p.dark : false
  const shadow = dark ? '0 1px 3px rgba(0,0,0,0.45)' : '0 1px 2px rgba(255,255,255,0.6)'
  return (
    <div style={{ position: 'relative', height }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', isolation: 'isolate', background: k !== 'none' ? p.bg : fallback, WebkitMaskImage: fade, maskImage: fade }}>
        {art && <div className="av-art" dangerouslySetInnerHTML={{ __html: art }} />}
        {k !== 'none' && <div style={css('position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.22),rgba(255,255,255,0));animation:npShine 5s ease-in-out infinite;pointer-events:none')} />}
      </div>
      <div style={css('position:absolute;left:140px;right:64px;top:34px;display:flex;flex-direction:column;gap:2px;min-width:0')}>
        <span style={{ ...css('font-size:22px;line-height:30px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), color: k !== 'none' ? p.fg : '#191f28', textShadow: shadow }}>{name}</span>
        <span style={{ ...css('font-size:13px;line-height:19px;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all'), color: k !== 'none' ? p.sub : '#4e5968', textShadow: shadow }}>{sub}</span>
      </div>
      {children}
    </div>
  )
}
