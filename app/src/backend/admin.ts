import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
  type WriteBatch,
} from 'firebase/firestore'
import { DEFAULT_SEASON, type CandidateDoc, type Season, type VoteDoc } from './types'

// Admin operations. Each batch of writes goes through the single-use-token
// protocol enforced by firestore.rules:
//   1. create three random tokens (seq 1, 2, 3) bound to this action + payload,
//      reading each back to confirm the server stored it unused and unaltered;
//   2. commit one batch that writes meta/adminLock listing the three tokens,
//      flips all three to used, and makes the actual changes.
// The rules re-check all of it server side; a token can never be used twice.

export const ADMIN_EMAIL = 'admin@vote.local'
export const isAdminEmail = (email: string | null | undefined) => email === ADMIN_EMAIL

export type AdminAction = 'grantPoints' | 'setSeasonName' | 'seasonReset' | 'deleteAccount' | 'renameUser'
export type AdminProgress = { batch: number; batches: number; verified: number }

/** Keep each batch's rule evaluation well under Firestore's per-request document-access limit. */
const WRITES_PER_BATCH = 8

function randomTokenId() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

const samePayload = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

async function issueVerifiedTokens(db: Firestore, uid: string, action: AdminAction, payload: object, onVerified: (n: number) => void) {
  const ids: string[] = []
  for (const seq of [1, 2, 3]) {
    const id = randomTokenId()
    const ref = doc(db, 'adminTokens', id)
    await setDoc(ref, { uid, action, payload, seq, used: false, createdAt: serverTimestamp() })
    const snap = await getDoc(ref)
    const t = snap.data()
    if (!snap.exists() || t?.used !== false || t.uid !== uid || t.action !== action || t.seq !== seq || !samePayload(t.payload, payload)) {
      throw new Error(`admin-token-verification-failed-${seq}`)
    }
    ids.push(id)
    onVerified(seq)
  }
  return ids
}

/**
 * Runs `groups` of writes as one admin action. A group's writes always land in
 * the same batch (e.g. "take back a vote" = tally update + vote delete); every
 * batch gets its own three fresh tokens.
 */
export async function runAdminOp(
  db: Firestore,
  uid: string,
  action: AdminAction,
  payload: object,
  groups: ((b: WriteBatch) => number)[],
  onProgress: (p: AdminProgress) => void = () => {},
) {
  const batches: ((b: WriteBatch) => number)[][] = []
  let cur: ((b: WriteBatch) => number)[] = [], size = 0
  for (const g of groups) {
    // Dry-run the group on a throwaway batch just to count its writes.
    const n = g(writeBatch(db))
    if (size && size + n > WRITES_PER_BATCH) { batches.push(cur); cur = []; size = 0 }
    cur.push(g); size += n
  }
  if (cur.length) batches.push(cur)

  for (let i = 0; i < batches.length; i++) {
    onProgress({ batch: i + 1, batches: batches.length, verified: 0 })
    const tokens = await issueVerifiedTokens(db, uid, action, payload, v => onProgress({ batch: i + 1, batches: batches.length, verified: v }))
    const b = writeBatch(db)
    b.set(doc(db, 'meta', 'adminLock'), { by: uid, action, payload, tokens, at: serverTimestamp() })
    for (const t of tokens) b.update(doc(db, 'adminTokens', t), { used: true })
    for (const g of batches[i]) g(b)
    await b.commit()
  }
}

// ---- operations -------------------------------------------------------------

export async function grantPoints(db: Firestore, adminUid: string, target: string, amount: number, onProgress?: (p: AdminProgress) => void) {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) throw new Error('invalid-amount')
  const snap = await getDoc(doc(db, 'candidates', target))
  if (!snap.exists()) throw new Error('candidate-not-found')
  const bonus = ((snap.data() as CandidateDoc).bonus ?? 0) + amount
  await runAdminOp(db, adminUid, 'grantPoints', { target, amount }, [
    b => { b.update(doc(db, 'candidates', target), { bonus }); return 1 },
  ], onProgress)
}

/** Renames someone on the leaderboard (their login id stays the same). */
export async function renameUser(db: Firestore, adminUid: string, target: string, newName: string, onProgress?: (p: AdminProgress) => void) {
  const name = newName.trim()
  if (name.length < 1 || name.length > 20) throw new Error('invalid-name')
  const snap = await getDoc(doc(db, 'candidates', target))
  if (!snap.exists()) throw new Error('candidate-not-found')
  await runAdminOp(db, adminUid, 'renameUser', { target, name }, [
    b => { b.update(doc(db, 'candidates', target), { name }); return 1 },
  ], onProgress)
}

export async function getSeason(db: Firestore): Promise<Season & { exists: boolean }> {
  const snap = await getDoc(doc(db, 'meta', 'season'))
  return snap.exists() ? { ...(snap.data() as Season), exists: true } : { ...DEFAULT_SEASON, exists: false }
}

