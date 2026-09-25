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
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import type { ItemKind } from '../data'
import { UP_EVERY_MS, type CandidateDoc, type MyVote, type VoteDoc } from './types'

// Every function takes the Firestore instance so the rules tests (app/tests) run
// this exact code against the emulator.

export type CandidateRow = CandidateDoc & { id: string }

/** Live leaderboard, highest score first. */
export function subscribeCandidates(db: Firestore, cb: (rows: CandidateRow[]) => void): Unsubscribe {
  const q = query(collection(db, 'candidates'), orderBy('score', 'desc'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as CandidateDoc) }))))
}

/** The signed-in voter's own vote history, as { candidateId: MyVote }. */
export function subscribeMyVotes(db: Firestore, uid: string, cb: (votes: Record<string, MyVote>) => void): Unsubscribe {
  const q = query(collection(db, 'votes'), where('uid', '==', uid))
  return onSnapshot(q, snap => {
    const out: Record<string, MyVote> = {}
    snap.forEach(d => {
      const v = d.data({ serverTimestamps: 'estimate' }) as Partial<VoteDoc>
      if (!v.candidateId) return
      out[v.candidateId] = { ups: v.ups ?? 0, nextUpAt: v.lastUpAt ? v.lastUpAt.toMillis() + UP_EVERY_MS : 0, down: !!v.down }
    })
    cb(out)
  })
}

export type VoteKind = 'up' | 'down'

/**
 * 추천 (once every 7 days per person, adds up) or 비추천 (once ever per person).
 * Neither can be undone. Runs in a transaction so concurrent voters can't corrupt
 * the tally; firestore.rules checks the same limits server side.
 */
export async function castVote(db: Firestore, myUid: string, candidateId: string, kind: VoteKind) {
  if (candidateId === myUid) throw new Error('cannot-vote-self')
  const voteRef = doc(db, 'votes', `${myUid}_${candidateId}`)
  const candidateRef = doc(db, 'candidates', candidateId)
  const seasonRef = doc(db, 'meta', 'season')
  await runTransaction(db, async tx => {
    const [voteSnap, candSnap, seasonSnap] = await Promise.all([tx.get(voteRef), tx.get(candidateRef), tx.get(seasonRef)])
    if (!candSnap.exists()) throw new Error('candidate-not-found')
    const cur = seasonSnap.exists() ? (seasonSnap.data().number as number) : 1
    const o = (voteSnap.data() ?? {}) as Partial<VoteDoc>
    const oUps = o.season === cur ? o.ups ?? 0 : 0
    const c = candSnap.data() as CandidateDoc
    const base = { uid: myUid, candidateId, season: cur, updatedAt: serverTimestamp() }
    if (kind === 'up') {
      if (o.lastUpAt && Date.now() < o.lastUpAt.toMillis() + UP_EVERY_MS) throw new Error('vote-too-soon')
      tx.set(voteRef, { ...base, ups: oUps + 1, lastUpAt: serverTimestamp(), down: o.down ?? false, downSeason: o.downSeason ?? 0 })
      tx.update(candidateRef, { up: c.up + 1, score: c.up + 1 - c.down })
    } else {
      if (o.down) throw new Error('already-downvoted')
      tx.set(voteRef, { ...base, ups: oUps, lastUpAt: o.lastUpAt ?? null, down: true, downSeason: cur })
      tx.update(candidateRef, { down: c.down + 1, score: c.up - (c.down + 1) })
    }
  })
}

/** Points available to spend: this season's recommendations + carried-over/admin bonus − spent. */
export const pointsOf = (c: Pick<CandidateDoc, 'up' | 'spent'> & { bonus?: number }) => c.up + (c.bonus ?? 0) - c.spent

/** Equips an already-owned item. */
export async function equipItem(db: Firestore, myUid: string, kind: ItemKind, key: string) {
  await updateDoc(doc(db, 'candidates', myUid), { [kind]: key })
}

/** Buys and equips a locked item; `price` must match data.ts's priceOf (the rules check it). */
export async function buyItem(db: Firestore, myUid: string, kind: ItemKind, key: string, price: number) {
  await updateDoc(doc(db, 'candidates', myUid), {
    [`owned.${kind}`]: arrayUnion(key),
    [kind]: key,
    spent: increment(price),
  })
}

export async function updateMyProfile(db: Firestore, myUid: string, patch: { bio?: string; gender?: string; photoURL?: string }) {
  await updateDoc(doc(db, 'candidates', myUid), patch)
}
