// Background worker. Runs from .github/workflows/notify.yml (which re-starts
// itself when a run ends) and polls Firestore for:
//   - new chat messages  → each other member (unless they muted that chat, already
//     read it, or turned 새 메시지 off)
//   - new 추천 / 비추천   → the person who received it (never says who voted)
//   - new 상담 (support) messages from users → the admin
// and sends them through Firebase Cloud Messaging (HTTP v1) to every device in
// pushTokens. Progress is kept in meta/notifyCursor so nothing is sent twice.
// It also applies admin password resets (pwResets/{uid}, status 'pending'):
// sets the account's password to the one-time code the admin gave the user.
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
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 2000)
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
const ts = ms => ({ timestampValue: new Date(ms).toISOString() })
const between = (field, from, to) => ({
  compositeFilter: { op: 'AND', filters: [
    { fieldFilter: { field: { fieldPath: field }, op: 'GREATER_THAN', value: ts(from) } },
    { fieldFilter: { field: { fieldPath: field }, op: 'LESS_THAN_OR_EQUAL', value: ts(to) } },
  ] },
})
async function getDoc(path) {
  const r = await call(`${api}/${path}`, { headers: await headers() })
  return r.ok ? docData(r.json) : null
}

// ---- lookups (cached per poll) ----
let cache = {}
async function cached(kind, id, load) {
  const k = kind + '/' + id
  if (!(k in cache)) cache[k] = await load()
  return cache[k]
}
const nameOf = uid => cached('name', uid, async () => (await getDoc(`candidates/${uid}`))?.name ?? '알 수 없음')
const settingsOf = uid => cached('settings', uid, async () => ({ notify: true, notifyMsg: true, notifyVote: true, ...(await getDoc(`settings/${uid}`)) }))
const tokensOf = uid => cached('tokens', uid, () => runQuery(docsRoot, {
  from: [{ collectionId: 'pushTokens' }],
  where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } },
}))

// ---- sending ----
let sent = 0, dropped = 0
async function push(uid, { title, body, url, tag }) {
  for (const t of await tokensOf(uid)) {
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
      await call(`${FS}/${t.path}`, { method: 'DELETE', headers: await headers() })
      dropped++
    } else {
      warn(`FCM send failed (${r.status} ${code ?? ''})`)
    }
  }
}

async function messages(from, to) {
  const chats = await runQuery(docsRoot, { from: [{ collectionId: 'chats' }], where: between('updatedAt', from, to) })
  for (const chat of chats) {
    const msgs = await runQuery(chat.path, {
      from: [{ collectionId: 'messages' }],
      where: between('at', from, to),
      orderBy: [{ field: { fieldPath: 'at' }, direction: 'ASCENDING' }],
    })
    if (!msgs.length) continue
    for (const member of chat.members ?? []) {
      const incoming = msgs.filter(m => m.uid !== member)
      if (!incoming.length) continue
      if (chat.mutes?.[member]) continue
      const last = incoming[incoming.length - 1]
      if ((chat.reads?.[member] ?? 0) >= last.at) continue // already read it in the open chat
      const s = await settingsOf(member)
      if (s.notify === false || s.notifyMsg === false) continue
      const sender = await nameOf(last.uid)
      if (last.kind === 'image') last.text = '사진을 보냈어요'
      const more = incoming.length > 1 ? ` (+${incoming.length - 1})` : ''
      await push(member, chat.type === 'group'
        ? { title: chat.name || '단톡방', body: `${sender}: ${last.text}${more}`, url: `${SITE}?tab=msg&chat=${chat.id}`, tag: `chat-${chat.id}` }
        : { title: sender, body: last.text + more, url: `${SITE}?tab=msg&chat=${chat.id}`, tag: `chat-${chat.id}` })
    }
  }
}

async function votes(from, to) {
  const changed = await runQuery(docsRoot, { from: [{ collectionId: 'votes' }], where: between('updatedAt', from, to) })
  const per = {}
  for (const v of changed) {
    if (!v.candidateId) continue
    // This week's vote as it is now (a new vote or a switch); a cancel isn't announced.
    const kind = v.weekKind === 'up' || v.weekKind === 'down' ? v.weekKind : null
    if (!kind) continue
    per[v.candidateId] ??= { up: 0, down: 0 }
    per[v.candidateId][kind]++
  }
  for (const [uid, n] of Object.entries(per)) {
    const s = await settingsOf(uid)
    if (s.notify === false || s.notifyVote === false) continue
    const body = n.up && n.down ? `추천 ${n.up}개, 비추천 ${n.down}개를 받았어요`
      : n.up ? (n.up > 1 ? `추천 ${n.up}개를 받았어요` : '누군가 회원님을 추천했어요')
        : (n.down > 1 ? `비추천 ${n.down}개를 받았어요` : '누군가 회원님을 비추천했어요')
    await push(uid, { title: '인기투표', body, url: SITE, tag: 'votes' })
  }
}