export function subscribeSeason(db: Firestore, cb: (s: Season) => void): Unsubscribe {
  return onSnapshot(doc(db, 'meta', 'season'), snap => cb(snap.exists() ? (snap.data() as Season) : DEFAULT_SEASON))
}

const cleanSeasonName = (name: string) => {
  const n = name.trim()
  if (n.length < 1 || n.length > 20) throw new Error('invalid-season-name')
  return n
}

export async function setSeasonName(db: Firestore, adminUid: string, name: string, onProgress?: (p: AdminProgress) => void) {
  const n = cleanSeasonName(name)
  const cur = await getSeason(db)
  const ref = doc(db, 'meta', 'season')
  await runAdminOp(db, adminUid, 'setSeasonName', { name: n }, [
    b => {
      if (cur.exists) b.update(ref, { name: n })
      else b.set(ref, { name: n, number: 1, startedAt: serverTimestamp() })
      return 1
    },
  ], onProgress)
}

/**
 * Starts a new season: every tally goes to zero (vote docs stay, so the 7-day
 * timers carry over; they just stop counting), and each
 * person's recommendations this season carry over as points (bonus) so nobody
 * loses what they can spend in the shop.
 */
export async function resetSeason(db: Firestore, adminUid: string, newName: string, onProgress?: (p: AdminProgress) => void) {
  const name = cleanSeasonName(newName)
  const cur = await getSeason(db)
  const nextNumber = (cur.exists ? cur.number : 1) + 1
  const cands = await getDocs(collection(db, 'candidates'))
  const groups: ((b: WriteBatch) => number)[] = []
  for (const c of cands.docs) {
    const d = c.data() as CandidateDoc
    if (!d.up && !d.down && !d.score) continue
    groups.push(b => { b.update(c.ref, { up: 0, down: 0, score: 0, bonus: (d.bonus ?? 0) + d.up }); return 1 })
  }
  // Final podium of the season that's ending, for the one-time TOP 3 reveal.
  const top = cands.docs
    .map(c => ({ id: c.id, ...(c.data() as CandidateDoc) }))
    .sort((a, b) => b.score - a.score || b.up - a.up)
    .slice(0, 3)
    .map(c => ({ id: c.id, name: c.name, score: c.score, frame: c.frame }))
  const last = { name: cur.name, top }
  groups.push(b => { b.set(doc(db, 'meta', 'season'), { name, number: nextNumber, startedAt: serverTimestamp(), last }); return 1 })
  await runAdminOp(db, adminUid, 'seasonReset', { name, nextNumber }, groups, onProgress)
}

/**
 * Deletes an account: takes back every vote they cast (fixing those tallies),
 * removes votes on them, deletes their leaderboard entry, and bans the uid so
 * the same login can't re-create it. The Firebase Auth login itself is removed
 * by the purge-deleted-accounts workflow, which has the admin credentials.
 */
export async function deleteAccount(db: Firestore, adminUid: string, target: string, onProgress?: (p: AdminProgress) => void) {
  if (target === adminUid) throw new Error('cannot-delete-self')
  const [cast, received] = await Promise.all([
    getDocs(query(collection(db, 'votes'), where('uid', '==', target))),
    getDocs(query(collection(db, 'votes'), where('candidateId', '==', target))),
  ])
  const groups: ((b: WriteBatch) => number)[] = []
  const cur = (await getSeason(db)).number
  for (const v of cast.docs) {
    const vote = v.data() as Partial<VoteDoc>
    if (!vote.candidateId || vote.candidateId === target) continue
    // Only this season's part of the vote is in the tally (see firestore.rules upsNow/downNow).
    const ups = vote.season === cur ? vote.ups ?? 0 : 0
    const downs = vote.season === cur ? vote.downs ?? 0 : 0
    const candRef = doc(db, 'candidates', vote.candidateId)
    const cand = ups || downs ? await getDoc(candRef) : null
    if (cand?.exists()) {
      const c = cand.data() as CandidateDoc
      const up = c.up - ups, down = c.down - downs
      groups.push(b => { b.update(candRef, { up, down, score: up - down }); b.delete(v.ref); return 2 })
    } else {
      groups.push(b => { b.delete(v.ref); return 1 })
    }
  }
  for (const v of received.docs) groups.push(b => { b.delete(v.ref); return 1 })
  groups.push(b => {
    b.delete(doc(db, 'candidates', target))
    b.set(doc(db, 'banned', target), { at: serverTimestamp(), by: adminUid })
    return 2
  })
  await runAdminOp(db, adminUid, 'deleteAccount', { target }, groups, onProgress)
}

/** For the app: is this signed-in (non-admin) user a deleted account? */
export async function isBanned(db: Firestore, uid: string) {
  return (await getDoc(doc(db, 'banned', uid))).exists()
}

