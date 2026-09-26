import { doc, getDoc, getDocFromCache, onSnapshot, type Firestore, type Unsubscribe } from 'firebase/firestore'
import type { CandidateRow } from './candidates'

// meta/board: the whole leaderboard in one doc, kept up to date by the background worker
// (.github/scripts/send-notifications.mjs). Listening to every candidate doc cost one read
// per person each time the app opened; the board costs one. Photos aren't in it — each row
// has a photo "version" (pv), and a photo is fetched once per version and then comes from
// the on-device cache.

export type BoardRow = Omit<CandidateRow, 'photoURL'> & { pv: string }
/** Older than this (the worker rewrites it at least every 20 minutes): read candidates directly. */
export const BOARD_STALE_MS = 45 * 60_000

/** Same hash as the worker's photoVersion. */
export function photoVersion(s: string) {
  if (!s) return ''
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return s.length.toString(36) + '-' + h.toString(36)
}

/** rows = null when there is no board; `fromCache` answers can be old, so staleness is judged on server ones. */
export function subscribeBoard(db: Firestore, cb: (rows: BoardRow[] | null, at: number, fromCache: boolean) => void): Unsubscribe {
  return onSnapshot(doc(db, 'meta', 'board'), s => {
    const d = s.data({ serverTimestamps: 'estimate' })
    cb(d ? (d.rows as BoardRow[]) : null, d?.at?.toMillis?.() ?? 0, s.metadata.fromCache)
  }, () => cb(null, 0, false))
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
