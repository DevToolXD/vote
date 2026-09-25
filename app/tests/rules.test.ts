// Security-rule tests: the app's own backend code (src/backend) against the
// Firestore emulator running ../firestore.rules. Run with `npm run test:rules`.
import assert from 'node:assert/strict'
import { after, beforeEach, describe, test } from 'node:test'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore,
  serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore,
} from 'firebase/firestore'
import { deleteAccount, grantPoints, resetSeason, runAdminOp, setSeasonName, type AdminProgress } from '../src/backend/admin'
import { newCandidateDoc } from '../src/backend/candidateDoc'
import { buyItem, castVote, equipItem, pointsOf, updateMyProfile } from '../src/backend/candidates'
import type { CandidateDoc } from '../src/backend/types'
import { priceOf } from '../src/data'

const PROJECT = 'demo-vote'
const [HOST, PORT] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8181').split(':')
const apps: FirebaseApp[] = []

function dbAs(user: { uid: string; email?: string; admin?: boolean } | null): Firestore {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'test' }, `app${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, HOST, Number(PORT), user ? {
    mockUserToken: { sub: user.uid, user_id: user.uid, ...(user.email ? { email: user.email } : {}), ...(user.admin ? { admin: true } : {}) },
  } : undefined)
  return db
}
const ADMIN = { uid: 'admin-uid', email: 'admin@vote.local' }
const userDb = (uid: string) => dbAs({ uid, email: `${uid}@vote.local` })

async function signUp(uid: string) {
  const db = userDb(uid)
  await setDoc(doc(db, 'candidates', uid), newCandidateDoc(uid, `이름${uid}`))
  return db
}
async function read(db: Firestore, path: string) {
  const s = await getDoc(doc(db, path))
  return s.data() as CandidateDoc & Record<string, unknown>
}
const denied = (p: Promise<unknown>) => assert.rejects(p, (e: { code?: string }) => e.code === 'permission-denied', 'expected permission-denied')

beforeEach(async () => {
  await fetch(`http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
})
after(async () => { await Promise.all(apps.map(a => deleteApp(a))) })

describe('sign-up', () => {
  test('a user can create exactly their own fresh leaderboard doc', async () => {
    const a = await signUp('a')
    assert.equal((await read(a, 'candidates/a')).up, 0)
  })
  test('refused: someone else’s uid, a pre-filled score, the admin, a banned uid', async () => {
    const a = userDb('a')
    await denied(setDoc(doc(a, 'candidates', 'b'), newCandidateDoc('b', 'x')))
    await denied(setDoc(doc(a, 'candidates', 'a'), { ...newCandidateDoc('a', 'x'), up: 50, score: 50 }))
    await denied(setDoc(doc(a, 'candidates', 'a'), { ...newCandidateDoc('a', 'x'), bonus: 999 }))
    await denied(setDoc(doc(a, 'candidates', 'a'), { ...newCandidateDoc('a', 'x'), owned: { frame: ['none', 'crown'], plate: ['none'], skin: ['none'] } }))
    const admin = dbAs(ADMIN)
    await denied(setDoc(doc(admin, 'candidates', ADMIN.uid), newCandidateDoc(ADMIN.uid, '관리자')))
  })
})

