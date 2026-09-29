// Security-rule tests: the app's own backend code (src/backend) against the
// Firestore emulator running ../firestore.rules. Run with `npm run test:rules`.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { after, before, beforeEach, describe, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectDatabaseEmulator, get as rtGet, getDatabase, ref as rtRef, set as rtSet, update as rtUpdate, type Database } from 'firebase/database'
import {
  collection, connectFirestoreEmulator, deleteDoc, deleteField, doc, getDoc, getDocs, getFirestore,
  arrayUnion, increment, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, type Firestore,
} from 'firebase/firestore'
import { revokeItem, setTradeBan, TRADE_BAN_FOREVER, deleteAccount, grantPoints, renameUser, resetPassword, resetSeason, runAdminOp, setSeasonConfig, setSeasonName, type AdminProgress } from '../src/backend/admin'
import { newCandidateDoc } from '../src/backend/candidateDoc'
import { buyItem, buyKoreaBundle, buyPass, castVote, equipItem, pointsOf, subscribeMyVotes, updateMyProfile } from '../src/backend/candidates'
import { loadOlderMessages, subscribeMessages, setChatDatabase, setChatTimeout, createGroup, dmId, inviteMembers, leaveGroup, loadImage, markGone, markHere, markRead, openDm, sendFakeGift, scheduleMessage, cancelScheduled, sendImage, sendMessage, setChatMuted, setGroupInfo, setMessagesOff } from '../src/backend/messages'
import { removePushToken, saveNotifySettings, savePushToken } from '../src/backend/push'
import { closeTicket, linkTicket, markSupportRead, sendSupport } from '../src/backend/support'
import { cancelGift, claimGift, sendGift, sendItemGift, subscribeGift } from '../src/backend/gifts'
import { markNoticeSeen, nextUnseenNotice, pollResults, postNotice, voteNotice } from '../src/backend/notices'
import { DEFAULT_REWARDS, computeRewards } from '../src/backend/rewards'
import { buildPeople } from '../src/model'
import type { CandidateDoc } from '../src/backend/types'
import { priceOf } from '../src/data'
import { placeBet, settleLastBet } from '../src/backend/gamble'
import { buyListing, cancelListing, listItem, subscribeMarket, type Listing } from '../src/backend/market'

const PROJECT = 'demo-vote'
const RTDB_NS = `${PROJECT}-default-rtdb`
const RTDB = `http://127.0.0.1:9000`
const [HOST, PORT] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8181').split(':')
const apps: FirebaseApp[] = []

