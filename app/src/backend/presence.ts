import { onDisconnect, onValue, ref, serverTimestamp, set } from 'firebase/database'
import type { Firestore } from 'firebase/firestore'
import { R } from './messages'

// 온라인 표시 (Realtime Database — no Firestore reads):
//   status/{uid}  { on: true | false, last: when they were last seen (server ms) }
// On while the app is open and on screen; the server flips it off by itself when the
// connection drops (app closed, network gone), the app does when it goes to the background.
// Anyone signed in can read one; only its owner writes it.

export type Presence = { on: boolean; last: number } | null

export function startPresence(db: Firestore, uid: string): () => void {
  const rdb = R(db)
  const me = ref(rdb, `status/${uid}`)
  const off = () => ({ on: false, last: serverTimestamp() })
  const on = () => ({ on: true, last: serverTimestamp() })
  const visible = () => document.visibilityState !== 'hidden'
  let connected = false
  const stopConn = onValue(ref(rdb, '.info/connected'), s => {
    connected = s.val() === true
    if (!connected) return
    // registered first, so a drop right after going online still ends as offline
    onDisconnect(me).set(off()).then(() => set(me, visible() ? on() : off())).catch(() => {})
  })
  const onVis = () => { if (connected) set(me, visible() ? on() : off()).catch(() => {}) }
  document.addEventListener('visibilitychange', onVis)
  return () => {
    stopConn()
    document.removeEventListener('visibilitychange', onVis)
    set(me, off()).catch(() => {})
    onDisconnect(me).cancel().catch(() => {})
  }
}

/** Someone's status, live; only while a profile or chat shows it. */
export function watchPresence(db: Firestore, uid: string, cb: (p: Presence) => void): () => void {
  return onValue(ref(R(db), `status/${uid}`), s => {
    const v = s.val()
    cb(v && typeof v.on === 'boolean' && typeof v.last === 'number' ? v : null)
  }, () => cb(null))
}

/** 온라인 / 5분 전 접속 / 어제 접속 … ; null when it's not known. */
export function presenceLabel(p: Presence, now = Date.now()): string | null {
  if (!p) return null
  if (p.on) return '온라인'
  const m = Math.floor(Math.max(0, now - p.last) / 60_000)
  if (m < 1) return '방금 전 접속'
  if (m < 60) return `${m}분 전 접속`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전 접속`
  const d = Math.floor(h / 24)
  if (d < 7) return d === 1 ? '어제 접속' : `${d}일 전 접속`
  const t = new Date(p.last)
  return `${t.getMonth() + 1}월 ${t.getDate()}일 접속`
}