describe('voting', () => {
  test('recommend, switch to not-recommend, cancel — tally follows', async () => {
    await signUp('a'); const b = await signUp('b')
    assert.equal(await castVote(b, 'b', 'a', 1), 1)
    let c = await read(b, 'candidates/a'); assert.deepEqual([c.up, c.down, c.score], [1, 0, 1])
    assert.equal(await castVote(b, 'b', 'a', -1), -1)
    c = await read(b, 'candidates/a'); assert.deepEqual([c.up, c.down, c.score], [0, 1, -1])
    assert.equal(await castVote(b, 'b', 'a', -1), 0)
    c = await read(b, 'candidates/a'); assert.deepEqual([c.up, c.down, c.score], [0, 0, 0])
  })
  test('refused: voting for yourself', async () => {
    const a = await signUp('a')
    await assert.rejects(castVote(a, 'a', 'a', 1))
    await denied(setDoc(doc(a, 'votes', 'a_a'), { uid: 'a', candidateId: 'a', value: 1, updatedAt: serverTimestamp() }))
  })
  test('refused: bumping a tally without a matching vote (the old infinite-votes hole)', async () => {
    await signUp('a'); const b = await signUp('b')
    await denied(updateDoc(doc(b, 'candidates', 'a'), { up: 1, score: 1 }))
    await castVote(b, 'b', 'a', 1)
    await denied(updateDoc(doc(b, 'candidates', 'a'), { up: 2, score: 2 }))
  })
  test('refused: changing a vote doc without the tally, or with a bigger jump', async () => {
    await signUp('a'); const b = await signUp('b')
    await denied(setDoc(doc(b, 'votes', 'b_a'), { uid: 'b', candidateId: 'a', value: 1, updatedAt: serverTimestamp() }))
    const batch = writeBatch(b)
    batch.set(doc(b, 'votes', 'b_a'), { uid: 'b', candidateId: 'a', value: 1, updatedAt: serverTimestamp() })
    batch.update(doc(b, 'candidates', 'a'), { up: 5, score: 5 })
    await denied(batch.commit())
  })
  test('refused: casting a vote in someone else’s name; editing someone else’s profile; signed-out writes', async () => {
    await signUp('a'); const b = await signUp('b'); await signUp('c')
    await denied(setDoc(doc(b, 'votes', 'c_a'), { uid: 'c', candidateId: 'a', value: 1, updatedAt: serverTimestamp() }))
    await denied(updateDoc(doc(b, 'candidates', 'a'), { bio: 'hacked' }))
    await denied(updateDoc(doc(dbAs(null), 'candidates', 'a'), { bio: 'x' }))
  })
  test('votes are private to their voter', async () => {
    await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    await castVote(b, 'b', 'a', 1)
    assert.equal((await getDoc(doc(b, 'votes', 'b_a'))).data()?.value, 1)
    await denied(getDoc(doc(c, 'votes', 'b_a')))
  })
})

describe('profile and shop', () => {
  test('profile edits within limits', async () => {
    const a = await signUp('a')
    await updateMyProfile(a, 'a', { bio: '안녕하세요', gender: '여자' })
    await denied(updateMyProfile(a, 'a', { bio: 'x'.repeat(61) }))
    await denied(updateMyProfile(a, 'a', { gender: '외계인' }))
    await denied(updateDoc(doc(a, 'candidates', 'a'), { name: '다른이름' }))
  })
  test('buying needs enough points and the real price; no free items, no refunds', async () => {
    const a = await signUp('a')
    await denied(buyItem(a, 'a', 'frame', 'neon', priceOf('frame', 'neon')))
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 500)
    await denied(buyItem(a, 'a', 'frame', 'crown', 1))
    await buyItem(a, 'a', 'frame', 'neon', priceOf('frame', 'neon'))
    const c = await read(a, 'candidates/a')
    assert.equal(pointsOf(c), 500 - 120); assert.equal(c.frame, 'neon')
    await buyItem(a, 'a', 'plate', 'crown', priceOf('plate', 'crown'))
    assert.equal(pointsOf(await read(a, 'candidates/a')), 500 - 120 - 210)
    // 170 points left: a 250P skin is out of reach, and an owned item can't be charged again.
    await denied(buyItem(a, 'a', 'skin', 'eiffel', priceOf('skin', 'eiffel')))
    await denied(buyItem(a, 'a', 'frame', 'neon', priceOf('frame', 'neon')))
    await denied(updateDoc(doc(a, 'candidates', 'a'), { 'owned.frame': ['none', 'neon', 'crown'] }))
    await denied(updateDoc(doc(a, 'candidates', 'a'), { spent: 0 }))
    await denied(updateDoc(doc(a, 'candidates', 'a'), { bonus: 99999 }))
    await denied(updateDoc(doc(a, 'candidates', 'a'), { 'owned.plate': ['none'], plate: 'none' }))
    await denied(equipItem(a, 'a', 'frame', 'crown'))
    await equipItem(a, 'a', 'frame', 'none')
    await equipItem(a, 'a', 'frame', 'neon')
  })
})

