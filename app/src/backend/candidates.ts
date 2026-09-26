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
import { PASS_PRICE, VOTE_EVERY_MS, type CandidateDoc, type MyVote, type VoteDoc, type WeekKind } from './types'

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
      const weekEndsAt = v.weekAt ? v.weekAt.toMillis() + VOTE_EVERY_MS : 0
      const kind = weekEndsAt > Date.now() ? v.weekKind ?? 'none' : 'none'
      out[v.candidateId] = { ups: v.ups ?? 0, downs: v.downs ?? 0, weekEndsAt, weekKind: kind, weekN: kind === 'none' ? 0 : v.weekN ?? 1 }
    })
    cb(out)
  })
}


/**
 * One vote a week per person (two with the 투표 2배권). `kind` and `count` are what
 * this week's vote should become: a new week starts with one 추천 or 비추천; within
 * the week it can be switched (all of the week's votes move), set to 'none'
 * (cancelled), or — with the pass — raised to 2. Runs in a transaction so the tally
 * moves by exactly the difference; firestore.rules (voteAction) checks the same.
 */
export async function castVote(db: Firestore, myUid: string, candidateId: string, kind: WeekKind, count = kind === 'none' ? 0 : 1) {
  if (candidateId === myUid) throw new Error('cannot-vote-self')
  if (kind === 'none') count = 0
  const voteRef = doc(db, 'votes', `${myUid}_${candidateId}`)
  const candidateRef = doc(db, 'candidates', candidateId)
  const seasonRef = doc(db, 'meta', 'season')
  await runTransaction(db, async tx => {
    const [voteSnap, candSnap, seasonSnap] = await Promise.all([tx.get(voteRef), tx.get(candidateRef), tx.get(seasonRef)])
    if (!candSnap.exists()) throw new Error('candidate-not-found')
    const cur = seasonSnap.exists() ? (seasonSnap.data().number as number) : 1
    const o = (voteSnap.data() ?? {}) as Partial<VoteDoc>
    const thisSeason = o.season === cur
    const inWeek = !!o.weekAt && Date.now() < o.weekAt.toMillis() + VOTE_EVERY_MS
    const oKind: WeekKind = inWeek ? o.weekKind ?? 'none' : 'none'
    const oN = oKind === 'none' ? 0 : o.weekN ?? 1
    if (inWeek && !thisSeason) throw new Error('vote-too-soon')
    if (!inWeek && kind === 'none') return
    if (!inWeek) count = 1
    if (kind === oKind && count === oN) return
    const dUp = (kind === 'up' ? count : 0) - (oKind === 'up' ? oN : 0)
    const dDown = (kind === 'down' ? count : 0) - (oKind === 'down' ? oN : 0)
    const c = candSnap.data() as CandidateDoc
    tx.set(voteRef, {
      uid: myUid, candidateId, season: cur, updatedAt: serverTimestamp(),
      ups: (thisSeason ? o.ups ?? 0 : 0) + dUp, downs: (thisSeason ? o.downs ?? 0 : 0) + dDown,
      weekAt: inWeek ? o.weekAt : serverTimestamp(), weekKind: kind, weekN: count,
    })
    tx.update(candidateRef, { up: c.up + dUp, down: c.down + dDown, score: c.up + dUp - (c.down + dDown) })
  })
}

/** 투표 2배권, kept for good (firestore.rules: passBuy). */
export async function buyPass(db: Firestore, myUid: string) {
  await updateDoc(doc(db, 'candidates', myUid), { pass2x: true, spent: increment(PASS_PRICE) })
}
export const hasPass = (c?: { pass2x?: boolean | number }) => !!c?.pass2x

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

/** 300P, once per account, for opening the installed app (firestore.rules: appBonusClaim). */
export async function claimAppBonus(db: Firestore, myUid: string) {
  await updateDoc(doc(db, 'candidates', myUid), { appBonus: true, bonus: increment(300) })
}
