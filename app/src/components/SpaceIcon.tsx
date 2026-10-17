import { css } from '../css'

/** The ship's icon in 게임 (a black tile with the ring). */
export function SpaceIcon({ size = 60 }: { size?: number }) {
  return (
    <span style={css(`flex:none;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${(size * 0.2237).toFixed(1)}px;background:radial-gradient(circle at 50% 45%,#222a40 0%,#000 72%);box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.18)`)}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <rect key={i} x="10.8" y="2.6" width="2.4" height="4.2" rx="0.5" fill="#c9d3e3" transform={`rotate(${i * 30} 12 12)`} />)}
        <circle cx="12" cy="12" r="1.8" fill="#7fb2ff" />
      </svg>
    </span>
  )
}
