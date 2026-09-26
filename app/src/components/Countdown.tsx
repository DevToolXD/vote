import { useEffect, useState } from 'react'
import { css } from '../css'

/** "2일 3시간 4분 5초 남았어요", ticking every second. */
export function Countdown({ to }: { to: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const left = Math.max(0, to - now)
  const s = Math.floor(left / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const text = left <= 0 ? '곧 끝나요' : `${d ? `${d}일 ` : ''}${d || h ? `${h}시간 ` : ''}${m}분 ${sec}초 남았어요`
  return <span aria-live="off" style={css('font-variant-numeric:tabular-nums;color:#3182f6')}>{text}</span>
}
