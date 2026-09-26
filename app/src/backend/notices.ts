import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Firestore, type Timestamp, type Unsubscribe } from 'firebase/firestore'
import { runAdminOp, type AdminProgress } from './admin'

// 공지: the admin posts a notice; everyone signed in sees it full-screen once.
// firestore.rules refuses to hand out a notice someone already marked as seen.

export type Notice = { id: string; title: string; body: string; by?: string; createdAt: Timestamp | null }
export const MAX_NOTICE_TITLE = 40
export const MAX_NOTICE_BODY = 2000

/** Admin: posts a notice (3-token op) and puts it first in meta/noticeIndex. */
export async function postNotice(db: Firestore, adminUid: string, title: string, body: string, onProgress?: (p: AdminProgress) => void) {
  const t = title.trim(), b = body.trim()
  if (!t || t.length > MAX_NOTICE_TITLE || !b || b.length > MAX_NOTICE_BODY) throw new Error('invalid-notice')
  const id = doc(collection(db, 'notices')).id
  const idx = await getDoc(doc(db, 'meta', 'noticeIndex'))
  const ids = [id, ...((idx.data()?.ids as string[] | undefined) ?? [])].slice(0, 20)
  await runAdminOp(db, adminUid, 'postNotice', { id, title: t, body: b }, [
    w => { w.set(doc(db, 'notices', id), { title: t, body: b, by: adminUid, createdAt: serverTimestamp() }); w.set(doc(db, 'meta', 'noticeIndex'), { ids }); return 2 },
  ], onProgress)
  return id
}

/** Calls back with the notice ids that exist (newest first), live. */
export function subscribeNoticeIndex(db: Firestore, cb: (ids: string[]) => void): Unsubscribe {
  return onSnapshot(doc(db, 'meta', 'noticeIndex'), s => cb((s.data()?.ids as string[] | undefined) ?? []), () => cb([]))
}

/** The oldest notice I haven't seen yet among `ids`, or null. */
export async function nextUnseenNotice(db: Firestore, uid: string, ids: string[]): Promise<Notice | null> {
  const reads = await getDoc(doc(db, 'noticeReads', uid)).catch(() => null)
  const seen = (reads?.data()?.seen ?? {}) as Record<string, boolean>
  for (const id of [...ids].reverse()) {
    if (seen[id]) continue
    try {
      const s = await getDoc(doc(db, 'notices', id))
      if (!s.exists()) continue
      const n = { id, ...(s.data() as Omit<Notice, 'id'>) }
      // The person who posted it doesn't need to read it back.
      if (n.by === uid) { await markNoticeSeen(db, uid, id).catch(() => {}); continue }
      return n
    } catch { /* already seen (refused) or gone */ }
  }
  return null
}

export async function markNoticeSeen(db: Firestore, uid: string, id: string) {
  await setDoc(doc(db, 'noticeReads', uid), { seen: { [id]: true } }, { merge: true })
}
