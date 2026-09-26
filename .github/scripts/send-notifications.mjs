// Background worker. Runs from .github/workflows/notify.yml (which re-starts
// itself when a run ends) and, from real-time listeners only, sends:
//   - new chat messages  → each other member (unless they muted that chat, already
//     read it, or turned 새 메시지 off)
//   - new 추천 / 비추천   → the person who received it (never says who voted)
//   - 상담 (support) messages → the admin, and 상담원 replies → the linked account
// through Firebase Cloud Messaging (HTTP v1) to every device in pushTokens.
// meta/notifyCursor remembers how far it got, so nothing is sent twice across runs.
// It also applies admin password resets (pwResets/{uid}, status 'pending') and ends
// seasons when their end date passes.
//
// Firestore reads are the scarce resource (the free plan allows 50,000 a day). Every
// input comes from a listener — the chat doc already carries the latest message
// (chat.last), settings and push tokens are held in memory — so a message costs the
// worker about one read, and a run's start-up costs roughly one read per settings /
// token doc. Runs last hours, so start-ups are rare.
// Uses the service account (rules don't apply); clients can't read any of it.

import { call, getAccessToken, loadServiceAccount, notice, warn } from './lib/google.mjs'

// FIRESTORE_BASE / FCM_BASE / PROJECT_ID are for testing against the emulator and a fake FCM.
const LOCAL = !!process.env.FIRESTORE_BASE
const key = LOCAL ? null : loadServiceAccount()
const project = LOCAL ? process.env.PROJECT_ID : key.project_id
const FS = process.env.FIRESTORE_BASE || 'https://firestore.googleapis.com/v1'
const FCM = process.env.FCM_BASE || 'https://fcm.googleapis.com'
const docsRoot = `projects/${project}/databases/(default)/documents`
const api = `${FS}/${docsRoot}`
const SITE = process.env.SITE_URL || 'https://devtoolxd.github.io/vote/'
const RUN_FOR_MS = Number(process.env.RUN_FOR_MS ?? 4 * 60_000)
// Long enough for someone with the chat open to send their read receipt (the app sends one within ~4 s).
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 5000)
const AUTH = process.env.AUTH_BASE || 'https://identitytoolkit.googleapis.com'

let token = null, tokenAt = 0
async function headers() {
  if (LOCAL) return { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
  if (!token || Date.now() - tokenAt > 45 * 60_000) { token = await getAccessToken(key); tokenAt = Date.now() }
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// ---- Firestore REST helpers ----
function val(v) {
  if (!v) return undefined
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return new Date(v.timestampValue).getTime()
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(val)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, val(x)]))
  return undefined
}
const docData = d => ({ id: d.name.split('/').pop(), path: d.name, ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, val(v)])) })

async function runQuery(parent, structuredQuery) {
  const r = await call(`${FS}/${parent}:runQuery`, { method: 'POST', headers: await headers(), body: JSON.stringify({ structuredQuery }) })
  if (!r.ok) throw new Error(`runQuery ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`)
  return (Array.isArray(r.json) ? r.json : []).filter(x => x.document).map(x => docData(x.document))
}
// ---- in-memory state, kept fresh by listeners (see main loop) ----
const settings = new Map() // uid → { notify, notifyMsg, notifyVote }
const tokens = new Map()   // uid → [{ token, platform, ref }]
const candidates = new Map() // uid → candidate doc (the leaderboard; also gives names)
const roomReads = new Map()  // chatId → { uid: Timestamp } (chats/{id}/state/reads)
const settingsOf = uid => ({ notify: true, notifyMsg: true, notifyVote: true, ...settings.get(uid) })
const tokensOf = uid => tokens.get(uid) ?? []
const nameOf = async uid => candidates.get(uid)?.name ?? '알 수 없음'

