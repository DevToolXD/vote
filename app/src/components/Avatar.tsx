import { memo, type CSSProperties } from 'react'
import { AVATAR_ART } from './avatarArt'
import { AURA_AVATAR } from './auraArt'
import { MATRIX_AVATAR } from './matrixArt'
import { KOREA_AVATAR } from './koreaArt'
import { pauseOffscreen } from '../offscreen'

type Props = {
  frame?: string
  /** CSS background-image value, e.g. `url(blob:…)`, or 'none'. */
  photo?: string
  size: number
  style?: CSSProperties
  /** Always the full 레전드 art, even small (the chat room: profile pictures next to messages). */
  full?: boolean
}

// Small avatars (rank chart, lists, chat rows) show the 레전드 frames as one light ring: the
// full art (rain, cubes, fireworks …) is dozens of animated layers per avatar, which is what
// made screens with many small avatars lag — and at 20–40px the detail can't be seen anyway.
const ringMask = (a: number, b: number) => `-webkit-mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 2}%,#000 ${b}%,transparent ${b + 2}%);mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 2}%,#000 ${b}%,transparent ${b + 2}%)`
const LITE_ART: Record<string, { before?: string; after?: string }> = {
  aura: { before: `<div style="position:absolute;inset:-12%;border-radius:50%;background:conic-gradient(#ffe27a,#ff4fd8,#7b3cff,#22e1ff,#7b3cff,#ff4fd8,#ffe27a);${ringMask(80, 97)};animation:avSpin 2.4s linear infinite"></div>` },
  matrix: { before: `<div style="position:absolute;inset:-12%;border-radius:50%;background:#000;${ringMask(78, 98)}"></div><div style="position:absolute;inset:-12%;border-radius:50%;background:conic-gradient(#00ff41,#0a5c1f 30%,#00ff41 50%,#0a5c1f 80%,#00ff41);${ringMask(82, 94)};animation:avSpin 3s linear infinite"></div>` },
  korea: { before: `<div style="position:absolute;inset:-12%;border-radius:50%;background:#f2c75c;${ringMask(78, 98)}"></div><div style="position:absolute;inset:-12%;border-radius:50%;background:conic-gradient(#cd2e3a 0 50%,#0047a0 50% 100%);${ringMask(82, 94)};animation:avSpin 4s linear infinite"></div>` },
}
const LITE_BELOW = 48

/** Profile photo with a Discord-style decoration frame that can overflow the circle. */
export const Avatar = memo(function Avatar({ frame = 'none', photo = 'none', size, style, full: alwaysFull }: Props) {
  const full = frame === 'aura' ? AURA_AVATAR : frame === 'matrix' ? MATRIX_AVATAR : frame === 'korea' ? KOREA_AVATAR : AVATAR_ART[frame]
  const art = !alwaysFull && size < LITE_BELOW && LITE_ART[frame] ? LITE_ART[frame] : full
  const hasPhoto = !!photo && photo !== 'none'
  const innerRing = frame === 'none' || frame === 'cat' || frame === 'bunny' || frame === 'matrix' || frame === 'korea' ? 'none' : '0 0 0 1px rgba(255,255,255,0.9)'
  return (
    <div className="av-host" ref={art ? pauseOffscreen : undefined} style={{ width: size, height: size, ['--av' as string]: `${size}px`, ...style }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
        {art?.before && <div className="av-art" dangerouslySetInnerHTML={{ __html: art.before }} />}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', background: '#dbdbdb', boxShadow: innerRing }}>
          {hasPhoto ? (
            <div style={{ width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: photo }} />
          ) : (
            <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ display: 'block' }}>
              <circle cx="12" cy="9.6" r="4.3" fill="#ffffff" />
              <path d="M3.2 23c.9-4.9 4.5-7.4 8.8-7.4s7.9 2.5 8.8 7.4z" fill="#ffffff" />
            </svg>
          )}
        </div>
        {art?.after && <div className="av-art" dangerouslySetInnerHTML={{ __html: art.after }} />}
      </div>
    </div>
  )
})
