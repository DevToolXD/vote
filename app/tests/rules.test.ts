// Security-rule tests: the app's own backend code (src/backend) against the
// Firestore emulator running ../firestore.rules. Run with `npm run test:rules`.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { after, beforeEach, describe, test } from 'node:test'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore,
  serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore,
} from 'firebase/firestore'
import { deleteAccount, grantPoints, renameUser, resetPassword, resetSeason, runAdminOp, setSeasonConfig, setSeasonName, type AdminProgress } from '../src/backend/admin'
import { newCandidateDoc } from '../src/backend/candidateDoc'
import { buyItem, castVote, equipItem, pointsOf, updateMyProfile } from '../src/backend/candidates'
import { createGroup, dmId, inviteMembers, leaveGroup, loadImage, markRead, openDm, sendImage, sendMessage, setChatMuted, setGroupInfo, setMessagesOff } from '../src/backend/messages'
import { removePushToken, saveNotifySettings, savePushToken } from '../src/backend/push'
import { markSupportRead, sendSupport } from '../src/backend/support'
import { cancelGift, claimGift, sendGift } from '../src/backend/gifts'
import { markNoticeSeen, nextUnseenNotice, postNotice } from '../src/backend/notices'
import { DEFAULT_REWARDS } from '../src/backend/rewards'
import type { CandidateDoc } from '../src/backend/types'
import { priceOf } from '../src/data'

const PROJECT = 'demo-vote'
const [HOST, PORT] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8181').split(':')
const apps: FirebaseApp[] = []

function dbAs(user: { uid: string; email?: string; admin?: boolean; firebase?: { sign_in_provider: string } } | null): Firestore {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'test' }, `app${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, HOST, Number(PORT), user ? {
    mockUserToken: { sub: user.uid, user_id: user.uid, ...(user.email ? { email: user.email } : {}), ...(user.admin ? { admin: true } : {}), firebase: { sign_in_provider: 'password', identities: {}, ...(user.firebase ?? {}) } },
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
  test('refused: someone else’s uid, a pre-filled score, pre-owned items', async () => {
    const a = userDb('a')
    await denied(setDoc(doc(a, 'candidates', 'b'), newCandidateDoc('b', 'x')))
    await denied(setDoc(doc(a, 'candidates', 'a'), { ...newCandidateDoc('a', 'x'), up: 50, score: 50 }))
    await denied(setDoc(doc(a, 'candidates', 'a'), { ...newCandidateDoc('a', 'x'), bonus: 999 }))
    await denied(setDoc(doc(a, 'candidates', 'a'), { ...newCandidateDoc('a', 'x'), owned: { frame: ['none', 'crown'], plate: ['none'], skin: ['none'] } }))
  })
  test('the admin is a normal participant too: own entry, votes, can’t vote for themselves', async () => {
    const admin = dbAs(ADMIN)
    await setDoc(doc(admin, 'candidates', ADMIN.uid), newCandidateDoc(ADMIN.uid, '관리자'))
    const b = await signUp('b')
    await castVote(admin, ADMIN.uid, 'b', 'up')
    await castVote(b, 'b', ADMIN.uid, 'up')
    assert.equal((await read(admin, `candidates/${ADMIN.uid}`)).up, 1)
    await assert.rejects(castVote(admin, ADMIN.uid, ADMIN.uid, 'up'))
    await grantPoints(admin, ADMIN.uid, ADMIN.uid, 100)
    assert.equal((await read(admin, `candidates/${ADMIN.uid}`)).bonus, 100)
    await assert.rejects(deleteAccount(admin, ADMIN.uid, ADMIN.uid))
  })
})

// Writes straight to the emulator as the owner (rules bypassed) — to set up history, e.g. a 추천 8 days ago.
async function seed(path: string, fields: Record<string, unknown>) {
  const fv = (v: unknown): unknown => typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v }
    : typeof v === 'number' ? { integerValue: String(v) } : v instanceof Date ? { timestampValue: v.toISOString() } : v === null ? { nullValue: null } : v
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fv(v)])) }
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&')
  const r = await fetch(`http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents/${path}?${mask}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  assert.ok(r.ok, await r.text())
}
const tally = async (db: Firestore, id: string) => { const c = await read(db, `candidates/${id}`); return [c.up, c.down, c.score] }
const voteDoc = (uid: string, cand: string, extra: Record<string, unknown>) =>
  ({ uid, candidateId: cand, season: 1, ups: 0, downs: 0, weekAt: null, weekKind: 'none', updatedAt: serverTimestamp(), ...extra })