const rtdbOf = new Map<Firestore, Database>()
function dbAs(user: { uid: string; email?: string; admin?: boolean; firebase?: { sign_in_provider: string } } | null): Firestore {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'test', databaseURL: `https://${RTDB_NS}.asia-southeast1.firebasedatabase.app` }, `app${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  const token = user ? { sub: user.uid, user_id: user.uid, ...(user.email ? { email: user.email } : {}), ...(user.admin ? { admin: true } : {}), firebase: { sign_in_provider: 'password', identities: {}, ...(user.firebase ?? {}) } } : undefined
  connectFirestoreEmulator(db, HOST, Number(PORT), token ? { mockUserToken: token } : undefined)
  const rtdb = getDatabase(app)
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000, token ? { mockUserToken: token } : undefined)
  setChatDatabase(db, rtdb)
  rtdbOf.set(db, rtdb)
  return db
}
/** Reads a Realtime Database path as that user. */
const rt = async (db: Firestore, path: string) => (await rtGet(rtRef(rtdbOf.get(db)!, path))).val()
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
const denied = (p: Promise<unknown>) => assert.rejects(p, (e: { code?: string; message?: string }) => e.code === 'permission-denied' || /permission[_ ]denied/i.test(String(e.code ?? '') + String(e.message ?? '')), 'expected permission-denied')

// database.rules.json is loaded into the Realtime Database emulator here (firebase-tools'
// own upload doesn't get through every network setup); it's deployed for real by
// .github/scripts/setup-rtdb.mjs.
before(async () => {
  const r = await fetch(`${RTDB}/.settings/rules.json?ns=${RTDB_NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8') })
  assert.ok(r.ok, await r.text())
})
beforeEach(async () => {
  await fetch(`http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  await fetch(`${RTDB}/.json?ns=${RTDB_NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: 'null' })
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
  test('10P per vote received (추천 or 비추천); cancelling never takes it back; cancel + vote again pays nothing', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    const pts = async () => pointsOf(await read(a, 'candidates/a'))
    await castVote(b, 'b', 'a', 'up'); assert.equal(await pts(), 10)
    await castVote(c, 'c', 'a', 'down'); assert.equal(await pts(), 20) // 비추천 pays too
    await castVote(b, 'b', 'a', 'none'); assert.equal(await pts(), 20) // cancelled: points stay
    await castVote(b, 'b', 'a', 'up'); assert.equal(await pts(), 20) // same week again: nothing more
    await castVote(b, 'b', 'a', 'down'); assert.equal(await pts(), 20) // switching: nothing more
    // a forged tally that pays more than the vote allows is refused
    await denied(updateDoc(doc(b, 'candidates', 'a'), { earned: 999 }))
    // next week, a new vote pays again
    await seed('votes/b_a', { weekAt: new Date(Date.now() - 8 * 86400_000) })
    await castVote(b, 'b', 'a', 'up'); assert.equal(await pts(), 30)
  })
  test('direct write (no reads) when my votes are loaded; stale knowledge falls back to a transaction', async () => {
    await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    let snaps = 0
    const stop = subscribeMyVotes(b, 'b', () => { snaps++ })
    while (!snaps) await new Promise(r => setTimeout(r, 50))
    await new Promise(r => setTimeout(r, 300))
    await castVote(b, 'b', 'a', 'up', 1, 1)
    assert.deepEqual(await tally(b, 'a'), [1, 0, 1])
    await new Promise(r => setTimeout(r, 300))
    await castVote(b, 'b', 'a', 'down', 1, 1) // switch, written directly
    assert.deepEqual(await tally(b, 'a'), [0, 1, -1])
    await castVote(c, 'c', 'a', 'up') // someone else at the same time: increments don't clash
    await new Promise(r => setTimeout(r, 300))
    await castVote(b, 'b', 'a', 'none', 0, 7) // wrong season: refused, then done by transaction
    assert.deepEqual(await tally(b, 'a'), [1, 0, 1])
    stop()
  })
  test('투표 2배권: 5000P once, kept for good; then twice a week per person, switch/cancel move both', async () => {
    await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await denied(buyPass(b, 'b')) // no points
    await grantPoints(admin, ADMIN.uid, 'b', 5000)
    await denied(updateDoc(doc(b, 'candidates', 'b'), { pass2x: 7, spent: 5000 })) // must be the plain pass
    await denied(updateDoc(doc(b, 'candidates', 'b'), { pass2x: true, spent: 10 })) // underpaid
    await castVote(b, 'b', 'a', 'up')
    await denied(castVote(b, 'b', 'a', 'up', 2)) // no pass yet
    await buyPass(b, 'b')
    assert.equal(pointsOf((await getDoc(doc(b, 'candidates', 'b'))).data() as never), 0)
    await denied(buyPass(b, 'b')) // already has it
    await castVote(b, 'b', 'a', 'up', 2)
    assert.deepEqual(await tally(b, 'a'), [2, 0, 2])
    await castVote(b, 'b', 'a', 'down', 2) // switching moves both votes
    assert.deepEqual(await tally(b, 'a'), [0, 2, -2])
    await castVote(b, 'b', 'a', 'none') // cancel removes both
    assert.deepEqual(await tally(b, 'a'), [0, 0, 0])
    await denied(castVote(b, 'b', 'a', 'up', 2)) // from nothing it's one at a time
    await castVote(b, 'b', 'a', 'up')
    await castVote(b, 'b', 'a', 'up', 2)
    const v = (await getDoc(doc(b, 'votes', 'b_a'))).data()!
    const w = writeBatch(b); w.set(doc(b, 'votes', 'b_a'), { ...v, ups: 3, weekN: 3, updatedAt: serverTimestamp() }); w.update(doc(b, 'candidates', 'a'), { up: 3, score: 3 })
    await denied(w.commit()) // never three
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
  test('대한민국 세트: frame + 이름표 only together for 3000P; the 막대 스킨 is 리미티드 (관리자샵 only)', async () => {
    const a = await signUp('a')
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 9000)
    // one by one: refused, at any price
    await denied(buyItem(a, 'a', 'frame', 'korea', 3000))
    await denied(buyItem(a, 'a', 'plate', 'korea', 3000))
    await denied(buyItem(a, 'a', 'skin', 'korea', 3000))
    // the bundle: exactly 3000P for both, both put on
    await denied(updateDoc(doc(a, 'candidates', 'a'), { 'owned.frame': arrayUnion('korea'), 'owned.plate': arrayUnion('korea'), spent: increment(2999) }))
    await buyKoreaBundle(a, 'a')
    const c = await read(a, 'candidates/a')
    assert.equal(pointsOf(c), 6000); assert.deepEqual([c.frame, c.plate], ['korea', 'korea'])
    // the bundle can't smuggle in anything else
    const b = await signUp('b'); await grantPoints(dbAs(ADMIN), ADMIN.uid, 'b', 9000)
    await denied(updateDoc(doc(b, 'candidates', 'b'), { 'owned.frame': arrayUnion('korea'), 'owned.plate': arrayUnion('korea'), 'owned.skin': arrayUnion('korea'), spent: increment(3000) }))
    // the admin's 관리자샵: everything, one by one, at its price
    const admin = dbAs(ADMIN)
    await setDoc(doc(admin, 'candidates', ADMIN.uid), newCandidateDoc(ADMIN.uid, '관리자'))
    await grantPoints(admin, ADMIN.uid, ADMIN.uid, 9000)
    await denied(buyItem(admin, ADMIN.uid, 'skin', 'korea', 100))
    for (const k of ['frame', 'plate', 'skin'] as const) await buyItem(admin, ADMIN.uid, k, 'korea', 3000)
    assert.equal(pointsOf(await read(admin, `candidates/${ADMIN.uid}`)), 0)
  })
  test('매트릭스 (레전드 set): frame, 이름표 and 막대 스킨 at 2000P each', async () => {
    const a = await signUp('a')
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 6050)
    assert.equal(priceOf('frame', 'matrix'), 2000); assert.equal(priceOf('plate', 'matrix'), 2000); assert.equal(priceOf('skin', 'matrix'), 2000)
    await denied(buyItem(a, 'a', 'plate', 'matrix', 1000))
    await denied(buyItem(a, 'a', 'skin', 'matrix', 1000))
    for (const k of ['frame', 'plate', 'skin'] as const) await buyItem(a, 'a', k, 'matrix', 2000)
    const c = await read(a, 'candidates/a')
    assert.equal(pointsOf(c), 50); assert.deepEqual([c.frame, c.plate, c.skin], ['matrix', 'matrix', 'matrix'])
  })
  test('아우라 (레전드 set): frame, 이름표 and 막대 스킨 at 1000P each', async () => {
    const a = await signUp('a')
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 3100)
    assert.equal(priceOf('frame', 'aura'), 1000); assert.equal(priceOf('plate', 'aura'), 1000); assert.equal(priceOf('skin', 'aura'), 1000)
    await denied(buyItem(a, 'a', 'plate', 'aura', 1015)) // not frame + 15 like the others
    await denied(buyItem(a, 'a', 'skin', 'aura', 125))
    await buyItem(a, 'a', 'frame', 'aura', 1000)
    await buyItem(a, 'a', 'plate', 'aura', 1000)
    await buyItem(a, 'a', 'skin', 'aura', 1000)
    const c = await read(a, 'candidates/a')
    assert.equal(pointsOf(c), 100); assert.deepEqual([c.frame, c.plate, c.skin], ['aura', 'aura', 'aura'])
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

  test('season reset: tallies zeroed, votes cleared, earned points kept, rewards added — across many batches', async () => {
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
    // Rewards (defaults): u0 is 1st (500); u2–u11 all have 1 point, ranked by who got it first
    // (u2 2nd 300, u3 3rd 150, u4–u6 90, the rest none); u1 (−4) is last; everyone took part (+50).
    // Points from votes (10 each, 추천 or 비추천) stay as they were; only the rewards are added.
    assert.deepEqual([u0.up, u0.down, u0.score, u0.earned, u0.bonus], [0, 0, 0, 110, 5 + 500 + 50])
    assert.deepEqual([u1.up, u1.down, u1.score, u1.earned, u1.bonus], [0, 0, 0, 40, 50])
    assert.equal(pointsOf(u0), 110 + 555)
    assert.equal((await read(admin, 'candidates/u2')).bonus, 300 + 50)
    assert.equal((await read(admin, 'candidates/u3')).bonus, 150 + 50)
    assert.equal((await read(admin, 'candidates/u6')).bonus, 90 + 50)
    assert.equal((await read(admin, 'candidates/u7')).bonus, 50)
    assert.equal((await read(admin, 'candidates/u7')).earned, 10)
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

describe('messages (Realtime Database)', () => {
  const msgs = async (db: Firestore, chatId: string) => Object.values((await rt(db, `msgs/${chatId}`)) ?? {}) as { uid: string; text: string; kind?: string; replyTo?: unknown; giftId?: string }[]
  const R = (db: Firestore) => rtdbOf.get(db)!
  const now = { '.sv': 'timestamp' }

  test('1:1: open once per pair, both can talk, outsiders can’t read or write', async () => {
    const a = await signUp('a'), b = await signUp('b'), c = await signUp('c')
    const id = await openDm(a, 'a', 'b')
    assert.equal(id, dmId('a', 'b'))
    assert.equal(await openDm(b, 'b', 'a'), id)
    await sendMessage(a, 'a', id, ' 안녕 ')
    await sendMessage(b, 'b', id, '반가워')
    assert.deepEqual((await msgs(a, id)).map(m => m.text).sort(), ['반가워', '안녕'])
    assert.equal((await rt(a, `chats/${id}/last`)).text, '반가워')
    assert.equal((await rt(b, `userChats/b`))[id], true)
    assert.deepEqual((await getDoc(doc(a, 'chats', id))).data()!.members, ['a', 'b']) // Firestore copy for the gift rules
    await setChatMuted(a, 'a', id, true)
    assert.equal((await rt(b, `chats/${id}/mutes`)).a, true)
    await denied(rtSet(rtRef(R(a), `chats/${id}/mutes/b`), true))
    await setChatMuted(a, 'a', id, false)
    await denied(rtGet(rtRef(R(c), `chats/${id}`)))
    await denied(rtGet(rtRef(R(c), `msgs/${id}`)))
    await assert.rejects(sendMessage(c, 'c', id, '끼어들기'))
    await denied(rtSet(rtRef(R(c), `chats/${id}/members/c`), true))
    await denied(rtSet(rtRef(R(c), `userChats/c/${id}`), true)) // not a member
  })

  test('답장: quotes an existing message in the same chat', async () => {
    const a = await signUp('a'); const b = await signUp('b')
    const id = await openDm(a, 'a', 'b')
    await sendMessage(a, 'a', id, '저녁 먹었어?')
    const firstId = Object.keys(await rt(b, `msgs/${id}`))[0]
    await sendMessage(b, 'b', id, '응 먹었어', { id: firstId, uid: 'a', text: '저녁 먹었어?' })
    const reply = (await msgs(a, id)).find(m => m.replyTo)!
    assert.deepEqual(reply.replyTo, { id: firstId, uid: 'a', text: '저녁 먹었어?' })
    await denied(sendMessage(b, 'b', id, 'x', { id: 'nope', uid: 'a', text: 'x' })) // no such message
    await denied(rtSet(rtRef(R(b), `msgs/${id}/k1`), { uid: 'b', text: 'x', at: now, replyTo: { id: firstId, uid: 'a', text: 'x', extra: 1 } }))
  })

  test('refused: forged sender, fake preview, edits and deletes, unknown fields, wrong 1:1 id', async () => {
    const a = await signUp('a'); await signUp('b'); await signUp('c')
    const id = await openDm(a, 'a', 'b')
    await sendMessage(a, 'a', id, '원래')
    const k = Object.keys(await rt(a, `msgs/${id}`))[0]
    await denied(rtSet(rtRef(R(a), `msgs/${id}/k2`), { uid: 'b', text: 'x', at: now }))
    await denied(rtSet(rtRef(R(a), `chats/${id}/last`), { text: 'x', uid: 'b', at: now }))
    await denied(rtSet(rtRef(R(a), `msgs/${id}/${k}/text`), '고침')) // no edits
    await denied(rtSet(rtRef(R(a), `msgs/${id}/${k}`), null)) // no deletes
    await denied(rtSet(rtRef(R(a), `msgs/${id}/k3`), { uid: 'a', text: 'x', at: now, admin: true }))
    await denied(rtSet(rtRef(R(a), `msgs/${id}/k4`), { uid: 'a', text: 'x', at: 1 })) // back-dated
    await denied(rtSet(rtRef(R(a), `chats/b_c/members/a`), true)) // someone else's 1:1
    await denied(rtSet(rtRef(R(a), `chats/${id}/members/c`), true)) // a third person in a 1:1
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
    await denied(rtSet(rtRef(R(a), 'msgOff/b'), true))
  })

  test('group: 3 or more people, members talk, leaving works, deleted accounts can’t be added', async () => {
    const a = await signUp('a'); const b = await signUp('b'); await signUp('c')
    const id = await createGroup(a, 'a', ['b', 'c'], '우리반')
    assert.equal((await rt(a, `chats/${id}/info`)).name, '우리반')
    await sendMessage(b, 'b', id, '하이')
    await leaveGroup(b, 'b', id)
    await assert.rejects(sendMessage(b, 'b', id, '나갔는데'))
    await denied(rtGet(rtRef(R(b), `chats/${id}`)))
    assert.equal(await rt(b, `userChats/b/${id}`), null)
    await sendMessage(a, 'a', id, '남은 사람')
    await assert.rejects(createGroup(a, 'a', ['b', 'ghost'], 'x'))
    await assert.rejects(createGroup(a, 'a', ['b'], '둘뿐'))
    const many = Array.from({ length: 10 }, (_, i) => `m${i}`)
    for (const m of many) await signUp(m)
    await createGroup(a, 'a', many, '11명') // no limit any more
    await denied(rtUpdate(rtRef(R(userDb('m0'))), { [`chats/${id}/members/m0`]: true })) // can't add yourself to a group
  })

  test('older pages load by key; newest page first', async () => {
    const a = await signUp('a'); await signUp('b')
    const id = await openDm(a, 'a', 'b')
    for (let i = 0; i < 45; i++) await sendMessage(a, 'a', id, `m${i}`)
    const page = await new Promise<{ text: string; id: string }[]>(res => { const stop = subscribeMessages(a, id, rows => { stop(); res(rows) }) })
    assert.equal(page.length, 40)
    assert.equal(page[39].text, 'm44')
    const older = await loadOlderMessages(a, id, page[0].id)
    assert.deepEqual(older.map(m => m.text), ['m0', 'm1', 'm2', 'm3', 'm4'])
  })
})

describe('chat extras', () => {
  const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(1000)
  const R = (db: Firestore) => rtdbOf.get(db)!
  test('invite: members add people who accept messages (no limit); outsiders can’t', async () => {
    const a = await signUp('a'); await signUp('b'); await signUp('c'); const d = await signUp('d'); await signUp('e')
    const id = await createGroup(a, 'a', ['b', 'c'], '모임')
    await inviteMembers(a, 'a', id, ['d'], '이름a님이 이름d님을 초대했어요')
    assert.deepEqual(Object.keys(await rt(d, `chats/${id}/members`)).sort(), ['a', 'b', 'c', 'd'])
    assert.equal((await rt(d, `chats/${id}/last`)).text, '이름a님이 이름d님을 초대했어요')
    assert.equal(await rt(d, `userChats/d/${id}`), true)
    assert.deepEqual((await getDoc(doc(d, 'chats', id))).data()!.members, ['a', 'b', 'c', 'd'])
    await denied(rtSet(rtRef(R(userDb('e')), `chats/${id}/members/e`), true))
    await setMessagesOff(userDb('e'), 'e', true)
    await assert.rejects(inviteMembers(a, 'a', id, ['e'], 'x'))
    await denied(rtSet(rtRef(R(a), `chats/${id}/members/b`), null)) // can't remove others
    const many = Array.from({ length: 7 }, (_, i) => `m${i}`)
    for (const m of many) await signUp(m)
    await inviteMembers(a, 'a', id, many, 'x') // 11 people: no limit any more
    const dm = await openDm(a, 'a', 'b')
    await assert.rejects(inviteMembers(a, 'a', dm, ['c'], 'x')) // not in 1:1 chats
  })
  test('photos: image in Firestore (members only), message in the Realtime Database', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    const id = await openDm(a, 'a', 'b')
    await sendImage(a, 'a', id, IMG)
    const [key, m] = Object.entries(await rt(b, `msgs/${id}`))[0] as [string, { kind: string }]
    assert.equal(m.kind, 'image')
    assert.equal(await loadImage(b, id, key), IMG)
    await denied(getDoc(doc(c, 'chats', id, 'media', key)))
    await denied(setDoc(doc(a, 'chats', id, 'media', key), { uid: 'a', data: IMG, at: serverTimestamp() })) // no replacing
    await assert.rejects(sendImage(a, 'a', id, 'data:text/html;base64,AAAA'))
    await assert.rejects(sendImage(a, 'a', id, 'data:image/jpeg;base64,' + 'A'.repeat(700_001)))
    await setMessagesOff(b, 'b', true)
    await assert.rejects(sendImage(a, 'a', id, IMG))
  })
  test('타임아웃: only the admin, group chats only; the person can read but not send until it ends', async () => {
    const admin = dbAs(ADMIN)
    await setDoc(doc(admin, 'candidates', ADMIN.uid), newCandidateDoc(ADMIN.uid, '관리자'))
    const b = await signUp('b'); const c = await signUp('c')
    const id = await createGroup(admin, ADMIN.uid, ['b', 'c'], '모임')
    await assert.rejects(setChatTimeout(b, 'b', id, 'c', 600_000, 'b가 c를 타임아웃')) // not the admin
    await setChatTimeout(admin, ADMIN.uid, id, 'c', 600_000, '관리자님이 이름c님을 10분 동안 타임아웃했어요')
    await assert.rejects(sendMessage(c, 'c', id, '말하기')) // timed out
    assert.ok(Object.keys(await rt(c, `msgs/${id}`)).length >= 1) // still reads
    await sendMessage(b, 'b', id, '나는 돼') // others still talk
    const sys = (Object.values(await rt(b, `msgs/${id}`)) as { kind?: string; text: string }[]).find(m => m.kind === 'system')
    assert.equal(sys?.text, '관리자님이 이름c님을 10분 동안 타임아웃했어요')
    await denied(rtSet(rtRef(R(c), `chats/${id}/timeouts/c`), null)) // can't lift it yourself
    await setChatTimeout(admin, ADMIN.uid, id, 'c', 0, '관리자님이 이름c님의 타임아웃을 풀었어요')
    await sendMessage(c, 'c', id, '이제 돼')
    await fetch(`${RTDB}/chats/${id}/timeouts/b.json?ns=${RTDB_NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: String(Date.now() - 1000) })
    await sendMessage(b, 'b', id, '끝났어') // an expired timeout doesn't block
    await assert.rejects(setChatTimeout(admin, ADMIN.uid, await openDm(admin, ADMIN.uid, 'b'), 'b', 600_000, 'x')) // not in 1:1
  })
  test('presence and read times: own entries only, members only', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    const id = await openDm(a, 'a', 'b')
    await markHere(a, 'a', id)
    assert.ok(await rt(a, `reads/a/${id}`))
    await denied(rtSet(rtRef(R(b), `here/${id}/a`), Date.now()))
    await denied(rtSet(rtRef(R(b), `here/${id}/b`), Date.now() + 3600_000)) // too far ahead
    await denied(rtSet(rtRef(R(c), `here/${id}/c`), Date.now())) // not a member
    await denied(rtGet(rtRef(R(b), 'reads/a')))
    await markGone(a, 'a', id)
  })
  test('group icon and name: members only, small images only, not for 1:1', async () => {
    const a = await signUp('a'); await signUp('b'); const c = await signUp('c'); await signUp('d')
    const id = await createGroup(a, 'a', ['b', 'c'], '모임')
    await setGroupInfo(c, id, { photo: IMG, name: '새 이름' })
    assert.equal((await rt(a, `chats/${id}/info`)).name, '새 이름')
    assert.equal(await rt(a, `chatPhotos/${id}`), IMG)
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
  test('상담 stays with the account after a reset until the admin ends it', async () => {
    const anon = dbAs({ uid: 'anon2' }); const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await sendSupport(anon, 'anon2', 'user', '비밀번호를 잊었어요', { exists: false, name: '김철수', loginId: 'a' })
    await denied(getDoc(doc(a, 'support', 'anon2'))) // not linked yet
    await denied(linkTicket(a, 'anon2', 'a')) // only the admin links
    await linkTicket(admin, 'anon2', 'a')
    // logged in as the account: reads and keeps talking
    assert.equal((await getDocs(query(collection(a, 'support'), where('accountUid', '==', 'a')))).size, 1)
    await sendSupport(a, 'anon2', 'user', '로그인했어요', { exists: true })
    assert.equal((await getDocs(collection(a, 'support', 'anon2', 'messages'))).size, 2)
    await denied(getDoc(doc(b, 'support', 'anon2')))
    await assert.rejects(sendSupport(b, 'anon2', 'user', '끼어들기', { exists: true }))
    await assert.rejects(closeTicket(a, 'anon2')) // only 상담원 ends it
    await closeTicket(admin, 'anon2')
    assert.equal((await getDoc(doc(a, 'support', 'anon2'))).data()!.closed, true)
    await assert.rejects(sendSupport(a, 'anon2', 'user', '또 보내기', { exists: true }))
    await assert.rejects(sendSupport(anon, 'anon2', 'user', '또 보내기', { exists: true }))
    await markSupportRead(a, 'anon2', 'user') // can still mark the ending as seen
    await denied(setDoc(doc(anon, 'support', 'anon2', 'messages', 'x'), { from: 'user', text: 'x', at: serverTimestamp() }))
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
    // a: 1st ; c: 2nd with 0 (tied with nobody below) ; b: −1 → 3rd. a and b took part. Earned points stay.
    const [ca, cb, cc] = await Promise.all(['a', 'b', 'c'].map(u => read(a, `candidates/${u}`)))
    assert.deepEqual([ca.score, ca.earned, ca.bonus], [0, 10, 500 + 50])
    assert.deepEqual([cc.bonus], [300])
    assert.deepEqual([cb.score, cb.earned, cb.bonus], [0, 10, 150 + 50])
    assert.equal((await getDoc(doc(a, 'seasonResults', '1'))).data()!.auto, true)
    await run() // not due any more: nothing changes
    assert.equal((await read(a, 'candidates/a')).bonus, 550)
  })
})

describe('예약 메시지 (Realtime Database)', () => {
  test('only chat members schedule into a chat, only for later; only I see and cancel mine', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    const id = await openDm(a, 'a', 'b')
    await scheduleMessage(a, 'a', id, '내일 보자', Date.now() + 3600_000)
    const mine = await rt(a, 'scheduled/a')
    const [key] = Object.keys(mine)
    assert.equal(mine[key].text, '내일 보자'); assert.equal(mine[key].chatId, id)
    await denied(rt(b, 'scheduled/a')) // not b's
    await assert.rejects(scheduleMessage(c, 'c', id, '끼어들기', Date.now() + 3600_000)) // not in the chat
    await denied(rtSet(rtRef(rtdbOf.get(a)!, 'scheduled/a/past'), { chatId: id, text: 'x', at: Date.now() - 1000, createdAt: { '.sv': 'timestamp' } }))
    await denied(rtSet(rtRef(rtdbOf.get(a)!, 'scheduled/a/extra'), { chatId: id, text: 'x', at: Date.now() + 60_000, createdAt: { '.sv': 'timestamp' }, uid: 'b' }))
    await denied(rtSet(rtRef(rtdbOf.get(b)!, 'scheduled/a/forged'), { chatId: id, text: 'x', at: Date.now() + 60_000, createdAt: { '.sv': 'timestamp' } })) // as someone else
    await denied(rtSet(rtRef(rtdbOf.get(a)!, `scheduled/a/${key}/text`), '바꿈')) // no edits: cancel and schedule again
    await cancelScheduled(a, 'a', key)
    assert.equal(await rt(a, 'scheduled/a'), null)
  })
})

describe('거래 내역 / 수상한 포인트 증가 (Realtime Database)', () => {
  test('ledger: only its owner and the admin read it; alerts and the feed are admin-only; nobody but the worker writes', async () => {
    const a = userDb('a'), b = userDb('b'), admin = dbAs(ADMIN)
    const put = (path: string, v: unknown) => fetch(`${RTDB}/${path}.json?ns=${RTDB_NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(v) })
    await put('ledger/a/k1', { at: 1, d: 5, k: 'vote', n: 5 })
    await put('ledgerFeed/k1', { at: 1, d: 5, k: 'vote', n: 5, u: 'a' })
    await put('alerts/a', { at: 2, since: 1, gain: 2000, votes: 0, gifts: 2000, other: 0, points: 2100 })
    await put('ledgerState/a', { up: 1 })
    assert.equal((await rt(a, 'ledger/a')).k1.d, 5)
    assert.equal((await rt(admin, 'ledger/a')).k1.d, 5)
    await denied(rt(b, 'ledger/a'))
    await denied(rt(a, 'ledgerFeed')); await denied(rt(a, 'alerts')); await denied(rt(a, 'ledgerState'))
    assert.equal((await rt(admin, 'alerts')).a.gain, 2000)
    assert.equal((await rt(admin, 'ledgerFeed')).k1.u, 'a')
    await denied(rtSet(rtRef(rtdbOf.get(a)!, 'ledger/a/k2'), { at: 3, d: 999, k: 'grant' }))
    await denied(rtSet(rtRef(rtdbOf.get(a)!, 'alerts/a'), null)) // only the admin dismisses
    await denied(rtSet(rtRef(rtdbOf.get(admin)!, 'alerts/a'), { gain: 1 })) // …and only by removing it
    await rtSet(rtRef(rtdbOf.get(admin)!, 'alerts/a'), null)
    assert.equal(await rt(admin, 'alerts'), null)
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
    const gid = (Object.values(await rt(a, `msgs/${id}`)) as { giftId: string }[])[0].giftId
    await assert.rejects(claimGift(a, 'a', gid)) // not your own
    await claimGift(b, 'b', gid)
    assert.equal(await points(b, 'b'), 120)
    await assert.rejects(claimGift(b, 'b', gid)) // only once
    await assert.rejects(cancelGift(a, 'a', gid)) // already taken
    assert.equal(await points(a, 'a'), 80)
  })
  test('페이크 선물: needs the 299P 패스 (mirrored to perks/); a chat message only, points untouched', async () => {
    const a = await signUp('a'); await signUp('b'); const admin = dbAs(ADMIN)
    const id = await openDm(a, 'a', 'b')
    await denied(sendFakeGift(a, 'a', id, 5000)) // no pass yet
    await assert.rejects(buyPass(a, 'a', 'passFake')) // 0P
    await grantPoints(admin, ADMIN.uid, 'a', 300)
    await denied(updateDoc(doc(a, 'candidates', 'a'), { passFake: true, spent: increment(1) })) // must pay 299
    await buyPass(a, 'a', 'passFake')
    assert.equal(await points(a, 'a'), 1)
    await assert.rejects(buyPass(a, 'a', 'passFake')) // only once
    await denied(rtSet(rtRef(rtdbOf.get(a)!, 'perks/a/fake'), true)) // only the worker writes perks
    await fetch(`${RTDB}/perks/a/fake.json?ns=${RTDB_NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: 'true' }) // what the worker mirrors
    await sendFakeGift(a, 'a', id, 5000)
    const m = (Object.values(await rt(a, `msgs/${id}`)) as { kind?: string; amount?: number; text: string }[]).find(x => x.kind === 'fake')!
    assert.equal(m.amount, 5000); assert.equal(m.text, '🎁 5,000P 선물')
    assert.equal(await points(a, 'a'), 1)
    const at = { '.sv': 'timestamp' }
    const R = (db: Firestore) => rtdbOf.get(db)!
    await denied(rtSet(rtRef(R(a), `msgs/${id}/f1`), { uid: 'a', text: '🎁', kind: 'fake', at })) // no amount
    await denied(rtSet(rtRef(R(a), `msgs/${id}/f2`), { uid: 'a', text: '🎁', kind: 'fake', amount: 1e13, at }))
  })

  test('no cap on gifts or admin grants; 거래 정지 blocks sending and taking (not cancelling) until lifted', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 5_000_000) // over the old 1,000,000 cap
    const id = await openDm(a, 'a', 'b')
    await sendGift(a, 'a', await chatOf(a, id), 2_000_000) // over the old 100,000 cap
    const gid = (Object.values(await rt(a, `msgs/${id}`)) as { giftId: string }[])[0].giftId
    await setTradeBan(admin, ADMIN.uid, 'b', Date.now() + 60_000)
    await assert.rejects(claimGift(b, 'b', gid)) // b can't take it
    await denied(updateDoc(doc(b, 'candidates', 'b'), { tradeBan: 0 })) // nor lift it themselves
    await setTradeBan(admin, ADMIN.uid, 'b', 0)
    await claimGift(b, 'b', gid)
    assert.equal(await points(b, 'b'), 2_000_000)
    await setTradeBan(admin, ADMIN.uid, 'a', TRADE_BAN_FOREVER)
    await assert.rejects(sendGift(a, 'a', await chatOf(a, id), 10)) // a can't send
    assert.equal(await points(a, 'a'), 3_000_000)
  })
  test('거래 정지 also blocks buying items and passes (equipping still works); the admin can 수거 items and passes', async () => {
    const a = await signUp('a'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 20000)
    await buyItem(a, 'a', 'frame', 'neon', priceOf('frame', 'neon'))
    await setTradeBan(admin, ADMIN.uid, 'a', Date.now() + 60_000)
    await denied(buyItem(a, 'a', 'frame', 'crown', priceOf('frame', 'crown')))
    await denied(buyPass(a, 'a', 'passFake'))
    await denied(buyPass(a, 'a'))
    await equipItem(a, 'a', 'frame', 'neon') // using what you have is fine
    await setTradeBan(admin, ADMIN.uid, 'a', 0)
    await buyPass(a, 'a', 'passFake')
    await assert.rejects(revokeItem(a, 'a', 'a', 'frame', 'neon')) // not the admin
    await revokeItem(admin, ADMIN.uid, 'a', 'frame', 'neon')
    const c = await read(a, 'candidates/a')
    assert.deepEqual(c.owned.frame, ['none']); assert.equal(c.frame, 'none') // unequipped too
    await revokeItem(admin, ADMIN.uid, 'a', 'passFake', '')
    assert.equal((await read(a, 'candidates/a')).passFake, undefined)
    await assert.rejects(revokeItem(admin, ADMIN.uid, 'a', 'frame', 'crown')) // doesn't have it
  })
  test('아이템 선물: the price is held, the taker gets the item (not twice, not if owned), 취소 refunds', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 5000)
    const id = await openDm(a, 'a', 'b')
    await sendItemGift(a, 'a', await chatOf(a, id), 'frame', 'matrix')
    assert.equal(await points(a, 'a'), 3000)
    const gids = () => rt(a, `msgs/${id}`).then(m => (Object.values(m) as { giftId?: string }[]).map(x => x.giftId).filter(Boolean) as string[])
    const [g1] = await gids()
    await claimGift(b, 'b', g1)
    const cb = await read(b, 'candidates/b')
    assert.ok(cb.owned.frame.includes('matrix')); assert.equal(pointsOf(cb), 0) // the item, not points
    await assert.rejects(claimGift(b, 'b', g1)) // only once
    // b already has it now: a second copy can't be taken, and a can cancel it for a refund
    await sendItemGift(a, 'a', await chatOf(a, id), 'frame', 'matrix')
    const g2 = (await gids()).find(g => g !== g1)!
    await assert.rejects(claimGift(b, 'b', g2))
    await cancelGift(a, 'a', g2)
    assert.equal(await points(a, 'a'), 3000)
    // a price that isn't the shop price, or 기본, is refused
    const fake = doc(collection(a, 'gifts'))
    const bt = writeBatch(a)
    bt.set(fake, { chatId: id, from: 'a', to: 'b', amount: 1, status: 'open', createdAt: serverTimestamp(), itemKind: 'frame', itemKey: 'matrix' })
    bt.update(doc(a, 'candidates', 'a'), { spent: increment(1), lastGift: fake.id })
    await denied(bt.commit())
  })
  test('패스 선물: 5000P / 299P held, the taker gets the pass (not if they have it), 취소 refunds', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 6000)
    const id = await openDm(a, 'a', 'b')
    const gids = () => rt(a, `msgs/${id}`).then(m => (Object.values(m) as { giftId?: string }[]).map(x => x.giftId).filter(Boolean) as string[])
    await sendItemGift(a, 'a', await chatOf(a, id), 'pass', 'pass2x')
    assert.equal(await points(a, 'a'), 1000)
    const [g1] = await gids()
    await claimGift(b, 'b', g1)
    assert.equal((await read(b, 'candidates/b')).pass2x, true)
    await sendItemGift(a, 'a', await chatOf(a, id), 'pass', 'passFake')
    const g2 = (await gids()).find(g => g !== g1)!
    await claimGift(b, 'b', g2)
    assert.equal((await read(b, 'candidates/b')).passFake, true)
    assert.equal(await points(a, 'a'), 701)
    // b has both now: another 페이크 패스 can't be taken; a cancels it and gets the 299P back
    await sendItemGift(a, 'a', await chatOf(a, id), 'pass', 'passFake')
    const g3 = (await gids()).find(g => g !== g1 && g !== g2)!
    await assert.rejects(claimGift(b, 'b', g3))
    await cancelGift(a, 'a', g3)
    assert.equal(await points(a, 'a'), 701)
    // a pass at the wrong price is refused
    const fake = doc(collection(a, 'gifts')), bt = writeBatch(a)
    bt.set(fake, { chatId: id, from: 'a', to: 'b', amount: 1, status: 'open', createdAt: serverTimestamp(), itemKind: 'pass', itemKey: 'pass2x' })
    bt.update(doc(a, 'candidates', 'a'), { spent: increment(1), lastGift: fake.id })
    await denied(bt.commit())
    // and nobody can just give themselves a pass
    await denied(updateDoc(doc(a, 'candidates', 'a'), { pass2x: true, lastGift: g1 }))
  })
  test('group: first to tap wins; the sender can cancel an untaken gift', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c'); const d = await signUp('d')
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 300)
    const id = await createGroup(a, 'a', ['b', 'c'], '모임')
    await sendGift(a, 'a', await chatOf(a, id), 100)
    await sendGift(a, 'a', await chatOf(a, id), 50)
    const gifts = (Object.entries(await rt(a, `msgs/${id}`)) as [string, { kind?: string; giftId: string }][]).sort(([x], [y]) => (x < y ? -1 : 1)).map(([, m]) => m).filter(m => m.kind === 'gift').map(m => m.giftId)
    const results = await Promise.allSettled([claimGift(b, 'b', gifts[0]), claimGift(c, 'c', gifts[0])])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    await assert.rejects(claimGift(d, 'd', gifts[1])) // not in the chat
    await cancelGift(a, 'a', gifts[1])
    assert.equal(await points(a, 'a'), 300 - (await getDoc(doc(a, 'gifts', gifts[0]))).data()!.amount) // the cancelled one came back
    await assert.rejects(claimGift(b, 'b', gifts[1])) // cancelled
  })
  test('받기 / 취소 write directly for a gift on screen; racing claimers still get exactly one', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c')
    await grantPoints(dbAs(ADMIN), ADMIN.uid, 'a', 300)
    const id = await createGroup(a, 'a', ['b', 'c'], '모임')
    await sendGift(a, 'a', await chatOf(a, id), 100)
    await sendGift(a, 'a', await chatOf(a, id), 40)
    const gifts = (Object.entries(await rt(a, `msgs/${id}`)) as [string, { kind?: string; giftId: string }][]).sort(([x], [y]) => (x < y ? -1 : 1)).map(([, m]) => m).filter(m => m.kind === 'gift').map(m => m.giftId)
    const stops = gifts.map(g => subscribeGift(b, g, () => {}))
    await new Promise(r => setTimeout(r, 500))
    const results = await Promise.allSettled([claimGift(b, 'b', gifts[0]), claimGift(c, 'c', gifts[0])])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    const winner = (await getDoc(doc(a, 'gifts', gifts[0]))).data()!.claimedBy as string
    assert.equal(await points(winner === 'b' ? b : c, winner), (await getDoc(doc(a, 'gifts', gifts[0]))).data()!.amount)
    await cancelGift(a, 'a', gifts[1])
    await assert.rejects(claimGift(b, 'b', gifts[1]), /gift-gone/) // it was cancelled even if the screen was behind
    stops.forEach(s => s())
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

describe('공지 투표', () => {
  test('admin posts a poll; members vote once, in range; only the admin sees results', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await assert.rejects(postNotice(admin, ADMIN.uid, '투표', '골라요', undefined, ['하나']))
    const id = await postNotice(admin, ADMIN.uid, '점심 투표', '뭐 먹을까요?', undefined, ['피자', '치킨', '떡볶이'])
    await voteNotice(a, 'a', id, 1)
    await voteNotice(b, 'b', id, 1)
    await denied(voteNotice(a, 'a', id, 0)) // once
    await denied(setDoc(doc(b, 'notices', id, 'votes', 'b2'), { choice: 0, at: serverTimestamp() })) // someone else's
    const c = await signUp('c')
    await denied(voteNotice(c, 'c', id, 3)) // no such option
    await denied(getDocs(collection(a, 'notices', id, 'votes')))
    const [r] = await pollResults(admin)
    assert.deepEqual([r.title, r.options, r.counts], ['점심 투표', ['피자', '치킨', '떡볶이'], [0, 2, 0]])
    const plain = await postNotice(admin, ADMIN.uid, '그냥 공지', '내용')
    await denied(voteNotice(a, 'a', plain, 0)) // no poll
  })
})

describe('ranking ties', () => {
  test('same score: whoever reached it first ranks higher; ranks never repeat, rewards follow', async () => {
    await signUp('a'); await signUp('b'); const c = await signUp('c'); const d = await signUp('d')
    await castVote(c, 'c', 'b', 'up') // b reaches 1 first
    await new Promise(r => setTimeout(r, 30))
    await castVote(d, 'd', 'a', 'up') // a reaches 1 later
    const rows = (await getDocs(collection(c, 'candidates'))).docs.map(x => ({ id: x.id, ...(x.data() as CandidateDoc) }))
    const people = buildPeople(rows as never, {}, null)
    assert.deepEqual(people.slice(0, 2).map(p => [p.id, p.rank]), [['b', 1], ['a', 2]])
    assert.equal(new Set(people.map(p => p.rank)).size, people.length)
    const paid = computeRewards(rows, new Set(), DEFAULT_REWARDS)
    assert.deepEqual(paid.slice(0, 2).map(p => [p.id, p.rank]), [['b', 1], ['a', 2]])
    await denied(updateDoc(doc(c, 'candidates', 'b'), { scoreAt: new Date(0) })) // can't back-date who got there first
  })
})

describe('moving chats to the Realtime Database', () => {
  test('the worker copies old Firestore chats once: members, lists, messages in order, replies, photos, 메시지 끄기', async () => {
    const a = await signUp('a'); await signUp('b'); await signUp('c')
    const fs = `http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents`
    const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
    const ts = (ms: number) => ({ timestampValue: new Date(ms).toISOString() })
    const t0 = Date.now() - 3600_000
    await fetch(`${fs}/chats?documentId=g1`, { method: 'POST', headers: H, body: JSON.stringify({ fields: {
      type: { stringValue: 'group' }, name: { stringValue: '옛날방' }, createdBy: { stringValue: 'a' }, createdAt: ts(t0), updatedAt: ts(t0 + 3000),
      members: { arrayValue: { values: ['a', 'b', 'c'].map(v => ({ stringValue: v })) } },
      mutes: { mapValue: { fields: { c: { booleanValue: true } } } },
    } }) })
    const msg = (id: string, uid: string, text: string, at: number, extra: Record<string, unknown> = {}) =>
      fetch(`${fs}/chats/g1/messages?documentId=${id}`, { method: 'POST', headers: H, body: JSON.stringify({ fields: { uid: { stringValue: uid }, text: { stringValue: text }, at: ts(at), ...extra } }) })
    await msg('zzzFirst', 'a', '첫 메시지', t0 + 1000)
    await msg('aaaSecond', 'b', '답장', t0 + 2000, { replyTo: { mapValue: { fields: { id: { stringValue: 'zzzFirst' }, uid: { stringValue: 'a' }, text: { stringValue: '첫 메시지' } } } } })
    await msg('mmmPhoto', 'c', '', t0 + 3000, { kind: { stringValue: 'image' } })
    await updateDoc(doc(userDb('b'), 'candidates', 'b'), { msgOff: true })
    await new Promise<void>((resolve, reject) => execFile('node', ['../.github/scripts/send-notifications.mjs'], {
      env: { ...process.env, FIRESTORE_BASE: `http://${HOST}:${PORT}/v1`, FCM_BASE: 'http://127.0.0.1:9', PROJECT_ID: PROJECT, RUN_FOR_MS: '0', SETTLE_MS: '0' },
    }, (err, stdout, stderr) => err ? reject(new Error(stderr || stdout)) : resolve()))
    const list = Object.entries(await rt(a, 'msgs/g1')).sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, m]) => ({ k, ...(m as Record<string, unknown>) }))
    assert.deepEqual(list.map(m => m.text), ['첫 메시지', '답장', ''])
    assert.equal((list[1].replyTo as { id: string }).id, list[0].k)
    assert.equal(list[2].mediaId, 'mmmPhoto')
    assert.equal((await rt(a, 'chats/g1/info')).name, '옛날방')
    assert.equal((await rt(a, 'chats/g1/last')).text, '사진')
    assert.equal((await rt(a, 'chats/g1/mutes')).c, true)
    assert.equal(await rt(a, 'userChats/a/g1'), true)
    assert.equal(await rt(a, 'msgOff/b'), true)
    assert.equal((await rt(a, 'meta/chatMigration')).done, true)
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
    const dm2 = await openDm(c, 'c', 'b')
    await sendMessage(c, 'c', dm2, '읽은 메시지')
    await markRead(b, 'b', dm2) // read in the open chat (receipts doc): no push for it
    const dm3 = await openDm(c, 'c', 'a')
    await markHere(a, 'a', dm3) // a has this room open on screen
    await sendMessage(c, 'c', dm3, '방에 있어요')
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
    // The worker also keeps the one-doc leaderboard: every candidate, photo left out (a version instead).
    const board = (await getDoc(doc(a, 'meta', 'board'))).data()!
    assert.deepEqual(board.rows.map((r: { id: string }) => r.id).sort(), ['a', 'b', 'c'])
    assert.ok(board.rows.every((r: Record<string, unknown>) => !('photoURL' in r) && 'pv' in r && 'score' in r && 'name' in r))
    await denied(setDoc(doc(a, 'meta', 'board'), { rows: [] }))
    assert.deepEqual(to('tok-b'), ['이름a|안녕 b'], JSON.stringify(got))
    assert.ok(!to('tok-b').some(x => x.includes('단톡 첫 메시지')), 'b sent it, b must not be notified')
    assert.ok(to('tok-a').includes('모임|이름b: 단톡 첫 메시지'))
    assert.ok(!to('tok-a').some(x => x.includes('방에 있어요')), 'a was in that room, no push')
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

describe('몰래 도박장', () => {
  const pts = async (db: Firestore, u: string) => pointsOf(await read(db, `candidates/${u}`))
  // A bet written by hand (no payout step), like an app that closed right after betting.
  async function rawBet(db: Firestore, uid: string, amount: number) {
    const ref = doc(collection(db, 'gambles')), b = writeBatch(db)
    b.set(ref, { uid, amount, at: serverTimestamp(), paid: false })
    b.update(doc(db, 'candidates', uid), { spent: increment(amount), lastBet: ref.id })
    await b.commit()
    const d = (await getDoc(ref)).data()!
    return { id: ref.id, won: d.at.nanoseconds % 3000 < 1000 }
  }
  const payBy = (db: Firestore, uid: string, id: string, amount: number) => {
    const b = writeBatch(db)
    b.update(doc(db, 'gambles', id), { paid: true })
    b.update(doc(db, 'candidates', uid), { bonus: increment(amount * 2), payBet: id })
    return b.commit()
  }

  test('bets settle by the server: about 1 in 3 doubles, points add up exactly', async () => {
    const a = await signUp('a'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 1_000_000)
    const start = await pts(a, 'a')
    let expect = start, wins = 0
    for (let i = 0; i < 30; i++) {
      const bet = await placeBet(a, 'a', 1000)
      expect += bet.won ? 1000 : -1000
      if (bet.won) { wins++; assert.equal(bet.paid, true) }
    }
    assert.equal(await pts(a, 'a'), expect)
    assert.ok(wins > 0 && wins < 30, `wins ${wins}`)
  })
  test('refused: betting more than you have, collecting a lost bet, collecting twice, a win without a bet', async () => {
    const a = await signUp('a'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 100_000)
    await assert.rejects(placeBet(a, 'a', (await pts(a, 'a')) + 1))
    let lost: string | null = null, won: string | null = null
    for (let i = 0; i < 40 && (!lost || !won); i++) {
      const r = await rawBet(a, 'a', 100)
      if (r.won && !won) { won = r.id; await payBy(a, 'a', r.id, 100) } else if (!r.won) lost = r.id
    }
    assert.ok(lost && won)
    await denied(payBy(a, 'a', lost!, 100)) // lost is lost
    await denied(payBy(a, 'a', won!, 100)) // already paid
    await denied(updateDoc(doc(a, 'candidates', 'a'), { bonus: increment(1000), payBet: 'nope' }))
    await denied(updateDoc(doc(a, 'candidates', 'a'), { spent: increment(-100), lastBet: 'x' })) // no refunds
    await denied(updateDoc(doc(a, 'gambles', lost!), { paid: true }))
    await denied(deleteDoc(doc(a, 'gambles', lost!)))
    // a back-dated bet (to pick a winning time) or someone else's name
    await denied(setDoc(doc(a, 'gambles', 'old'), { uid: 'a', amount: 100, at: new Date(Date.now() - 5000), paid: false }))
    await denied(setDoc(doc(a, 'gambles', 'mine'), { uid: 'a', amount: 100, at: serverTimestamp(), paid: false })) // points not taken
  })
  test('an unpaid win is paid on the next visit; nobody else can see or take it; 거래 정지 blocks betting', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 100_000)
    let win: string | null = null
    for (let i = 0; i < 40 && !win; i++) { const r = await rawBet(a, 'a', 500); if (r.won) win = r.id }
    assert.ok(win)
    await denied(getDoc(doc(b, 'gambles', win!)))
    await denied(payBy(b, 'b', win!, 500))
    const before = await pts(a, 'a')
    const paid = await settleLastBet(a, 'a', (await read(a, 'candidates/a')).lastBet as string)
    assert.equal(paid?.amount, 500)
    assert.equal(await pts(a, 'a'), before + 1000)
    assert.equal(await settleLastBet(a, 'a', win!), null) // once only
    await setTradeBan(admin, ADMIN.uid, 'a', Date.now() + 60_000)
    await assert.rejects(placeBet(a, 'a', 100))
  })
})

