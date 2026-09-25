import {
  arrayUnion,
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import type { ItemKind, Vote } from '../data'
import { db } from '../firebase'
import type { CandidateDoc, VoteDoc } from './types'

export type CandidateRow = CandidateDoc & { id: string }

/** Live leaderboard, highest score first. */
export function subscribeCandidates(cb: (rows: CandidateRow[]) => void): Unsubscribe {
  if (!db) return () => {}
  const q = query(collection(db, 'candidates'), orderBy('score', 'desc'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as CandidateDoc) }))))
}

/** The signed-in voter's own votes, as { candidateId: value }. */
export function subscribeMyVotes(uid: string, cb: (votes: Record<string, Vote>) => void): Unsubscribe {
  if (!db) return () => {}
  const q = query(collection(db, 'votes'), where('uid', '==', uid))
  return onSnapshot(q, snap => {
    const out: Record<string, Vote> = {}
    snap.forEach(d => { out[(d.data() as VoteDoc).candidateId] = (d.data() as VoteDoc).value })
    cb(out)
  })
}

/** Casts, changes, or cancels a vote. Reads the current server state in a transaction so concurrent voters can't corrupt the tally. */
export async function castVote(myUid: string, candidateId: string, dir: 1 | -1): Promise<Vote> {
  if (!db) throw new Error('firebase-not-configured')
  if (candidateId === myUid) throw new Error('cannot-vote-self')
  const voteRef = doc(db, 'votes', `${myUid}_${candidateId}`)
  const candidateRef = doc(db, 'candidates', candidateId)
  return runTransaction(db, async tx => {
    const [voteSnap, candSnap] = await Promise.all([tx.get(voteRef), tx.get(candidateRef)])
    if (!candSnap.exists()) throw new Error('candidate-not-found')
    const cur = (voteSnap.data() as VoteDoc | undefined)?.value ?? 0
    const next: Vote = cur === dir ? 0 : dir
    const du = (next === 1 ? 1 : 0) - (cur === 1 ? 1 : 0)
    const dd = (next === -1 ? 1 : 0) - (cur === -1 ? 1 : 0)
    const c = candSnap.data() as CandidateDoc
    tx.set(voteRef, { uid: myUid, candidateId, value: next, updatedAt: serverTimestamp() })
    tx.update(candidateRef, { up: c.up + du, down: c.down + dd, score: c.up + du - (c.down + dd) })
    return next
  })
}

/** Equips an already-owned item. */
export async function equipItem(myUid: string, kind: ItemKind, key: string) {
  if (!db) throw new Error('firebase-not-configured')
  await updateDoc(doc(db, 'candidates', myUid), { [kind]: key })
}

/** Buys and equips a locked item; `price` must match data.ts's priceOf so spend and points stay consistent. */
export async function buyItem(myUid: string, kind: ItemKind, key: string, price: number) {
  if (!db) throw new Error('firebase-not-configured')
  await updateDoc(doc(db, 'candidates', myUid), {
    [`owned.${kind}`]: arrayUnion(key),
    [kind]: key,
    spent: increment(price),
  })
}

export async function updateMyProfile(myUid: string, patch: { bio?: string; gender?: string; photoURL?: string }) {
  if (!db) throw new Error('firebase-not-configured')
  await updateDoc(doc(db, 'candidates', myUid), patch)
}