describe('voting', () => {
  test('one vote a week: switch or cancel within the week, a new vote after it', async () => {
    await signUp('a'); const b = await signUp('b'); await signUp('c')
    await castVote(b, 'b', 'a', 'up')
    assert.deepEqual(await tally(b, 'a'), [1, 0, 1])
    await castVote(b, 'b', 'a', 'up') // same again: nothing changes
    assert.deepEqual(await tally(b, 'a'), [1, 0, 1])
    await castVote(b, 'b', 'a', 'down') // switch within the week
    assert.deepEqual(await tally(b, 'a'), [0, 1, -1])
    await castVote(b, 'b', 'a', 'none') // cancel
    assert.deepEqual(await tally(b, 'a'), [0, 0, 0])
    await castVote(b, 'b', 'a', 'up') // pick again, same week
    assert.deepEqual(await tally(b, 'a'), [1, 0, 1])
    await castVote(b, 'b', 'c', 'down') // other people are separate
    assert.deepEqual(await tally(b, 'c'), [0, 1, -1])
    // A week later this week's 추천 stays counted and a new vote adds up.
    await seed('votes/b_a', { weekAt: new Date(Date.now() - 8 * 86400_000) })
    await castVote(b, 'b', 'a', 'down')
    assert.deepEqual(await tally(b, 'a'), [1, 1, 0])
    // …and that new vote can still be changed this week, without touching last week's.
    await castVote(b, 'b', 'a', 'up')
    assert.deepEqual(await tally(b, 'a'), [2, 0, 2])
  })
  test('refused: a second vote in the same week, a back-dated week, a tally that doesn’t match', async () => {
    await signUp('a'); const b = await signUp('b')
    await castVote(b, 'b', 'a', 'up')
    const ref = doc(b, 'votes', 'b_a'), cand = doc(b, 'candidates', 'a')
    const tryWrite = (vote: Record<string, unknown>, c: Record<string, unknown>) => { const w = writeBatch(b); w.set(ref, voteDoc('b', 'a', vote)); w.update(cand, c); return w.commit() }
    const v = (await getDoc(ref)).data()!
    await denied(tryWrite({ ups: 2, weekAt: serverTimestamp(), weekKind: 'up' }, { up: 2, score: 2 })) // new week too early
    await denied(tryWrite({ ups: 1, downs: 1, weekAt: v.weekAt, weekKind: 'down' }, { down: 1, score: 0 })) // switch without removing the 추천
    await denied(tryWrite({ ups: 0, weekAt: v.weekAt, weekKind: 'none' }, { up: 1, score: 1 })) // cancel without the tally
    await denied(tryWrite({ ups: 0, downs: 1, weekAt: new Date(Date.now() - 30 * 86400_000), weekKind: 'down' }, { up: 0, down: 1, score: -1 })) // back-dated
    await denied(tryWrite({ ups: 1, weekAt: v.weekAt, weekKind: 'up' }, { up: 1 })) // "changing" to the same
  })
  test('refused: voting for yourself', async () => {
    const a = await signUp('a')
    await assert.rejects(castVote(a, 'a', 'a', 'up'))
    await denied(setDoc(doc(a, 'votes', 'a_a'), voteDoc('a', 'a', { ups: 1, weekAt: serverTimestamp(), weekKind: 'up' })))
  })
  test('refused: bumping a tally without a matching vote (the old infinite-votes hole)', async () => {
    await signUp('a'); const b = await signUp('b')
    await denied(updateDoc(doc(b, 'candidates', 'a'), { up: 1, score: 1 }))
    await castVote(b, 'b', 'a', 'up')
    await denied(updateDoc(doc(b, 'candidates', 'a'), { up: 2, score: 2 }))
  })
  test('refused: changing a vote doc without the tally, or with a bigger jump', async () => {
    await signUp('a'); const b = await signUp('b')
    await denied(setDoc(doc(b, 'votes', 'b_a'), voteDoc('b', 'a', { ups: 1, weekAt: serverTimestamp(), weekKind: 'up' })))
    const batch = writeBatch(b)
    batch.set(doc(b, 'votes', 'b_a'), voteDoc('b', 'a', { ups: 1, weekAt: serverTimestamp(), weekKind: 'up' }))
    batch.update(doc(b, 'candidates', 'a'), { up: 5, score: 5 })
    await denied(batch.commit())
  })
  test('refused: casting a vote in someone else’s name; editing someone else’s profile; signed-out writes', async () => {
    await signUp('a'); const b = await signUp('b'); await signUp('c')
    await denied(setDoc(doc(b, 'votes', 'c_a'), voteDoc('c', 'a', { ups: 1, weekAt: serverTimestamp(), weekKind: 'up' })))
    await denied(updateDoc(doc(b, 'candidates', 'a'), { bio: 'hacked' }))
    await denied(updateDoc(doc(dbAs(null), 'candidates', 'a'), { bio: 'x' }))
  })
  test('votes are private to their voter', async () => {
    await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    await castVote(b, 'b', 'a', 'up')
    assert.equal((await getDoc(doc(b, 'votes', 'b_a'))).data()?.ups, 1)
    await denied(getDoc(doc(c, 'votes', 'b_a')))
  })
})