describe('당근마켓', () => {
  const pts = async (db: Firestore, u: string) => pointsOf(await read(db, `candidates/${u}`))
  const me = async (db: Firestore, u: string) => ({ id: u, ...(await read(db, `candidates/${u}`)) }) as { id: string; frame: string; plate: string; skin: string }
  const open = (db: Firestore) => new Promise<Listing[]>(res => { const off = subscribeMarket(db, r => { off(); res(r) }) })
  test('list (escrow, taken off if worn) → someone buys: item moves, points move; can\'t buy twice', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const c = await signUp('c'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 1000); await grantPoints(admin, ADMIN.uid, 'b', 1000); await grantPoints(admin, ADMIN.uid, 'c', 1000)
    await buyItem(a, 'a', 'frame', 'crown', priceOf('frame', 'crown'))
    await listItem(a, await me(a, 'a'), 'frame', 'crown', 500)
    let ca = await read(a, 'candidates/a')
    assert.ok(!ca.owned.frame.includes('crown')); assert.equal(ca.frame, 'none')
    const [l] = await open(b)
    assert.equal(l.price, 500)
    const before = await pts(a, 'a')
    await buyListing(b, 'b', l)
    assert.ok((await read(b, 'candidates/b')).owned.frame.includes('crown'))
    assert.equal(await pts(b, 'b'), 500)
    assert.equal(await pts(a, 'a'), before + 500)
    await assert.rejects(buyListing(c, 'c', l)) // sold already
    assert.equal((await open(c)).length, 0)
  })
  test('passes too; take-down gives it back; refused: selling what you don\'t have, buying your own, overspending, a free item, a fake payout', async () => {
    const a = await signUp('a'); const b = await signUp('b'); const admin = dbAs(ADMIN)
    await grantPoints(admin, ADMIN.uid, 'a', 6000); await grantPoints(admin, ADMIN.uid, 'b', 100)
    await denied(listItem(a, await me(a, 'a'), 'frame', 'crown', 10)) // doesn't own it
    await denied(listItem(a, await me(a, 'a'), 'pass', 'pass2x', 10))
    await buyPass(a, 'a', 'pass2x')
    await listItem(a, await me(a, 'a'), 'pass', 'pass2x', 5000)
    assert.equal((await read(a, 'candidates/a')).pass2x, false)
    let [l] = await open(a)
    await assert.rejects(buyListing(a, 'a', l)) // own listing
    await assert.rejects(buyListing(b, 'b', l)) // b has 100P
    // item without paying / paying the seller without a sale
    const bt = writeBatch(b)
    bt.update(doc(b, 'market', l.id), { status: 'sold', buyer: 'b', doneAt: serverTimestamp() })
    bt.update(doc(b, 'candidates', 'b'), { pass2x: true, lastMarket: l.id })
    await denied(bt.commit())
    await denied(updateDoc(doc(b, 'candidates', 'a'), { bonus: increment(99999), lastSale: l.id }))
    // take-down: it comes back
    await cancelListing(a, 'a', l)
    assert.equal((await read(a, 'candidates/a')).pass2x, true)
    await assert.rejects(buyListing(b, 'b', l))
    await denied(cancelListing(b, 'b', l))
    // 거래 정지: no listing
    await setTradeBan(admin, ADMIN.uid, 'a', Date.now() + 60_000)
    await denied(listItem(a, await me(a, 'a'), 'pass', 'pass2x', 10))
  })
})
