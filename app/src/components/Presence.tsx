import { useEffect, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, sx } from '../css'
import { presenceLabel, watchPresence, type Presence } from '../backend/presence'

/** Someone's 온라인 / N분 전 접속 / 오프라인, live while shown (nothing while loading). */
export function PresenceText({ db, uid, size = 15, sep = false }: { db: Firestore | null; uid: string; size?: number; sep?: boolean }) {
  // undefined: still loading; null: never seen since 온라인 표시 started → 오프라인
  const [p, setP] = useState<Presence | undefined>(undefined)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { setP(undefined); return db ? watchPresence(db, uid, setP) : undefined }, [db, uid])
  // "N분 전" moves on by itself (only while it's showing a time)
  useEffect(() => {
    if (!p || p.on) return
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [p])
  if (p === undefined) return null
  const label = presenceLabel(p, now) ?? '오프라인'
  return (
    <span style={sx('flex:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-weight:500', { fontSize: size, lineHeight: `${Math.round(size * 1.5)}px`, color: p?.on ? '#191f28' : '#8b95a1' })}>
      {sep && <span style={css('color:#b0b8c1;margin-right:1px')}>·</span>}
      {label}
    </span>
  )
}

/** 단톡방: how many of the others are online right now ("2명 온라인"). */
export function GroupPresence({ db, uids, size = 14, sep = false }: { db: Firestore | null; uids: string[]; size?: number; sep?: boolean }) {
  const [on, setOn] = useState<Record<string, boolean>>({})
  const key = uids.slice(0, 50).join(',')
  useEffect(() => {
    setOn({})
    if (!db || !key) return
    const stops = key.split(',').map(u => watchPresence(db, u, p => setOn(o => (o[u] === !!p?.on ? o : { ...o, [u]: !!p?.on }))))
    return () => stops.forEach(s => s())
  }, [db, key])
  const n = Object.values(on).filter(Boolean).length
  return (
    <span style={sx('flex:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-weight:500', { fontSize: size, lineHeight: `${Math.round(size * 1.5)}px`, color: n ? '#191f28' : '#8b95a1' })}>
      {sep && <span style={css('color:#b0b8c1;margin-right:1px')}>·</span>}
      {n ? `${n}명 온라인` : '모두 오프라인'}
    </span>
  )
}
