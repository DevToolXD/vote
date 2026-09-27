import { doc, getDoc, getDocFromCache, onSnapshot, Timestamp, type Firestore, type Unsubscribe } from 'firebase/firestore'
import { onValue, ref, type Database } from 'firebase/database'
import { byRank } from './rank'
import type { CandidateRow } from './candidates'
import type { Season } from './types'

// meta/board: the whole leaderboard in one doc, kept up to date by the background worker
// (.github/scripts/send-notifications.mjs). Listening to every candidate doc cost one read
// per person each time the app opened; the board costs one. Photos aren't in it — each row
// has a photo "version" (pv), and a photo is fetched once per version and then comes from
// the on-device cache.

export type BoardRow = Omit<CandidateRow, 'photoURL'> & { pv: string }
/** Older than this (the worker rewrites it at least every 30 minutes): read candidates directly. */
export const BOARD_STALE_MS = 75 * 60_000

/** The board also carries meta/season and the notice list (undefined on a board from an older worker). */
export type BoardExtra = { season?: Season; notices?: string[] }

/** Same hash as the worker's photoVersion. */
export function photoVersion(s: string) {
  if (!s) return ''
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return s.length.toString(36) + '-' + h.toString(36)
}

/** rows = null when there is no board; `fromCache` answers can be old, so staleness is judged on server ones. */
export function subscribeBoard(db: Firestore, cb: (rows: BoardRow[] | null, at: number, fromCache: boolean, extra: BoardExtra) => void): Unsubscribe {
  return onSnapshot(doc(db, 'meta', 'board'), s => {
    const d = s.data({ serverTimestamps: 'estimate' })
    cb(d ? (d.rows as BoardRow[]) : null, d?.at?.toMillis?.() ?? 0, s.metadata.fromCache, { season: d?.season as Season | undefined, notices: d?.notices as string[] | undefined })
  }, () => cb(null, 0, false, {}))
}

/**
 * The same board in the Realtime Database (board/: rows/{id} and extra as JSON strings, at
 * in ms), which the worker keeps current on every change. Reading it costs no Firestore
 * reads at all, so it's the first choice; rows = null when it isn't there.
 */
export function subscribeLiveBoard(rtdb: Database, cb: (rows: BoardRow[] | null, at: number, extra: BoardExtra) => void): () => void {
  const revive = (_: string, v: unknown) => (v && typeof v === 'object' && typeof (v as { __ms?: unknown }).__ms === 'number' ? Timestamp.fromMillis((v as { __ms: number }).__ms) : v)
  return onValue(ref(rtdb, 'board'), s => {
    const d = s.val() as { rows?: Record<string, string>; extra?: string; at?: number } | null
    if (!d?.rows) { cb(null, 0, {}); return }
    try {
      const rows = Object.values(d.rows).map(j => JSON.parse(j, revive) as BoardRow).sort(byRank)
      const extra = d.extra ? JSON.parse(d.extra, revive) as { season?: Season | null; notices?: string[] } : {}
      cb(rows, d.at ?? 0, { season: extra.season ?? undefined, notices: extra.notices ?? [] })
    } catch { cb(null, 0, {}) }
  }, () => cb(null, 0, {}))
}

/** One candidate doc, live (my own: instant after my own changes, with my photo). */
export function subscribeCandidate(db: Firestore, uid: string, cb: (row: CandidateRow | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'candidates', uid), s => cb(s.exists() ? ({ id: s.id, ...s.data() } as CandidateRow) : null), () => {})
}

const photos = new Map<string, Promise<string>>()
/** A person's photo at version `pv`: from the device cache when it matches, else one read. */
export function photoOf(db: Firestore, uid: string, pv: string): Promise<string> {
  if (!pv) return Promise.resolve('')
  const k = uid + '@' + pv
  let p = photos.get(k)
  if (!p) {
    const ref = doc(db, 'candidates', uid)
    p = getDocFromCache(ref)
      .then(s => { const u = (s.get('photoURL') as string) ?? ''; if (photoVersion(u) !== pv) throw new Error('stale'); return u })
      .catch(() => getDoc(ref).then(s => (s.get('photoURL') as string) ?? ''))
    p.catch(() => photos.delete(k))
    photos.set(k, p)
  }
  return p
}
