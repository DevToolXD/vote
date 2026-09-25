// Push notification sender. Runs from .github/workflows/notify.yml every few
// minutes and, for a few minutes each run, polls Firestore for:
//   - new chat messages  → each other member (unless they muted that chat, already
//     read it, or turned 새 메시지 off)
//   - new 추천 / 비추천   → the person who received it (never says who voted)
// and sends them through Firebase Cloud Messaging (HTTP v1) to every device in
// pushTokens. Progress is kept in meta/notifyCursor so nothing is sent twice.
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
const POLL_MS = Number(process.env.POLL_MS ?? 20_000)
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 2000)

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
      ? { token: t.token, notification: { title, body }, data: { url, tag }, android: { priority: 'HIGH', notification: { tag, sound: 'default' } } }
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
    const kind = v.lastUpAt && v.lastUpAt === v.updatedAt ? 'up' : v.down ? 'down' : null
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

// ---- main loop ----
const cursorPath = 'meta/notifyCursor'
const started = Date.now()
let cursor = (await getDoc(cursorPath))?.at ?? Date.now() - 5 * 60_000
let polls = 0
while (true) {
  // A little behind "now" so writes still being committed are picked up next time.
  const to = Date.now() - SETTLE_MS
  if (to > cursor) {
    cache = {}
    await messages(cursor, to)
    await votes(cursor, to)
    const r = await call(`${api}/${cursorPath}?updateMask.fieldPaths=at`, { method: 'PATCH', headers: await headers(), body: JSON.stringify({ fields: { at: ts(to) } }) })
    if (!r.ok) throw new Error(`Saving the cursor failed (${r.status})`)
    cursor = to
  }
  polls++
  if (Date.now() - started + POLL_MS > RUN_FOR_MS) break
  await new Promise(res => setTimeout(res, POLL_MS))
}
notice(`Notifications: ${polls} polls, ${sent} sent, ${dropped} stale devices removed.`)