// ---- meta/board: the whole leaderboard in one doc ----
// Every app used to listen to every candidate doc: opening the app cost one read per
// person, and every vote one read per open app. The board carries everything public
// except the photo (a photo "version" instead; apps fetch a photo once per version and
// keep it on the device), so opening the app costs one read. Same fields and hash as
// app/src/backend/board.ts.
function photoVersion(s) {
  if (!s) return ''
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return s.length.toString(36) + '-' + h.toString(36)
}
const BOARD_SKIP = new Set(['photoURL', 'createdAt', 'lastGift', 'ownerUid'])
function boardRows() {
  return [...candidates.entries()].map(([id, c]) => {
    const row = { id, pv: photoVersion(c.photoURL ?? '') }
    for (const [k, v] of Object.entries(c)) if (!BOARD_SKIP.has(k) && !(v instanceof Timestamp)) row[k] = v
    return row
  }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}
let boardDirty = true, boardWrittenAt = 0, boardLast = ''
const BOARD_HEARTBEAT_MS = 20 * 60_000
async function writeBoard() {
  const rows = boardRows()
  const json = JSON.stringify(rows)
  const heartbeat = Date.now() - boardWrittenAt > BOARD_HEARTBEAT_MS
  boardDirty = false
  if (json === boardLast && !heartbeat) return
  if (json.length > 900_000) { warn(`Board too big (${json.length} bytes); apps fall back to reading every candidate.`); return }
  await fdb.doc('meta/board').set({ at: FieldValue.serverTimestamp(), rows })
  boardLast = json; boardWrittenAt = Date.now(); boardWrites++
}
let boardWrites = 0

// ---- sending ----
let sent = 0, dropped = 0
async function push(uid, { title, body, url, tag }) {
  for (const t of tokensOf(uid)) {
    const message = t.platform === 'android'
      ? { token: t.token, notification: { title, body }, data: { url, tag }, android: { priority: 'HIGH', notification: {
          tag, sound: 'default', channel_id: tag.startsWith('chat-') || tag.startsWith('support-') ? 'messages' : 'votes',
          notification_priority: 'PRIORITY_MAX', default_vibrate_timings: true, visibility: 'PUBLIC',
        } } }
      : { token: t.token, data: { title, body, url, tag }, webpush: { headers: { Urgency: 'high', TTL: '86400' } } }
    const r = await call(`${FCM}/v1/projects/${project}/messages:send`, { method: 'POST', headers: await headers(), body: JSON.stringify({ message }) })
    if (r.ok) { sent++; continue }
    const code = r.json?.error?.details?.find?.(d => d.errorCode)?.errorCode ?? r.json?.error?.status
    if (r.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
      // The app was uninstalled / permission revoked / token rotated: forget this device.
      await t.ref.delete().catch(() => {})
      dropped++
    } else {
      warn(`FCM send failed (${r.status} ${code ?? ''})`)
    }
  }
}

// A chat whose latest message (chat.last) is new → each other member, once per burst.
async function notifyChat(chat, count) {
  const last = chat.last
  for (const member of chat.members ?? []) {
    if (member === last.uid || chat.mutes?.[member]) continue
    const room = roomReads.get(chat.id)
    const readMs = Math.max(chat.reads?.[member]?.toMillis?.() ?? 0, room?.[member]?.toMillis?.() ?? 0, room?.here?.[member]?.toMillis?.() ?? 0)
    if (readMs >= last.at.toMillis()) continue // read it, or has the room open right now
    const s = settingsOf(member)
    if (s.notify === false || s.notifyMsg === false) continue
    const sender = await nameOf(last.uid)
    const more = count > 1 ? ` (+${count - 1})` : ''
    await push(member, chat.type === 'group'
      ? { title: chat.name || '단톡방', body: `${sender}: ${last.text}${more}`, url: `${SITE}?tab=msg&chat=${chat.id}`, tag: `chat-${chat.id}` }
      : { title: sender, body: last.text + more, url: `${SITE}?tab=msg&chat=${chat.id}`, tag: `chat-${chat.id}` })
  }
}

async function notifyVotes(per) {
  for (const [uid, n] of per) {
    const s = settingsOf(uid)
    if (s.notify === false || s.notifyVote === false) continue
    const body = n.up && n.down ? `추천 ${n.up}개, 비추천 ${n.down}개를 받았어요`
      : n.up ? (n.up > 1 ? `추천 ${n.up}개를 받았어요` : '누군가 회원님을 추천했어요')
        : (n.down > 1 ? `비추천 ${n.down}개를 받았어요` : '누군가 회원님을 비추천했어요')
    await push(uid, { title: '인기투표', body, url: SITE, tag: 'votes' })
  }
}

async function notifySupport(t) {
  if (t.last?.from === 'admin') {
    // 상담원's replies reach the person once the 상담 is linked to their account (after a password reset).
    if (t.accountUid) await push(t.accountUid, { title: '상담원', body: t.last.text, url: `${SITE}?tab=acct&support=mine`, tag: `support-${t.id}` })
    return
  }
  const admin = await adminUid()
  if (admin) await push(admin, { title: `상담 · ${t.name || t.loginId || '이름 없음'}`, body: t.last.text, url: `${SITE}?tab=admin&support=${t.id}`, tag: `support-${t.id}` })
}

let adminCache
async function adminUid() {
  if (adminCache !== undefined) return adminCache
  if (LOCAL) return (adminCache = process.env.ADMIN_UID || null)
  const r = await call(`${AUTH}/v1/projects/${project}/accounts:lookup`, { method: 'POST', headers: await headers(), body: JSON.stringify({ email: ['admin@vote.local'] }) })
  return (adminCache = r.json?.users?.[0]?.localId ?? null)
}

// Admin password resets: set the password to the one-time code, then mark done.
async function passwordResets() {
  const pending = await runQuery(docsRoot, {
    from: [{ collectionId: 'pwResets' }],
    where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } } },
  })
  for (const r of pending) {
    let status = 'done'
    if (!LOCAL || process.env.AUTH_BASE) {
      const up = await call(`${AUTH}/v1/projects/${project}/accounts:update`, { method: 'POST', headers: await headers(), body: JSON.stringify({ localId: r.id, password: r.code }) })
      if (!up.ok) { status = 'error'; warn(`Password reset for ${r.id} failed (${up.status})`) }
    }
    await call(`${FS}/${r.path}?updateMask.fieldPaths=status`, { method: 'PATCH', headers: await headers(), body: JSON.stringify({ fields: { status: { stringValue: status } } }) })
    resets++
  }
}
let resets = 0