describe('admin: single-use tokens ×3', () => {
  test('grant points: three tokens verified per batch, then applied', async () => {
    await signUp('a')
    const seen: AdminProgress[] = []
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 300, p => seen.push(p))
    assert.equal((await read(userDb('a'), 'candidates/a')).bonus, 300)
    assert.deepEqual(seen.map(p => p.verified), [0, 1, 2, 3])
    const tokens = await getDocs(collection(dbAs(ADMIN), 'adminTokens'))
    assert.equal(tokens.size, 3); assert.ok(tokens.docs.every(t => t.data().used === true))
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', -100)
    assert.equal((await read(userDb('a'), 'candidates/a')).bonus, 200)
  })
  test('the custom-claim admin (set only by a service account) works too', async () => {
    await signUp('a')
    await grantPoints(dbAs({ uid: 'claim-admin', admin: true }), 'claim-admin', 'a', 7)
    assert.equal((await read(userDb('a'), 'candidates/a')).bonus, 7)
  })
  test('refused: regular users can’t issue tokens or run admin ops', async () => {
    await signUp('a'); const b = await signUp('b')
    await assert.rejects(grantPoints(b, 'b', 'a', 1000))
    await denied(setDoc(doc(b, 'adminTokens', 'x'.repeat(48)), { uid: 'b', action: 'grantPoints', payload: { target: 'a', amount: 1 }, seq: 1, used: false, createdAt: serverTimestamp() }))
    await denied(updateDoc(doc(b, 'candidates', 'a'), { bonus: 1000 }))
  })
  test('refused: admin writes without the lock, replaying used tokens, or with fewer than 3 tokens', async () => {
    await signUp('a')
    const admin = dbAs(ADMIN)
    await denied(updateDoc(doc(admin, 'candidates', 'a'), { bonus: 1000 }))
    await grantPoints(admin, ADMIN.uid, 'a', 10)
    const used = (await getDocs(collection(admin, 'adminTokens'))).docs.map(d => d.id)
    const lock = (await getDoc(doc(admin, 'meta', 'adminLock'))).data()!
    const replay = writeBatch(admin)
    replay.set(doc(admin, 'meta', 'adminLock'), { ...lock, tokens: lock.tokens, at: serverTimestamp() })
    replay.update(doc(admin, 'candidates', 'a'), { bonus: 20 })
    await denied(replay.commit())
    assert.equal(used.length, 3)

    const make = async (seq: number, payload = { target: 'a', amount: 10 }) => {
      const id = crypto.randomUUID().replace(/-/g, '') + seq
      await setDoc(doc(admin, 'adminTokens', id), { uid: ADMIN.uid, action: 'grantPoints', payload, seq, used: false, createdAt: serverTimestamp() })
      return id
    }
    const t1 = await make(1), t2 = await make(2)
    const two = writeBatch(admin)
    two.set(doc(admin, 'meta', 'adminLock'), { by: ADMIN.uid, action: 'grantPoints', payload: { target: 'a', amount: 10 }, tokens: [t1, t2, t2], at: serverTimestamp() })
    two.update(doc(admin, 'adminTokens', t1), { used: true })
    two.update(doc(admin, 'adminTokens', t2), { used: true })
    two.update(doc(admin, 'candidates', 'a'), { bonus: 20 })
    await denied(two.commit())
  })
  test('refused: burning a token on its own, or writing the lock without tokens', async () => {
    const admin = dbAs(ADMIN)
    const id = 'f'.repeat(48)
    await setDoc(doc(admin, 'adminTokens', id), { uid: ADMIN.uid, action: 'setSeasonName', payload: { name: 'x' }, seq: 1, used: false, createdAt: serverTimestamp() })
    await denied(updateDoc(doc(admin, 'adminTokens', id), { used: true }))
    await denied(deleteDoc(doc(admin, 'adminTokens', id)))
    await denied(setDoc(doc(admin, 'meta', 'adminLock'), { by: ADMIN.uid, action: 'setSeasonName', payload: { name: 'x' }, tokens: [], at: serverTimestamp() }))
  })
  test('refused: one admin using tokens another admin issued', async () => {
    await signUp('a')
    const admin = dbAs(ADMIN), other = dbAs({ uid: 'claim-admin', admin: true })
    const ids: string[] = []
    for (const seq of [1, 2, 3]) {
      const id = `${'e'.repeat(40)}${seq}`
      await setDoc(doc(admin, 'adminTokens', id), { uid: ADMIN.uid, action: 'grantPoints', payload: { target: 'a', amount: 5 }, seq, used: false, createdAt: serverTimestamp() })
      ids.push(id)
    }
    const b = writeBatch(other)
    b.set(doc(other, 'meta', 'adminLock'), { by: 'claim-admin', action: 'grantPoints', payload: { target: 'a', amount: 5 }, tokens: ids, at: serverTimestamp() })
    for (const id of ids) b.update(doc(other, 'adminTokens', id), { used: true })
    b.update(doc(other, 'candidates', 'a'), { bonus: 5 })
    await denied(b.commit())
  })
  test('refused: tokens issued for one amount can’t authorize another', async () => {
    await signUp('a')
    const admin = dbAs(ADMIN)
    // Tokens and lock say +10, the write tries +1000.
    await assert.rejects(runAdminOp(admin, ADMIN.uid, 'grantPoints', { target: 'a', amount: 10 }, [
      b => { b.update(doc(admin, 'candidates', 'a'), { bonus: 1000 }); return 1 },
    ]), (e: { code?: string }) => e.code === 'permission-denied')
    assert.equal((await read(userDb('a'), 'candidates/a')).bonus, undefined)
  })

  test('season name: create then rename, number unchanged', async () => {
    const admin = dbAs(ADMIN)
    await setSeasonName(admin, ADMIN.uid, '봄 시즌')
    let s = (await getDoc(doc(admin, 'meta', 'season'))).data()!
    assert.deepEqual([s.name, s.number], ['봄 시즌', 1])
    await setSeasonName(admin, ADMIN.uid, '여름 시즌')
    s = (await getDoc(doc(userDb('z'), 'meta', 'season'))).data()!
    assert.deepEqual([s.name, s.number], ['여름 시즌', 1])
    await denied(setDoc(doc(userDb('z'), 'meta', 'season'), { name: 'hack', number: 1, startedAt: serverTimestamp() }))
  })

  test('season reset: tallies zeroed, votes cleared, recommendations carried over as points — across many batches', async () => {
    const uids = Array.from({ length: 12 }, (_, i) => `u${i}`)
    const dbs = await Promise.all(uids.map(signUp))
    // Everyone recommends u0; u1 gets some not-recommends.
    for (let i = 1; i < uids.length; i++) await castVote(dbs[i], uids[i], 'u0', 1)
    for (let i = 2; i < 6; i++) await castVote(dbs[i], uids[i], 'u1', -1)
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'u0', 5)
    const admin = dbAs(ADMIN)
    const seen: AdminProgress[] = []
    await resetSeason(admin, ADMIN.uid, '시즌 2', p => seen.push(p))
    assert.ok(seen.at(-1)!.batches > 1, 'expected the reset to span several batches')
    const u0 = await read(admin, 'candidates/u0'), u1 = await read(admin, 'candidates/u1')
    assert.deepEqual([u0.up, u0.down, u0.score, u0.bonus], [0, 0, 0, 11 + 5])
    assert.deepEqual([u1.up, u1.down, u1.score], [0, 0, 0])
    assert.equal((await getDocs(collection(admin, 'votes'))).size, 0)
    const s = (await getDoc(doc(admin, 'meta', 'season'))).data()!
    assert.deepEqual([s.name, s.number], ['시즌 2', 2])
    // New season: voting works again from zero.
    await castVote(dbs[3], 'u3', 'u0', 1)
    assert.equal((await read(admin, 'candidates/u0')).up, 1)
  })
  test('refused: a regular user deleting votes or resetting tallies', async () => {
    await signUp('a'); const b = await signUp('b')
    await castVote(b, 'b', 'a', 1)
    await denied(deleteDoc(doc(b, 'votes', 'b_a')))
    await denied(updateDoc(doc(b, 'candidates', 'a'), { up: 0, score: 0 }))
  })

  test('delete account: their votes are taken back, their entry removed, and they can’t come back', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    await castVote(c, 'c', 'a', 1)
    await castVote(c, 'c', 'b', -1)
    await castVote(b, 'b', 'c', 1)
    await castVote(a, 'a', 'b', 1)
    const admin = dbAs(ADMIN)
    await deleteAccount(admin, ADMIN.uid, 'c')
    assert.equal((await getDoc(doc(admin, 'candidates', 'c'))).exists(), false)
    const ca = await read(admin, 'candidates/a'), cb = await read(admin, 'candidates/b')
    assert.deepEqual([ca.up, ca.down, ca.score], [0, 0, 0])
    assert.deepEqual([cb.up, cb.down, cb.score], [1, 0, 1])
    const left = (await getDocs(collection(admin, 'votes'))).docs.map(d => d.id)
    assert.deepEqual(left, ['a_b'])
    assert.equal((await getDoc(doc(c, 'banned', 'c'))).exists(), true)
    await denied(setDoc(doc(c, 'candidates', 'c'), newCandidateDoc('c', '다시')))
  })
  test('refused: regular users deleting accounts', async () => {
    await signUp('a'); const b = await signUp('b')
    await assert.rejects(deleteAccount(b, 'b', 'a'))
    await denied(deleteDoc(doc(b, 'candidates', 'a')))
    await denied(setDoc(doc(b, 'banned', 'a'), { at: serverTimestamp(), by: 'b' }))
  })
})
