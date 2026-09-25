import { memo, type CSSProperties } from 'react'
import { AVATAR_ART } from './avatarArt'

type Props = {
  frame?: string
  /** CSS background-image value, e.g. `url(blob:…)`, or 'none'. */
  photo?: string
  size: number
  style?: CSSProperties
}

/** Profile photo with a Discord-style decoration frame that can overflow the circle. */
export const Avatar = memo(function Avatar({ frame = 'none', photo = 'none', size, style }: Props) {
  const art = AVATAR_ART[frame]
  const hasPhoto = !!photo && photo !== 'none'
  const innerRing = frame === 'none' || frame === 'cat' || frame === 'bunny' ? 'none' : '0 0 0 1px rgba(255,255,255,0.9)'
  return (
    <div className="av-host" style={{ width: size, height: size, ...style }}>
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