// ---- season end ----
// When meta/season.endsAt has passed: pay rewards (same rules as app/src/backend/rewards.ts),
// carry this season's 추천 over as points, zero the tallies, record the podium and results,
// and start the next season — all in one commit, guarded by the season doc's updateTime so
// it can only happen once.
const DEFAULT_REWARDS = { first: 500, second: 300, third: 150, top6: 90, participant: 50 }
function computeRewards(cands, voters, r) {
  const sorted = [...cands].sort((a, b) => b.score - a.score)
  let rank = 0
  return sorted.map((c, i) => {
    if (i === 0 || c.score !== sorted[i - 1].score) rank += 1
    const place = rank === 1 ? r.first : rank === 2 ? r.second : rank === 3 ? r.third : rank <= 6 ? r.top6 : 0
    const took = (c.up ?? 0) + (c.down ?? 0) > 0 || voters.has(c.id)
    return { id: c.id, name: c.name ?? '', rank, points: place + (took ? r.participant : 0) }
  })
}
function fsValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return { integerValue: String(Math.trunc(v)) }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsValue) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fsValue(x)])) } }
}
let seasonsEnded = 0
async function endSeasonIfDue() {
  const r = await call(`${api}/meta/season`, { headers: await headers() })
  if (!r.ok) return
  const season = docData(r.json)
  if (!season.endsAt || Date.now() < season.endsAt) return
  const number = season.number ?? 1
  const rewards = season.rewards ?? DEFAULT_REWARDS
  const cands = (await runQuery(docsRoot, { from: [{ collectionId: 'candidates' }] }))
  const voters = new Set((await runQuery(docsRoot, {
    from: [{ collectionId: 'votes' }],
    where: { fieldFilter: { field: { fieldPath: 'season' }, op: 'EQUAL', value: { integerValue: String(number) } } },
  })).map(v => v.uid))
  const paid = computeRewards(cands, voters, rewards)
  const pointsFor = new Map(paid.map(p => [p.id, p.points]))
  const top = [...cands].sort((a, b) => b.score - a.score || (b.up ?? 0) - (a.up ?? 0)).slice(0, 3)
    .map(c => ({ id: c.id, name: c.name ?? '', score: c.score ?? 0, frame: c.frame ?? 'none' }))
  const now = new Date()
  const writes = [{
    update: { name: `${docsRoot}/meta/season`, fields: fsValue({ name: `${number + 1}`, number: number + 1, startedAt: now, last: { name: season.name ?? 'BETA', top }, rewards }).mapValue.fields },
    currentDocument: { updateTime: r.json.updateTime },
  }, {
    update: { name: `${docsRoot}/seasonResults/${number}`, fields: fsValue({ name: season.name ?? 'BETA', endedAt: now, rewards, paid: paid.filter(p => p.points > 0), auto: true }).mapValue.fields },
  }]
  for (const c of cands) {
    const reward = pointsFor.get(c.id) ?? 0
    if (!c.up && !c.down && !c.score && !reward) continue
    writes.push({
      update: { name: c.path, fields: fsValue({ up: 0, down: 0, score: 0, bonus: (c.bonus ?? 0) + (c.up ?? 0) + reward }).mapValue.fields },
      updateMask: { fieldPaths: ['up', 'down', 'score', 'bonus'] },
    })
  }
  if (writes.length > 500) { warn(`Season end needs ${writes.length} writes (> 500); end it from the 관리 tab instead.`); return }
  const c = await call(`${FS}/${docsRoot}:commit`, { method: 'POST', headers: await headers(), body: JSON.stringify({ writes }) })
  if (!c.ok) { warn(`Ending season ${number} failed (${c.status}) ${JSON.stringify(c.json).slice(0, 200)}`); return }
  seasonsEnded++
  notice(`Season ${number} (${season.name}) ended automatically: rewards paid to ${paid.filter(p => p.points > 0).length} people.`)
}