describe('app bonus and login id', () => {
  test('300P once for opening the app; login id only your own, set once', async () => {
    const a = await signUp('a'); const b = await signUp('b')
    const { claimAppBonus } = await import('../src/backend/candidates')
    await claimAppBonus(a, 'a')
    assert.equal((await read(a, 'candidates/a')).bonus, 300)
    await denied(claimAppBonus(a, 'a'))
    await denied(updateDoc(doc(b, 'candidates', 'a'), { appBonus: true, bonus: 600 }))
    await denied(updateDoc(doc(b, 'candidates', 'b'), { appBonus: true, bonus: 900 }))
    await updateDoc(doc(a, 'candidates', 'a'), { loginId: 'a' })
    await denied(updateDoc(doc(a, 'candidates', 'a'), { loginId: 'admin' }))
    await denied(updateDoc(doc(b, 'candidates', 'b'), { loginId: 'admin' }))
    await denied(setDoc(doc(userDb('c'), 'candidates', 'c'), newCandidateDoc('c', 'x', 'admin')))
    await setDoc(doc(userDb('d'), 'candidates', 'd'), newCandidateDoc('d', 'x', 'd'))
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
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 250)
    await denied(buyItem(a, 'a', 'frame', 'crown', 1))
    await buyItem(a, 'a', 'frame', 'neon', priceOf('frame', 'neon'))
    const c = await read(a, 'candidates/a')
    assert.equal(pointsOf(c), 250 - 60); assert.equal(c.frame, 'neon')
    await buyItem(a, 'a', 'plate', 'crown', priceOf('plate', 'crown'))
    assert.equal(pointsOf(await read(a, 'candidates/a')), 250 - 60 - 105)
    // 85 points left: a 125P skin is out of reach, and an owned item can't be charged again.
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
  test('rename: admin changes a name through the tokens; nothing else, and nobody else', async () => {
    const a = await signUp('a')
    const admin = dbAs(ADMIN)
    await renameUser(admin, ADMIN.uid, 'a', '  새이름 ')
    assert.equal((await read(a, 'candidates/a')).name, '새이름')
    const ref = doc(admin, 'candidates', 'a')
    await assert.rejects(runAdminOp(admin, ADMIN.uid, 'renameUser', { target: 'a', name: 'X' }, [b => { b.update(ref, { name: 'X', bonus: 999 }); return 1 }]))
    await assert.rejects(runAdminOp(admin, ADMIN.uid, 'renameUser', { target: 'a', name: 'X' }, [b => { b.update(ref, { name: 'Y' }); return 1 }]))
    await assert.rejects(renameUser(admin, ADMIN.uid, 'a', 'x'.repeat(21)))
    await denied(updateDoc(doc(a, 'candidates', 'a'), { name: '셀프변경' }))
    await assert.rejects(renameUser(await signUp('b'), 'b', 'a', '해킹'))
    assert.equal((await read(a, 'candidates/a')).name, '새이름')
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
    for (let i = 1; i < uids.length; i++) await castVote(dbs[i], uids[i], 'u0', 'up')
    for (let i = 2; i < 6; i++) await castVote(dbs[i], uids[i], 'u1', 'down')
    for (let i = 2; i < uids.length; i++) await castVote(dbs[0], 'u0', uids[i], 'up')
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'u0', 5)
    const admin = dbAs(ADMIN)
    const seen: AdminProgress[] = []
    await resetSeason(admin, ADMIN.uid, '시즌 2', p => seen.push(p))
    assert.ok(seen.at(-1)!.batches > 1, 'expected the reset to span several batches')
    const u0 = await read(admin, 'candidates/u0'), u1 = await read(admin, 'candidates/u1')
    // Rewards (defaults): u0 is 1st (500), u2–u11 tie for 2nd (300), u1 (−4) is 3rd (150); everyone took part (+50).
    assert.deepEqual([u0.up, u0.down, u0.score, u0.bonus], [0, 0, 0, 11 + 5 + 500 + 50])
    assert.deepEqual([u1.up, u1.down, u1.score, u1.bonus], [0, 0, 0, 150 + 50])
    assert.equal((await read(admin, 'candidates/u2')).bonus, 1 + 300 + 50)
    const results = (await getDoc(doc(admin, 'seasonResults', '1'))).data()!
    assert.equal(results.name, 'BETA'); assert.equal(results.paid.length, 12)
    // Vote docs stay: the 7-day timer and the one-time 비추천 carry over into the new season.
    assert.equal((await getDocs(collection(admin, 'votes'))).size, 25)
    const s = (await getDoc(doc(admin, 'meta', 'season'))).data()!
    assert.deepEqual([s.name, s.number], ['시즌 2', 2])
    assert.equal(s.last.name, 'BETA')
    assert.equal(s.last.top.length, 3)
    assert.deepEqual([s.last.top[0].id, s.last.top[0].score], ['u0', 11])
    // Renaming keeps the podium; nobody can forge one.
    await setSeasonName(admin, ADMIN.uid, '시즌 2+')
    assert.equal((await getDoc(doc(admin, 'meta', 'season'))).data()!.last.name, 'BETA')
    // New season: the tally starts from zero, but the per-person limits still apply.
    await assert.rejects(castVote(dbs[3], 'u3', 'u0', 'up'), /vote-too-soon/)
    await assert.rejects(castVote(dbs[3], 'u3', 'u1', 'down'), /vote-too-soon/)
    await seed('votes/u3_u0', { weekAt: new Date(Date.now() - 8 * 86400_000) })
    await castVote(dbs[3], 'u3', 'u0', 'up')
    await castVote(dbs[7], 'u7', 'u1', 'down')
    assert.deepEqual(await tally(admin, 'u0'), [1, 0, 1])
    assert.deepEqual(await tally(admin, 'u1'), [0, 1, -1])
    assert.equal((await getDoc(doc(dbs[3], 'votes', 'u3_u0'))).data()!.ups, 1)
  })
  test('refused: a regular user deleting votes or resetting tallies', async () => {
    await signUp('a'); const b = await signUp('b')
    await castVote(b, 'b', 'a', 'up')
    await denied(deleteDoc(doc(b, 'votes', 'b_a')))
    await denied(updateDoc(doc(b, 'candidates', 'a'), { up: 0, score: 0 }))
  })

  test('delete account: their votes are taken back, their entry removed, and they can’t come back', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    await castVote(c, 'c', 'a', 'up')
    await castVote(c, 'c', 'b', 'down')
    await castVote(b, 'b', 'c', 'up')
    await castVote(a, 'a', 'b', 'up')
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

describe('messages', () => {
  const msgs = async (db: Firestore, chatId: string) => (await getDocs(collection(db, 'chats', chatId, 'messages'))).docs.map(d => d.data().text)

  test('1:1: open once per pair, both can talk, outsiders can’t read or write', async () => {
    const a = await signUp('a'), b = await signUp('b'), c = await signUp('c')
    const id = await openDm(a, 'a', 'b')
    assert.equal(id, dmId('a', 'b'))
    assert.equal(await openDm(b, 'b', 'a'), id)
    await sendMessage(a, 'a', id, ' 안녕 ')
    await sendMessage(b, 'b', id, '반가워')
    assert.deepEqual((await msgs(a, id)).sort(), ['반가워', '안녕'])
    const chat = (await getDoc(doc(a, 'chats', id))).data()!
    assert.equal(chat.last.text, '반가워')
    await markRead(a, 'a', id)
    await setChatMuted(a, 'a', id, true)
    assert.equal((await getDoc(doc(b, 'chats', id))).data()!.mutes.a, true)
    await denied(updateDoc(doc(a, 'chats', id), { 'mutes.b': true }))
    await denied(updateDoc(doc(a, 'chats', id), { 'mutes.a': 'yes' }))
    await setChatMuted(a, 'a', id, false)
    await denied(getDoc(doc(c, 'chats', id)))
    await denied(getDocs(collection(c, 'chats', id, 'messages')))
    await assert.rejects(sendMessage(c, 'c', id, '끼어들기'))
    await denied(setDoc(doc(c, 'chats', dmId('a', 'c').replace('c', 'b')), { type: 'dm', members: ['a', 'b'], name: '', createdBy: 'c', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
  })

  test('refused: forged sender, someone else’s read receipt, fake preview, wrong 1:1 id', async () => {
    const a = await signUp('a'); await signUp('b')
    const id = await openDm(a, 'a', 'b')
    await denied(setDoc(doc(collection(a, 'chats', id, 'messages')), { uid: 'b', text: 'x', at: serverTimestamp() }))
    await denied(updateDoc(doc(a, 'chats', id), { 'reads.b': serverTimestamp() }))
    await denied(updateDoc(doc(a, 'chats', id), { last: { text: 'x', uid: 'b', at: serverTimestamp() }, updatedAt: serverTimestamp() }))
    await denied(updateDoc(doc(a, 'chats', id), { members: ['a', 'b', 'z'] }))
    await denied(setDoc(doc(a, 'chats', 'a_b_c'), { type: 'dm', members: ['a', 'b'], name: '', createdBy: 'a', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
    await denied(deleteDoc(doc(a, 'chats', id)))
  })

  test('메시지 끄기: no new 1:1, no sending either way, not addable to groups', async () => {
    const a = await signUp('a'), b = await signUp('b'); await signUp('c')
    const id = await openDm(a, 'a', 'b')
    await setMessagesOff(b, 'b', true)
    await assert.rejects(sendMessage(a, 'a', id, '보내져?'))
    await assert.rejects(sendMessage(b, 'b', id, '나도?'))
    await assert.rejects(openDm(userDb('c'), 'c', 'b'))
    await assert.rejects(createGroup(a, 'a', ['b', 'c'], '단톡'))
    await setMessagesOff(b, 'b', false)
    await sendMessage(a, 'a', id, '이제 돼')
    await denied(updateDoc(doc(a, 'candidates', 'a'), { msgOff: 'yes' }))
  })

  test('group: 3–10 people, members talk, leaving works, deleted accounts can’t be added', async () => {
    const a = await signUp('a'); const b = await signUp('b'); await signUp('c')
    const id = await createGroup(a, 'a', ['b', 'c'], '우리반')
    await sendMessage(b, 'b', id, '하이')
    await leaveGroup(b, 'b', id)
    await assert.rejects(sendMessage(b, 'b', id, '나갔는데'))
    await denied(getDoc(doc(b, 'chats', id)))
    await sendMessage(a, 'a', id, '남은 사람')
    await assert.rejects(createGroup(a, 'a', ['b', 'ghost'], 'x'))
    await assert.rejects(createGroup(a, 'a', ['b'], '둘뿐'))
    const many = Array.from({ length: 10 }, (_, i) => `m${i}`)
    for (const m of many) await signUp(m)
    await assert.rejects(createGroup(a, 'a', many, '11명'))
    await createGroup(a, 'a', many.slice(0, 9), '10명')
  })
})

describe('chat extras', () => {
  const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(1000)
  test('invite: members add people who accept messages, up to 10; outsiders can’t', async () => {
    const a = await signUp('a'); await signUp('b'); await signUp('c'); const d = await signUp('d'); await signUp('e')
    const id = await createGroup(a, 'a', ['b', 'c'], '모임')
    await inviteMembers(a, 'a', id, ['d'], '이름a님이 이름d님을 초대했어요')
    const chat = (await getDoc(doc(d, 'chats', id))).data()!
    assert.deepEqual(chat.members, ['a', 'b', 'c', 'd'])
    assert.equal(chat.last.text, '이름a님이 이름d님을 초대했어요')
    await denied(updateDoc(doc(userDb('e'), 'chats', id), { members: ['a', 'b', 'c', 'd', 'e'] }))
    await setMessagesOff(userDb('e'), 'e', true)
    await assert.rejects(inviteMembers(a, 'a', id, ['e'], 'x'))
    await denied(updateDoc(doc(a, 'chats', id), { members: ['a', 'b', 'd'] })) // can't remove others
    const many = Array.from({ length: 7 }, (_, i) => `m${i}`)
    for (const m of many) await signUp(m)
    await assert.rejects(inviteMembers(a, 'a', id, many, 'x')) // 11 people
    await inviteMembers(a, 'a', id, many.slice(0, 6), 'x') // 10
    const dm = await openDm(a, 'a', 'b')
    await assert.rejects(inviteMembers(a, 'a', dm, ['c'], 'x')) // not in 1:1 chats
  })
  test('photos: sent with their media doc, readable only by members', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    const id = await openDm(a, 'a', 'b')
    await sendImage(a, 'a', id, IMG)
    const msgs = await getDocs(collection(b, 'chats', id, 'messages'))
    const m = msgs.docs[0]
    assert.equal(m.data().kind, 'image')
    assert.equal(await loadImage(b, id, m.id), IMG)
    await denied(getDoc(doc(c, 'chats', id, 'media', m.id)))
    await denied(setDoc(doc(collection(a, 'chats', id, 'messages')), { uid: 'a', text: '', kind: 'image', at: serverTimestamp() })) // no media
    await assert.rejects(sendImage(a, 'a', id, 'data:text/html;base64,AAAA'))
    await assert.rejects(sendImage(a, 'a', id, 'data:image/jpeg;base64,' + 'A'.repeat(700_001)))
    await setMessagesOff(b, 'b', true)
    await assert.rejects(sendImage(a, 'a', id, IMG))
  })
  test('group icon and name: members only, small images only, not for 1:1', async () => {
    const a = await signUp('a'); await signUp('b'); const c = await signUp('c'); await signUp('d')
    const id = await createGroup(a, 'a', ['b', 'c'], '모임')
    await setGroupInfo(c, id, { photo: IMG, name: '새 이름' })
    assert.equal((await getDoc(doc(a, 'chats', id))).data()!.name, '새 이름')
    await denied(setGroupInfo(userDb('d'), id, { photo: IMG }))
    await denied(setGroupInfo(a, id, { photo: 'x'.repeat(200_001) }))
    await denied(setGroupInfo(a, id, { name: 'x'.repeat(31) }))
    await denied(setGroupInfo(a, await openDm(a, 'a', 'd'), { name: 'x' }))
  })
})

describe('상담 and password reset', () => {
  test('상담: anonymous user ↔ admin; nobody else can read or pose as the admin', async () => {
    const anon = dbAs({ uid: 'anon1' }); const other = await signUp('b'); const admin = dbAs(ADMIN)
    await sendSupport(anon, 'anon1', 'user', '비밀번호를 잊었어요', { exists: false, name: '김철수', loginId: 'Alice1' })
    const t = (await getDoc(doc(admin, 'support', 'anon1'))).data()!
    assert.deepEqual([t.loginId, t.name, t.last.text, t.adminRead], ['alice1', '김철수', '비밀번호를 잊었어요', false])
    await sendSupport(admin, 'anon1', 'admin', '확인해볼게요', { exists: true })
    await markSupportRead(anon, 'anon1', 'user')
    assert.equal((await getDocs(collection(anon, 'support', 'anon1', 'messages'))).size, 2)
    assert.equal((await getDocs(collection(admin, 'support'))).size, 1)
    await denied(getDoc(doc(other, 'support', 'anon1')))
    await denied(getDocs(collection(other, 'support')))
    await assert.rejects(sendSupport(anon, 'anon1', 'admin', '관리자인 척', { exists: true }))
    await assert.rejects(sendSupport(other, 'anon1', 'user', '끼어들기', { exists: true }))
    await denied(setDoc(doc(other, 'support', 'anon1', 'messages', 'x'), { from: 'user', text: 'x', at: serverTimestamp() }))
  })
  test('reset: admin-only 3-token op; the worker applies it; the owner clears it after choosing a password', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await assert.rejects(resetPassword(b, 'b', 'a'))
    const code = await resetPassword(admin, ADMIN.uid, 'a')
    assert.match(code, /^[0-9]{8}$/)
    assert.equal((await getDoc(doc(a, 'pwResets', 'a'))).data()!.status, 'pending')
    await denied(getDoc(doc(b, 'pwResets', 'a')))
    await denied(deleteDoc(doc(a, 'pwResets', 'a'))) // not applied yet
    await denied(setDoc(doc(a, 'pwResets', 'a'), { code: '11111111', by: 'a', at: serverTimestamp(), status: 'pending' }))
    await new Promise<void>((resolve, reject) => execFile('node', ['../.github/scripts/send-notifications.mjs'], {
      env: { ...process.env, FIRESTORE_BASE: `http://${HOST}:${PORT}/v1`, FCM_BASE: 'http://127.0.0.1:9', PROJECT_ID: PROJECT, RUN_FOR_MS: '0', SETTLE_MS: '0' },
    }, (err, stdout, stderr) => err ? reject(new Error(stderr || stdout)) : resolve()))
    assert.equal((await getDoc(doc(a, 'pwResets', 'a'))).data()!.status, 'done')
    await deleteDoc(doc(a, 'pwResets', 'a'))
  })
})

describe('공지', () => {
  test('admin posts; each member reads it once; anonymous and regular users can’t post', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await assert.rejects(postNotice(b, 'b', '가짜 공지', '내용'))
    await postNotice(admin, ADMIN.uid, '점검 안내', '오늘 밤 점검이 있어요')
    const ids = (await getDoc(doc(a, 'meta', 'noticeIndex'))).data()!.ids as string[]
    assert.equal(ids.length, 1)
    const n = await nextUnseenNotice(a, 'a', ids)
    assert.deepEqual([n?.title, n?.body], ['점검 안내', '오늘 밤 점검이 있어요'])
    await markNoticeSeen(a, 'a', ids[0])
    await denied(getDoc(doc(a, 'notices', ids[0]))) // read once
    assert.equal(await nextUnseenNotice(a, 'a', ids), null)
    await denied(setDoc(doc(a, 'noticeReads', 'a'), { seen: {} })) // can't un-see
    assert.ok(await nextUnseenNotice(b, 'b', ids)) // others still can
    const anon = dbAs({ uid: 'anon9', firebase: { sign_in_provider: 'anonymous' } })
    await denied(getDoc(doc(anon, 'notices', ids[0])))
    await denied(getDoc(doc(anon, 'meta', 'noticeIndex')))
    await denied(getDoc(doc(dbAs(null), 'notices', ids[0])))
    await denied(setDoc(doc(b, 'notices', 'x'.repeat(20)), { title: 't', body: 'b', by: 'b', createdAt: serverTimestamp() }))
    await denied(setDoc(doc(b, 'meta', 'noticeIndex'), { ids: [] }))
  })
})

describe('season end date and rewards', () => {
  test('only the admin sets them, exactly as confirmed', async () => {
    await signUp('a'); const b = userDb('b'); const admin = dbAs(ADMIN)
    const ends = Date.now() + 3 * 86400_000
    const rw = { first: 700, second: 400, third: 200, top6: 100, participant: 60 }
    await assert.rejects(setSeasonConfig(b, 'b', ends, rw))
    await setSeasonConfig(admin, ADMIN.uid, ends, rw)
    const s1 = (await getDoc(doc(admin, 'meta', 'season'))).data()!
    assert.equal(s1.endsAt.toMillis(), ends); assert.deepEqual(s1.rewards, rw)
    await setSeasonName(admin, ADMIN.uid, '가을') // keeps end date and rewards
    assert.deepEqual((await getDoc(doc(admin, 'meta', 'season'))).data()!.rewards, rw)
    await setSeasonConfig(admin, ADMIN.uid, 0, DEFAULT_REWARDS) // clear the end date
    assert.equal((await getDoc(doc(admin, 'meta', 'season'))).data()!.endsAt, undefined)
    await assert.rejects(runAdminOp(admin, ADMIN.uid, 'seasonConfig', { endsAt: 0, ...rw }, [w => { w.update(doc(admin, 'meta', 'season'), { rewards: { ...rw, first: 99999 } }); return 1 }]))
    await assert.rejects(setSeasonConfig(admin, ADMIN.uid, 0, { ...rw, first: 100001 }))
  })
  test('the worker ends a due season: rewards paid, tallies reset, next season started, once', async () => {
    const a = await signUp('a'); const b = await signUp('b'); await signUp('c')
    await castVote(b, 'b', 'a', 'up')
    await castVote(a, 'a', 'b', 'down')
    await setSeasonConfig(dbAs(ADMIN), ADMIN.uid, Date.now() + 86400_000, { first: 500, second: 300, third: 150, top6: 90, participant: 50 })
    await seed('meta/season', { endsAt: new Date(Date.now() - 1000) })
    const run = () => new Promise<void>((resolve, reject) => execFile('node', ['../.github/scripts/send-notifications.mjs'], {
      env: { ...process.env, FIRESTORE_BASE: `http://${HOST}:${PORT}/v1`, FCM_BASE: 'http://127.0.0.1:9', PROJECT_ID: PROJECT, RUN_FOR_MS: '0', SETTLE_MS: '0' },
    }, (err, stdout, stderr) => err ? reject(new Error(stderr || stdout)) : resolve()))
    await run()
    const s2 = (await getDoc(doc(a, 'meta', 'season'))).data()!
    assert.deepEqual([s2.number, s2.name, s2.endsAt, s2.last.name, s2.last.top[0].id], [2, '2', undefined, 'BETA', 'a'])
    // a: 1st (+1 carried 추천) ; c: 2nd with 0 (tied with nobody below) ; b: −1 → 3rd. a and b took part.
    const [ca, cb, cc] = await Promise.all(['a', 'b', 'c'].map(u => read(a, `candidates/${u}`)))
    assert.deepEqual([ca.score, ca.bonus], [0, 1 + 500 + 50])
    assert.deepEqual([cc.bonus], [300])
    assert.deepEqual([cb.score, cb.bonus], [0, 150 + 50])
    assert.equal((await getDoc(doc(a, 'seasonResults', '1'))).data()!.auto, true)
    await run() // not due any more: nothing changes
    assert.equal((await read(a, 'candidates/a')).bonus, 551)
  })
})

describe('포인트 선물', () => {
  const chatOf = async (db: Firestore, id: string) => ({ id, ...(await getDoc(doc(db, 'chats', id))).data() } as never)
  const points = async (db: Firestore, u: string) => pointsOf(await read(db, `candidates/${u}`))
  test('1:1: only the other person can take it; points move exactly once', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 200)
    const id = await openDm(a, 'a', 'b')
    await assert.rejects(sendGift(a, 'a', await chatOf(a, id), 500)) // more than a has
    await sendGift(a, 'a', await chatOf(a, id), 120)
    assert.equal(await points(a, 'a'), 80)
    const gid = (await getDocs(collection(a, 'chats', id, 'messages'))).docs[0].data().giftId
    await assert.rejects(claimGift(a, 'a', gid)) // not your own
    await claimGift(b, 'b', gid)
    assert.equal(await points(b, 'b'), 120)
    await assert.rejects(claimGift(b, 'b', gid)) // only once
    await assert.rejects(cancelGift(a, 'a', gid)) // already taken
    assert.equal(await points(a, 'a'), 80)
  })
  test('group: first to tap wins; the sender can cancel an untaken gift', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c'); const d = await signUp('d')
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 300)
    const id = await createGroup(a, 'a', ['b', 'c'], '모임')
    await sendGift(a, 'a', await chatOf(a, id), 100)
    await sendGift(a, 'a', await chatOf(a, id), 50)
    const gifts = (await getDocs(collection(a, 'chats', id, 'messages'))).docs.map(m => m.data()).filter(m => m.kind === 'gift').map(m => m.giftId)
    const results = await Promise.allSettled([claimGift(b, 'b', gifts[0]), claimGift(c, 'c', gifts[0])])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    await assert.rejects(claimGift(d, 'd', gifts[1])) // not in the chat
    await cancelGift(a, 'a', gifts[1])
    assert.equal(await points(a, 'a'), 300 - (await getDoc(doc(a, 'gifts', gifts[0]))).data()!.amount) // the cancelled one came back
    await assert.rejects(claimGift(b, 'b', gifts[1])) // cancelled
  })
  test('refused: faking the points side or the gift side', async () => {
    const a = await signUp('a'); await signUp('b')
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 100)
    const id = await openDm(a, 'a', 'b')
    await denied(updateDoc(doc(a, 'candidates', 'a'), { bonus: 1000, lastGift: 'x' }))
    await denied(setDoc(doc(a, 'gifts', 'g1'), { chatId: id, from: 'a', to: 'b', amount: 50, status: 'open', createdAt: serverTimestamp() })) // points not held
    const w = writeBatch(a)
    w.set(doc(a, 'gifts', 'g2'), { chatId: id, from: 'a', to: 'b', amount: 50, status: 'claimed', createdAt: serverTimestamp() })
    w.update(doc(a, 'candidates', 'a'), { spent: 50, lastGift: 'g2' })
    await denied(w.commit())
    const w2 = writeBatch(a)
    w2.set(doc(a, 'gifts', 'g3'), { chatId: id, from: 'a', to: 'a', amount: 50, status: 'open', createdAt: serverTimestamp() }) // to yourself
    w2.update(doc(a, 'candidates', 'a'), { spent: 50, lastGift: 'g3' })
    await denied(w2.commit())
  })
})

describe('notifications', () => {
  test('push tokens and settings are private to their owner', async () => {
    const a = await signUp('a'); const b = await signUp('b')
    await savePushToken(a, 'a', 'tok-a', 'web')
    await denied(getDoc(doc(b, 'pushTokens', 'tok-a')))
    await denied(setDoc(doc(b, 'pushTokens', 'tok-x'), { uid: 'a', token: 'tok-x', platform: 'web', updatedAt: serverTimestamp() }))
    await denied(setDoc(doc(b, 'pushTokens', 'tok-y'), { uid: 'b', token: 'other', platform: 'web', updatedAt: serverTimestamp() }))
    await denied(removePushToken(b, 'tok-a'))
    await saveNotifySettings(a, 'a', { notifyVote: false })
    await denied(getDoc(doc(b, 'settings', 'a')))
    await denied(setDoc(doc(b, 'settings', 'a'), { notify: false }))
    await denied(setDoc(doc(a, 'settings', 'a'), { notify: 'no' }))
    await denied(getDoc(doc(a, 'meta', 'notifyCursor')))
    await removePushToken(a, 'tok-a')
  })

  test('the sender delivers messages and votes, honoring mutes, reads and settings', async () => {
    const a = await signUp('a'), b = await signUp('b'), c = await signUp('c')
    for (const [db, u] of [[a, 'a'], [b, 'b'], [c, 'c']] as const) await savePushToken(db, u, `tok-${u}`, u === 'c' ? 'android' : 'web')
    const dm = await openDm(a, 'a', 'b')
    await sendMessage(a, 'a', dm, '안녕 b')
    const group = await createGroup(a, 'a', ['b', 'c'], '모임')
    await setChatMuted(c, 'c', group, true)
    await sendMessage(b, 'b', group, '단톡 첫 메시지')
    await castVote(b, 'b', 'c', 'up')
    await castVote(c, 'c', 'a', 'down')
    await saveNotifySettings(a, 'a', { notifyVote: false })

    const got: { token: string; title: string; body: string }[] = []
    const fcm = createServer((req, res) => {
      let body = ''
      req.on('data', ch => { body += ch })
      req.on('end', () => {
        const m = JSON.parse(body).message
        got.push({ token: m.token, title: m.data?.title ?? m.notification.title, body: m.data?.body ?? m.notification.body })
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}')
      })
    })
    await new Promise<void>(r => fcm.listen(0, '127.0.0.1', r))
    const port = (fcm.address() as { port: number }).port
    await new Promise<void>((resolve, reject) => execFile('node', ['../.github/scripts/send-notifications.mjs'], {
      env: { ...process.env, FIRESTORE_BASE: `http://${HOST}:${PORT}/v1`, FCM_BASE: `http://127.0.0.1:${port}`, PROJECT_ID: PROJECT, RUN_FOR_MS: '0', SETTLE_MS: '0', SITE_URL: 'https://x/' },
    }, (err, stdout, stderr) => err ? reject(new Error(stderr || stdout)) : resolve()))
    fcm.close()

    const to = (t: string) => got.filter(g => g.token === t).map(g => `${g.title}|${g.body}`).sort()
    assert.deepEqual(to('tok-b'), ['이름a|안녕 b'], JSON.stringify(got))
    assert.ok(!to('tok-b').some(x => x.includes('단톡 첫 메시지')), 'b sent it, b must not be notified')
    assert.ok(to('tok-a').includes('모임|이름b: 단톡 첫 메시지'))
    assert.ok(!to('tok-a').some(x => x.includes('비추천')), 'a turned vote notifications off')
    assert.deepEqual(to('tok-c'), ['인기투표|누군가 회원님을 추천했어요'], 'c muted the group, so only the vote')
    // Nothing is sent twice: a second run finds nothing new.
    got.length = 0
    const fcm2 = createServer((req, res) => { got.push({ token: 'x', title: '', body: '' }); req.resume(); res.end('{}') })
    await new Promise<void>(r => fcm2.listen(port, '127.0.0.1', r))
    await new Promise<void>((resolve, reject) => execFile('node', ['../.github/scripts/send-notifications.mjs'], {
      env: { ...process.env, FIRESTORE_BASE: `http://${HOST}:${PORT}/v1`, FCM_BASE: `http://127.0.0.1:${port}`, PROJECT_ID: PROJECT, RUN_FOR_MS: '0', SETTLE_MS: '0' },
    }, err => err ? reject(err) : resolve()))
    fcm2.close()
    assert.equal(got.length, 0)
  })
})
