import { useEffect, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, sx } from '../css'
import { presenceLabel, watchPresence, type Presence } from '../backend/presence'

/** Someone's 온라인 / N분 전 접속, live while shown. Nothing until it's known. */
export function PresenceText({ db, uid, size = 15, sep = false }: { db: Firestore | null; uid: string; size?: number; sep?: boolean }) {
  const [p, setP] = useState<Presence>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { setP(null); return db ? watchPresence(db, uid, setP) : undefined }, [db, uid])
  // "N분 전" moves on by itself (only while it's showing a time)
  useEffect(() => {
    if (!p || p.on) return
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [p])
  const label = presenceLabel(p, now)
  if (!label) return null
  return (
    <span style={sx('flex:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-weight:500', { fontSize: size, lineHeight: `${Math.round(size * 1.5)}px`, color: p?.on ? '#00a661' : '#8b95a1' })}>
      {sep && <span style={css('color:#b0b8c1;margin-right:1px')}>·</span>}
      {p?.on && <span aria-hidden style={css('width:7px;height:7px;border-radius:9999px;background:#03c75a;box-shadow:0 0 0 2px rgba(3,199,90,0.18)')} />}
      {label}
    </span>
  )
}