// ---- main loop ----
import { execFile } from 'node:child_process'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'

if (LOCAL) process.env.FIRESTORE_EMULATOR_HOST = new URL(FS).host
const adminApp = initializeApp(LOCAL ? { projectId: project } : { credential: cert(key), projectId: project })
const fdb = getFirestore(adminApp)

const cursorRef = fdb.doc('meta/notifyCursor')
const started = Date.now()
let cursor = (await cursorRef.get()).get('at')?.toMillis() ?? Date.now() - 5 * 60_000
const since = Timestamp.fromMillis(cursor)
const ms = t => t?.toMillis?.() ?? 0

// Events waiting to be sent (each is sent once it is SETTLE_MS old, so someone who has
// the chat open has time to mark it read first).
const chatEvents = new Map()    // chatId → { chat, count, at }
const voteEvents = []            // { candidateId, kind, at }
const supportEvents = new Map()  // ticketId → { ticket, at }
const lastSeenAt = new Map()     // chatId → last.at already queued (a chat doc also changes on read receipts)
let resetsPending = false
let seasonEndsAt = null

const listeners = []
const firstDone = new Promise(resolve => {
  const seen = new Set(), total = 9
  const done = name => { if (!seen.has(name)) { seen.add(name); if (seen.size === total) resolve() } }
  const listen = (name, ref, onSnap) => ref.onSnapshot(snap => { onSnap(snap); done(name) }, err => { warn(`Listener ${name} failed: ${err.message}`); done(name) })
  listeners.push(
    listen('candidates', fdb.collection('candidates'), snap => {
      for (const c of snap.docChanges()) c.type === 'removed' ? candidates.delete(c.doc.id) : candidates.set(c.doc.id, c.doc.data())
      if (snap.docChanges().length) boardDirty = true
    }),
    listen('reads', fdb.collectionGroup('state'), snap => {
      for (const c of snap.docChanges()) if (c.doc.id === 'reads') roomReads.set(c.doc.ref.parent.parent.id, c.doc.data())
    }),
    listen('settings', fdb.collection('settings'), snap => snap.docChanges().forEach(c => c.type === 'removed' ? settings.delete(c.doc.id) : settings.set(c.doc.id, c.doc.data()))),
    listen('tokens', fdb.collection('pushTokens'), snap => {
      tokens.clear()
      snap.forEach(d => { const t = d.data(); if (!t.uid) return; if (!tokens.has(t.uid)) tokens.set(t.uid, []); tokens.get(t.uid).push({ token: t.token ?? d.id, platform: t.platform, ref: d.ref }) })
    }),
    listen('chats', fdb.collection('chats').where('updatedAt', '>', since), snap => {
      for (const c of snap.docChanges()) {
        if (c.type === 'removed') continue
        const chat = { id: c.doc.id, ...c.doc.data() }
        const at = ms(chat.last?.at)
        const queued = chatEvents.get(chat.id)
        if (queued) queued.chat = chat // keep reads / mutes current
        if (!chat.last?.uid || at <= cursor || at <= (lastSeenAt.get(chat.id) ?? 0)) continue
        lastSeenAt.set(chat.id, at)
        chatEvents.set(chat.id, { chat, count: (queued?.count ?? 0) + 1, at })
      }
    }),
    listen('votes', fdb.collection('votes').where('updatedAt', '>', since), snap => {
      for (const c of snap.docChanges()) {
        if (c.type === 'removed') continue
        const v = c.doc.data(), at = ms(v.updatedAt)
        // This week's vote as it is now (a new vote or a switch); a cancel isn't announced.
        if (at > cursor && v.candidateId && (v.weekKind === 'up' || v.weekKind === 'down')) voteEvents.push({ candidateId: v.candidateId, kind: v.weekKind, at })
      }
    }),
    listen('support', fdb.collection('support').where('updatedAt', '>', since), snap => {
      for (const c of snap.docChanges()) {
        if (c.type === 'removed') continue
        const t = { id: c.doc.id, ...c.doc.data() }, at = ms(t.last?.at)
        if (t.last?.text && at > cursor && at > (supportEvents.get(t.id)?.at ?? 0)) supportEvents.set(t.id, { ticket: { ...t, last: { ...t.last } }, at })
      }
    }),
    listen('resets', fdb.collection('pwResets').where('status', '==', 'pending'), snap => { if (!snap.empty) resetsPending = true }),
    listen('season', fdb.doc('meta/season'), snap => { const e = snap.get('endsAt'); seasonEndsAt = e ? e.toMillis() : null }),
  )
})
await firstDone

