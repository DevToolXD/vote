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
  writeBatch,
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

// My vote docs exactly as the server has them (not ones with a write still in flight),
// so castVote can write straight away instead of reading them again in a transaction.
const myVoteDocs = new Map<string, Partial<VoteDoc> | null>()

// Which candidates' vote docs are known exactly: all of them while the full list is
// being listened to, or single ones while one person's vote sheet / profile is open.
let allKnown = false
const knownIds = new Set<string>()
const known = (candidateId: string) => allKnown || knownIds.has(candidateId)

function toMyVote(v: Partial<VoteDoc>): MyVote {
  const weekEndsAt = v.weekAt ? v.weekAt.toMillis() + VOTE_EVERY_MS : 0
  const kind = weekEndsAt > Date.now() ? v.weekKind ?? 'none' : 'none'
  return { ups: v.ups ?? 0, downs: v.downs ?? 0, weekEndsAt, weekKind: kind, weekN: kind === 'none' ? 0 : v.weekN ?? 1 }
}

/** All my votes, as { candidateId: MyVote } — only while a screen lists them (계정 → 내 투표). */
export function subscribeMyVotes(db: Firestore, uid: string, cb: (votes: Record<string, MyVote>) => void): Unsubscribe {
  const q = query(collection(db, 'votes'), where('uid', '==', uid))
  const stop = onSnapshot(q, snap => {
    const out: Record<string, MyVote> = {}
    snap.forEach(d => {
      const v = d.data({ serverTimestamps: 'estimate' }) as Partial<VoteDoc>
      if (!v.candidateId) return
      myVoteDocs.set(v.candidateId, d.metadata.hasPendingWrites ? null : v)
      out[v.candidateId] = toMyVote(v)
    })
    allKnown = !snap.metadata.fromCache
    cb(out)
  })
  return () => { stop(); allKnown = false }
}

/** My vote for one person (1 read) — while their vote sheet or profile is open. */
export function subscribeMyVote(db: Firestore, uid: string, candidateId: string, cb: (vote: MyVote | null) => void): Unsubscribe {
  const stop = onSnapshot(doc(db, 'votes', `${uid}_${candidateId}`), s => {
    const v = s.exists() ? (s.data({ serverTimestamps: 'estimate' }) as Partial<VoteDoc>) : null
    myVoteDocs.set(candidateId, s.metadata.hasPendingWrites ? null : v)
    if (!s.metadata.fromCache) knownIds.add(candidateId)
    cb(v ? toMyVote(v) : null)
  }, () => cb(null))
  return () => { stop(); knownIds.delete(candidateId) }
}

/** What this week's vote becomes (see castVote), or null when nothing changes. */
function planVote(o: Partial<VoteDoc>, cur: number, kind: WeekKind, count: number, now: number) {
  const thisSeason = o.season === cur
  const inWeek = !!o.weekAt && now < o.weekAt.toMillis() + VOTE_EVERY_MS
  const oKind: WeekKind = inWeek ? o.weekKind ?? 'none' : 'none'
  const oN = oKind === 'none' ? 0 : o.weekN ?? 1
  if (kind === 'none') count = 0
  if (inWeek && !thisSeason) throw new Error('vote-too-soon')
  if (!inWeek && kind === 'none') return null
  if (!inWeek) count = 1
  if (kind === oKind && count === oN) return null
  const dUp = (kind === 'up' ? count : 0) - (oKind === 'up' ? oN : 0)
  const dDown = (kind === 'down' ? count : 0) - (oKind === 'down' ? oN : 0)
  return {
    dUp, dDown,
    vote: {
      season: cur, ups: (thisSeason ? o.ups ?? 0 : 0) + dUp, downs: (thisSeason ? o.downs ?? 0 : 0) + dDown,
      weekAt: inWeek ? o.weekAt : serverTimestamp(), weekKind: kind, weekN: count,
    },
  }
}

/**
 * One vote a week per person (two with the 투표 2배권). `kind` and `count` are what
 * this week's vote should become: a new week starts with one 추천 or 비추천; within
 * the week it can be switched (all of the week's votes move), set to 'none'
 * (cancelled), or — with the pass — raised to 2. firestore.rules (voteAction +
 * voteTally) checks that the tally moves by exactly the difference.
 *
 * With `season` given and my votes already loaded, it writes straight away (the
 * tally with increments, so other voters at the same moment don't clash) — no reads,
 * so it also works when the day's read quota is used up. If what the app had was
 * out of date the rules refuse it, and it retries as a transaction that reads first.
 */
export async function castVote(db: Firestore, myUid: string, candidateId: string, kind: WeekKind, count = kind === 'none' ? 0 : 1, season?: number) {
  if (candidateId === myUid) throw new Error('cannot-vote-self')
  const voteRef = doc(db, 'votes', `${myUid}_${candidateId}`)
  const candidateRef = doc(db, 'candidates', candidateId)
  const base = { uid: myUid, candidateId, updatedAt: serverTimestamp() }
  const local = myVoteDocs.get(candidateId)
  if (season && known(candidateId) && local !== null) {
    try {
      const p = planVote(local ?? {}, season, kind, count, Date.now())
      if (!p) return
      const b = writeBatch(db)
      b.set(voteRef, { ...base, ...p.vote })
      b.update(candidateRef, { up: increment(p.dUp), down: increment(p.dDown), score: increment(p.dUp - p.dDown), scoreAt: serverTimestamp() })
      await b.commit()
      return
    } catch { /* out of date: read and retry below */ }
  }
  const seasonRef = doc(db, 'meta', 'season')
  await runTransaction(db, async tx => {
    const [voteSnap, candSnap, seasonSnap] = await Promise.all([tx.get(voteRef), tx.get(candidateRef), tx.get(seasonRef)])
    if (!candSnap.exists()) throw new Error('candidate-not-found')
    const cur = seasonSnap.exists() ? (seasonSnap.data().number as number) : 1
    const p = planVote((voteSnap.data() ?? {}) as Partial<VoteDoc>, cur, kind, count, Date.now())
    if (!p) return
    const c = candSnap.data() as CandidateDoc
    tx.set(voteRef, { ...base, ...p.vote })
    tx.update(candidateRef, { up: c.up + p.dUp, down: c.down + p.dDown, score: c.up + p.dUp - (c.down + p.dDown), scoreAt: serverTimestamp() })
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
