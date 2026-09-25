import { useEffect, useRef, useState } from 'react'
import { css } from '../css'
import type { Person } from '../model'
import { Avatar } from './Avatar'

// In-app message popup: while the app is open, a new message drops in from the
// top like a phone notification (who sent it, what they said). Tap to open the
// chat, swipe up to dismiss; it goes away by itself after a few seconds.

export type Banner = { key: string; chatId: string; title: string; text: string; sender?: Person; photo?: string }

const EASE = 'cubic-bezier(0.16,1,0.3,1)'

export function MessageBanner({ banner, onOpen, onDone }: { banner: Banner; onOpen: (chatId: string) => void; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const startY = useRef<number | null>(null)
  const [dy, setDy] = useState(0)

  useEffect(() => {
    setLeaving(false); setDy(0)
    try { navigator.vibrate?.([60, 40, 60]) } catch { /* not supported */ }
    const t = setTimeout(() => setLeaving(true), 4500)
    return () => clearTimeout(t)
  }, [banner.key])
  useEffect(() => { if (leaving) { const t = setTimeout(onDone, 260); return () => clearTimeout(t) } }, [leaving]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={css('position:fixed;left:0;right:0;top:0;z-index:450;display:flex;justify-content:center;pointer-events:none;padding:calc(8px + env(safe-area-inset-top)) 8px 0')}>
      <button
        key={banner.key}
        role="alert"
        onClick={() => { onOpen(banner.chatId); setLeaving(true) }}
        onPointerDown={e => { startY.current = e.clientY }}
        onPointerMove={e => { if (startY.current !== null) setDy(Math.min(0, e.clientY - startY.current)) }}
        onPointerUp={() => { if (dy < -30) setLeaving(true); startY.current = null; setDy(0) }}
        style={{
          ...css(`pointer-events:auto;width:100%;max-width:414px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:20px;background:rgba(255,255,255,0.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 8px 28px rgba(0,0,0,0.16),0 0 0 0.5px rgba(0,0,33,0.06);text-align:left;touch-action:none`),
          transform: leaving ? 'translateY(-130%)' : `translateY(${dy}px)`,
          transition: startY.current !== null ? 'none' : `transform 260ms ${EASE}, opacity 260ms ${EASE}`,
          opacity: leaving ? 0 : 1,
          animation: `bannerIn 420ms ${EASE} both`,
        }}
      >
        {banner.photo
          ? <span style={{ ...css('width:40px;height:40px;flex:none;border-radius:9999px;background-size:cover;background-position:center'), backgroundImage: `url(${banner.photo})` }} />
          : <Avatar frame={banner.sender?.frame} photo={banner.sender?.photoCss} size={40} style={{ flex: 'none' }} />}
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:1px')}>
          <span style={css('display:flex;align-items:center;gap:6px')}>
            <span style={css('font-size:15px;line-height:21px;font-weight:700;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{banner.title}</span>
            <span style={css('flex:none;font-size:12px;color:#8b95a1')}>지금</span>
          </span>
          <span style={css('font-size:14px;line-height:20px;color:#4e5968;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all')}>{banner.text}</span>
        </span>
      </button>
    </div>
  )
}