// A newer commit on main (new worker code or rules): stop, and the workflow starts a fresh run.
async function newerCodeOnMain() {
  if (LOCAL || !process.env.GITHUB_TOKEN || !process.env.GITHUB_SHA) return false
  try {
    const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/main`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.sha' } })
    return r.ok && (await r.text()).trim() !== process.env.GITHUB_SHA
  } catch { return false }
}
// Firestore rules: re-deployed hourly if they differ from this checkout (no Firestore reads).
const rulesCheck = () => new Promise(res => execFile('node', ['.github/scripts/deploy-firestore-rules.mjs'], { env: { ...process.env, SKIP_IF_SAME: '1' } }, err => { if (err) warn('Hourly rules check failed: ' + err.message); res() }))

let rounds = 0
const TICK_MS = Number(process.env.TICK_MS ?? 3000)
let nextCodeCheck = Date.now() + 10 * 60_000, nextRules = Date.now() + 60 * 60_000
while (true) {
  const due = Date.now() - SETTLE_MS
  let sentUpTo = 0
  for (const [id, e] of chatEvents) {
    if (e.at > due) continue
    chatEvents.delete(id)
    await notifyChat(e.chat, e.count)
    sentUpTo = Math.max(sentUpTo, e.at)
  }
  const readyVotes = voteEvents.filter(v => v.at <= due)
  if (readyVotes.length) {
    voteEvents.splice(0, voteEvents.length, ...voteEvents.filter(v => v.at > due))
    const per = new Map()
    for (const v of readyVotes) { const n = per.get(v.candidateId) ?? { up: 0, down: 0 }; n[v.kind]++; per.set(v.candidateId, n); sentUpTo = Math.max(sentUpTo, v.at) }
    await notifyVotes(per)
  }
  for (const [id, e] of supportEvents) {
    if (e.at > due) continue
    supportEvents.delete(id)
    await notifySupport(e.ticket)
    sentUpTo = Math.max(sentUpTo, e.at)
  }
  if (sentUpTo > cursor) {
    cursor = sentUpTo
    await cursorRef.set({ at: Timestamp.fromMillis(cursor) }, { merge: true })
    rounds++
  }
  if (boardDirty || Date.now() - boardWrittenAt > BOARD_HEARTBEAT_MS) await writeBoard().catch(e => warn('Writing the board failed: ' + e.message))
  if (resetsPending) { resetsPending = false; await passwordResets() }
  if (seasonEndsAt && Date.now() >= seasonEndsAt) { seasonEndsAt = null; await endSeasonIfDue().catch(e => warn('Season end check failed: ' + e)) }
  if (Date.now() >= nextRules && !LOCAL) { nextRules = Date.now() + 60 * 60_000; await rulesCheck() }
  if (Date.now() >= nextCodeCheck) { nextCodeCheck = Date.now() + 10 * 60_000; if (await newerCodeOnMain()) { notice('Newer code on main; handing over to a fresh run.'); break } }
  if (Date.now() - started + TICK_MS > RUN_FOR_MS && !chatEvents.size && !voteEvents.length && !supportEvents.size) break
  await new Promise(res => setTimeout(res, TICK_MS))
}
listeners.forEach(stop => stop())
await adminApp.delete?.().catch?.(() => {})
notice(`Worker: ${rounds} rounds with activity, ${boardWrites} board updates, ${sent} notifications sent, ${dropped} stale devices removed, ${resets} password resets applied, ${seasonsEnded} seasons ended.`)
process.exit(0)