async function support(from, to) {
  const tickets = await runQuery(docsRoot, { from: [{ collectionId: 'support' }], where: between('updatedAt', from, to) })
  // 상담원's replies reach the person once the 상담 is linked to their account (after a password reset).
  for (const t of tickets.filter(t => t.last?.from === 'admin' && t.accountUid)) {
    await push(t.accountUid, { title: '상담원', body: t.last.text, url: `${SITE}?tab=acct`, tag: `support-${t.id}` })
  }
  const fromUsers = tickets.filter(t => t.last?.from === 'user')
  if (!fromUsers.length) return
  const admin = await adminUid()
  if (!admin) return
  for (const t of fromUsers) {
    await push(admin, { title: `상담 · ${t.name || t.loginId || '이름 없음'}`, body: t.last.text, url: `${SITE}?tab=admin&support=${t.id}`, tag: `support-${t.id}` })
  }
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
// Firestore reads are the scarce resource (the free plan allows 50,000 a day), so
// nothing is polled: real-time listeners (firebase-admin) tell us when chats,
// votes, 상담, password resets or the season change, and only then do we run
// the queries above. With nothing happening, a whole run costs a handful of reads.
import { cert, initializeApp } from 'firebase-admin/app'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'

if (LOCAL) process.env.FIRESTORE_EMULATOR_HOST = new URL(FS).host
const adminApp = initializeApp(LOCAL ? { projectId: project } : { credential: cert(key), projectId: project })
const fdb = getFirestore(adminApp)

const cursorPath = 'meta/notifyCursor'
const started = Date.now()
let cursor = (await getDoc(cursorPath))?.at ?? Date.now() - 5 * 60_000
const since = Timestamp.fromMillis(cursor)
const dirty = { chats: false, votes: false, support: false, resets: false }
let seasonEndsAt = null
let firstSnapshots = 0
const listeners = []
const firstDone = new Promise(resolve => {
  const seen = new Set()
  const listen = (name, ref, onSnap) => ref.onSnapshot(snap => {
    onSnap(snap)
    if (!seen.has(name)) { seen.add(name); firstSnapshots++; if (seen.size === 5) resolve() }
  }, err => { warn(`Listener ${name} failed: ${err.message}`); if (!seen.has(name)) { seen.add(name); if (seen.size === 5) resolve() } })
  listeners.push(
    listen('chats', fdb.collection('chats').where('updatedAt', '>', since), snap => { if (snap.docChanges().length) dirty.chats = true }),
    listen('votes', fdb.collection('votes').where('updatedAt', '>', since), snap => { if (snap.docChanges().length) dirty.votes = true }),
    listen('support', fdb.collection('support').where('updatedAt', '>', since), snap => { if (snap.docChanges().length) dirty.support = true }),
    listen('resets', fdb.collection('pwResets').where('status', '==', 'pending'), snap => { if (!snap.empty) dirty.resets = true }),
    listen('season', fdb.doc('meta/season'), snap => { const e = snap.get('endsAt'); seasonEndsAt = e ? e.toMillis() : null }),
  )
})
await firstDone

let rounds = 0
const TICK_MS = Number(process.env.TICK_MS ?? 3000)
while (true) {
  const to = Date.now() - SETTLE_MS
  if ((dirty.chats || dirty.votes || dirty.support) && to > cursor) {
    const work = { ...dirty }
    dirty.chats = dirty.votes = dirty.support = false
    cache = {}
    if (work.chats) await messages(cursor, to)
    if (work.votes) await votes(cursor, to)
    if (work.support) await support(cursor, to)
    const r = await call(`${api}/${cursorPath}?updateMask.fieldPaths=at`, { method: 'PATCH', headers: await headers(), body: JSON.stringify({ fields: { at: ts(to) } }) })
    if (!r.ok) throw new Error(`Saving the cursor failed (${r.status})`)
    cursor = to
    rounds++
  }
  if (dirty.resets) { dirty.resets = false; await passwordResets() }
  if (seasonEndsAt && Date.now() >= seasonEndsAt) { seasonEndsAt = null; await endSeasonIfDue().catch(e => warn('Season end check failed: ' + e)) }
  if (Date.now() - started + TICK_MS > RUN_FOR_MS) break
  await new Promise(res => setTimeout(res, TICK_MS))
}
listeners.forEach(stop => stop())
await adminApp.delete?.().catch?.(() => {})
notice(`Worker: ${rounds} rounds with activity, ${sent} notifications sent, ${dropped} stale devices removed, ${resets} password resets applied, ${seasonsEnded} seasons ended.`)
process.exit(0)
