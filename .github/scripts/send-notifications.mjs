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
let here = {}                // chatId → { uid: until } (Realtime Database here/)
let reads = {}               // uid → { chatId: when they last read it } (reads/)
const settingsOf = uid => ({ notify: true, notifyMsg: true, notifyVote: true, notifySound: true, ...settings.get(uid) })
const coinOrders = new Map() // 코인 orders still open: id → order
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
const BOARD_SKIP = new Set(['photoURL', 'createdAt', 'lastGift', 'lastBet', 'payBet', 'lastMarket', 'lastSale', 'lastCancel', 'ownerUid'])
function boardRows() {
  return [...candidates.entries()].map(([id, c]) => {
    const row = { id, pv: photoVersion(c.photoURL ?? ''), sa: c.scoreAt?.toMillis?.() ?? 0 }
    for (const [k, v] of Object.entries(c)) if (!BOARD_SKIP.has(k) && !(v instanceof Timestamp)) row[k] = v
    return row
  }).sort((a, b) => byRank({ ...a, scoreAt: a.sa }, { ...b, scoreAt: b.sa }))
}
// The board also carries the season and the notice list, so opening the app is one read
// instead of three. Rewrites are spaced BOARD_MIN_MS apart: each one costs a read in every
// open app, and a burst of votes then goes out as one update (my own row is live anyway).
let boardDirty = true, boardWrittenAt = 0, boardLast = ''
let seasonDoc = null, noticeIds = []
const BOARD_HEARTBEAT_MS = 30 * 60_000
const BOARD_MIN_MS = Number(process.env.BOARD_MIN_MS ?? 15_000)
async function writeBoard() {
  const rows = boardRows()
  const extra = { ...(seasonDoc ? { season: seasonDoc } : {}), notices: noticeIds }
  const json = JSON.stringify([rows, extra])
  const heartbeat = Date.now() - boardWrittenAt > BOARD_HEARTBEAT_MS
  boardDirty = false
  if (json === boardLast && !heartbeat) return
  if (json.length > 900_000) { warn(`Board too big (${json.length} bytes); apps fall back to reading every candidate.`); return }
  await fdb.doc('meta/board').set({ at: FieldValue.serverTimestamp(), rows, ...extra })
  boardLast = json; boardWrittenAt = Date.now(); boardWrites++
}

// The same board in the Realtime Database, which apps read first: it has no per-read
// charge (only data sent, and a change sends just the rows that changed), so it's written
// on every change instead of every BOARD_MIN_MS. Each row is one JSON string, so arrays,
// empty lists and timestamps come back exactly as in Firestore (timestamps as {__ms}).
const plain = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && typeof x.toMillis === 'function' ? { __ms: x.toMillis() } : x))
let rtRows = new Map(), rtExtra = '', rtAt = 0, rtDirty = true
const RT_HEARTBEAT_MS = 10 * 60_000
async function writeRtBoard() {
  rtDirty = false
  const next = new Map(boardRows().map(r => [r.id, plain(r)]))
  const up = {}
  for (const [id, j] of next) if (rtRows.get(id) !== j) up[`rows/${id}`] = j
  for (const id of rtRows.keys()) if (!next.has(id)) up[`rows/${id}`] = null
  const extra = plain({ season: seasonDoc, notices: noticeIds })
  if (extra !== rtExtra) up.extra = extra
  if (!Object.keys(up).length && Date.now() - rtAt < RT_HEARTBEAT_MS) return
  up.at = ServerValue.TIMESTAMP
  await rdb.ref('board').update(up)
  rtRows = next; rtExtra = extra; rtAt = Date.now()
}
let boardWrites = 0

// 페이크 선물 패스 lives on candidates/{uid}.passFake (bought in Firestore); the chat is in
// the Realtime Database, whose rules can't see Firestore, so it's mirrored to perks/{uid}.
const perksDone = new Set()
async function mirrorPerks() {
  for (const [id, c] of candidates) {
    if (!!c.passFake === perksDone.has(id)) continue
    await rdb.ref(`perks/${id}/fake`).set(c.passFake ? true : null) // taken back by the admin → gone
    c.passFake ? perksDone.add(id) : perksDone.delete(id)
  }
}

// ---- 거래 내역 (ledger) and 수상한 포인트 증가 (alerts), all in the Realtime Database ----
// Every change to someone's points (up + bonus − spent) is written to ledger/{uid} (they
// and the admin can read it) and ledgerFeed (admin), worked out from which fields of their
// candidate doc changed. Points gained quickly (outside admin grants / season rewards) are
// flagged in alerts/{uid} for the admin. ledgerState/{uid} remembers the last state seen,
// so changes made while no worker was running are still recorded when the next one starts.
const ledgerQueue = []
const LEDGER_KEEP = 100, FEED_KEEP = 300
const ALERT_WINDOW_MS = Number(process.env.ALERT_WINDOW_MS ?? 60 * 60_000)
const ALERT_POINTS = Number(process.env.ALERT_POINTS ?? 1000), ALERT_VOTES = Number(process.env.ALERT_VOTES ?? 20)
const pts = c => (c?.earned ?? c?.up ?? 0) + (c?.bonus ?? 0) - (c?.spent ?? 0)
const stateOf = c => ({ earned: c.earned ?? c.up ?? 0, up: c.up ?? 0, down: c.down ?? 0, bonus: c.bonus ?? 0, spent: c.spent ?? 0, lastGift: c.lastGift ?? '', lastBet: c.lastBet ?? '', payBet: c.payBet ?? '', lastMarket: c.lastMarket ?? '', lastSale: c.lastSale ?? '', lastCancel: c.lastCancel ?? '', lastCoin: c.lastCoin ?? '', payCoin: c.payCoin ?? '', appBonus: !!c.appBonus, pass2x: !!c.pass2x, passFake: !!c.passFake, owned: JSON.stringify(c.owned ?? {}) })
const lastVote = new Map() // uid → { key, at, d, n }: 추천 within 30 minutes go into one line
const gains = new Map()    // uid → [{ at, d, k }] within ALERT_WINDOW_MS
const ledgerWrites = new Map()
let feedWrites = 0

async function marketOf(id) {
  try { return (await fdb.doc(`market/${id}`).get()).data() ?? null } catch { return null }
}
async function giftOf(id) {
  try { return (await fdb.doc(`gifts/${id}`).get()).data() ?? null } catch { return null }
}
function newItems(o, d) {
  const a = JSON.parse(o.owned || '{}'), b = JSON.parse(d.owned || '{}'), out = []
  for (const k of Object.keys(b)) for (const key of b[k] ?? []) if (!(a[k] ?? []).includes(key)) out.push(`${k}:${key}`)
  return out
}
/** What happened between two states, as ledger lines { d: point change, k: kind, x?: detail }. */
async function classify(o, d) {
  const out = []
  let dEarned = (d.earned ?? d.up) - (o.earned ?? o.up), dBonus = d.bonus - o.bonus, dSpent = d.spent - o.spent
  if (d.up === 0 && d.down === 0 && (o.up !== 0 || o.down !== 0) && dEarned === 0 && dBonus >= 0) { if (dBonus) out.push({ d: dBonus, k: 'season' }); dBonus = 0 }
  if (d.appBonus && !o.appBonus) { out.push({ d: 300, k: 'app' }); dBonus -= 300 }
  // 몰래 도박장: a bet (points out) and a win (twice the bet back)
  if (d.lastBet && d.lastBet !== o.lastBet && dSpent > 0) { out.push({ d: -dSpent, k: 'bet' }); dSpent = 0 }
  if (d.payBet && d.payBet !== o.payBet && dBonus > 0) { out.push({ d: dBonus, k: 'betWin' }); dBonus = 0 }
  // 코인: buying (points out with the order) and selling (points back from the worker)
  if (d.lastCoin && d.lastCoin !== o.lastCoin && dSpent > 0) { out.push({ d: -dSpent, k: 'coinBuy' }); dSpent = 0 }
  if (d.payCoin && d.payCoin !== o.payCoin && dBonus > 0) { out.push({ d: dBonus, k: 'coinSell' }); dBonus = 0 }
  // 당근마켓: a sale (paid by the buyer), a purchase, a listing (item into escrow), a take-down
  const marketMoved = (d.lastMarket && d.lastMarket !== o.lastMarket) || (d.lastCancel && d.lastCancel !== o.lastCancel)
  if (d.lastSale && d.lastSale !== o.lastSale && dBonus > 0) {
    const m = await marketOf(d.lastSale)
    out.push({ d: dBonus, k: 'marketSell', x: m ? `${m.kind}:${m.key}|${m.buyer ?? ''}` : '' }); dBonus = 0
  }
  if (d.lastMarket && d.lastMarket !== o.lastMarket) {
    const m = await marketOf(d.lastMarket)
    if (dSpent > 0) { out.push({ d: -dSpent, k: 'marketBuy', x: m ? `${m.kind}:${m.key}|${m.seller}` : '' }); dSpent = 0 }
    else out.push({ d: 0, k: 'marketList', x: m ? `${m.kind}:${m.key}|${m.price}` : '' })
  }
  if (d.lastCancel && d.lastCancel !== o.lastCancel) {
    const m = await marketOf(d.lastCancel)
    out.push({ d: 0, k: 'marketCancel', x: m ? `${m.kind}:${m.key}` : '' })
  }
  if (d.lastGift && d.lastGift !== o.lastGift) {
    const g = await giftOf(d.lastGift)
    if (dSpent > 0) { out.push(g?.itemKind ? { d: -dSpent, k: 'giftItemSent', x: `${g.itemKind}:${g.itemKey}|${g.to ?? ''}` } : { d: -dSpent, k: 'giftSent', x: g?.to ?? g?.chatId ?? '' }); dSpent = 0 }
    else if (g?.itemKind && dSpent === 0 && dBonus === 0 && (newItems(o, d).length || (g.itemKind === 'pass' && d[g.itemKey] && !o[g.itemKey]))) out.push({ d: 0, k: 'giftItemClaim', x: `${g.itemKind}:${g.itemKey}|${g.from ?? ''}` })
    else if (dSpent < 0) { out.push({ d: -dSpent, k: 'giftCancel' }); dSpent = 0 }
    if (dBonus > 0) { out.push({ d: dBonus, k: 'giftClaim', x: g?.from ?? '' }); dBonus = 0 }
  }
  for (const pass of ['pass2x', 'passFake']) if (d[pass] && !o[pass] && dSpent > 0) { const cost = pass === 'passFake' ? Math.min(dSpent, 299) : Math.min(dSpent, 5000); out.push({ d: -cost, k: 'pass', x: pass }); dSpent -= cost }
  const items = marketMoved ? [] : newItems(o, d)
  if (items.length && dSpent > 0) { out.push({ d: -dSpent, k: 'buy', x: items.join(',') }); dSpent = 0 }
  const gone = (d.lastGift !== o.lastGift || marketMoved ? [] : newItems(d, o)).concat(marketMoved ? [] : ['pass2x', 'passFake'].filter(k => o[k] && !d[k]))
  if (gone.length && dSpent === 0) out.push({ d: 0, k: 'revoke', x: gone.join(',') })
  if (dEarned) out.push({ d: dEarned, k: 'vote' })
  if (dBonus) out.push({ d: dBonus, k: 'grant' })
  if (dSpent) out.push({ d: -dSpent, k: 'other' })
  return out.filter(e => e.d !== 0 || ['revoke', 'giftItemClaim', 'marketList', 'marketCancel'].includes(e.k))
}
async function record(uid, lines, at = Date.now()) {
  const up = {}
  for (const e of lines) {
    const lv = lastVote.get(uid)
    if (e.k === 'vote' && lv && at - lv.at < 30 * 60_000) {
      lv.d += e.d; lv.n += Math.max(1, Math.round(e.d / 10)); lv.at = at
      up[`ledger/${uid}/${lv.key}/d`] = lv.d; up[`ledger/${uid}/${lv.key}/n`] = lv.n; up[`ledger/${uid}/${lv.key}/at`] = at
      if (lv.feed) { up[`ledgerFeed/${lv.feed}/d`] = lv.d; up[`ledgerFeed/${lv.feed}/n`] = lv.n; up[`ledgerFeed/${lv.feed}/at`] = at }
    } else {
      const key = rdb.ref(`ledger/${uid}`).push().key, feed = rdb.ref('ledgerFeed').push().key
      const row = { at, d: e.d, k: e.k, ...(e.x ? { x: e.x } : {}), ...(e.k === 'vote' ? { n: Math.max(1, Math.round(e.d / 10)) } : {}) }
      up[`ledger/${uid}/${key}`] = row
      up[`ledgerFeed/${feed}`] = { ...row, u: uid }
      if (e.k === 'vote') lastVote.set(uid, { key, feed, at, d: e.d, n: Math.max(1, Math.round(e.d / 10)) })
      ledgerWrites.set(uid, (ledgerWrites.get(uid) ?? 0) + 1); feedWrites++
    }
    // 수상한 포인트 증가: gains that aren't the admin's or the season's, within the window.
    if (e.d > 0 && !['grant', 'season', 'app', 'giftCancel', 'betWin', 'coinSell'].includes(e.k)) {
      const list = (gains.get(uid) ?? []).filter(g => at - g.at < ALERT_WINDOW_MS)
      list.push({ at, d: e.d, k: e.k }); gains.set(uid, list)
      const total = list.reduce((n, g) => n + g.d, 0), votes = list.filter(g => g.k === 'vote').reduce((n, g) => n + Math.round(g.d / 10), 0)
      if (total >= ALERT_POINTS || votes >= ALERT_VOTES) {
        up[`alerts/${uid}`] = { at, since: list[0].at, gain: total, votes, gifts: list.filter(g => g.k === 'giftClaim').reduce((n, g) => n + g.d, 0), other: list.filter(g => g.k === 'other').reduce((n, g) => n + g.d, 0), points: pts(candidates.get(uid)) }
      }
    }
  }
  if (Object.keys(up).length) await rdb.ref().update(up)
}
async function saveState(uid, c) { await rdb.ref(`ledgerState/${uid}`).set(stateOf(c)) }
async function ledgerInit() {
  const saved = (await rdb.ref('ledgerState').once('value')).val() ?? {}
  const snap = new Map(candidates)
  ledgerQueue.length = 0 // already part of `snap`; later changes queue up as usual
  for (const [uid, c] of snap) {
    const now = stateOf(c), before = saved[uid]
    if (before && JSON.stringify(before) === JSON.stringify(now)) continue
    if (before) await record(uid, await classify({ ...stateOf({}), ...before }, now))
    await saveState(uid, c)
  }
}
async function processLedger() {
  while (ledgerQueue.length) {
    const { id, o, d } = ledgerQueue.shift()
    if (!o) continue
    const a = stateOf(o), b = stateOf(d)
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    await record(id, await classify(a, b))
    await saveState(id, d)
  }
}
async function pruneLedger() {
  for (const [uid, n] of ledgerWrites) {
    if (n < 20) continue
    ledgerWrites.set(uid, 0)
    const all = (await rdb.ref(`ledger/${uid}`).orderByKey().once('value')).val() ?? {}
    const drop = Object.keys(all).sort().slice(0, Math.max(0, Object.keys(all).length - LEDGER_KEEP))
    if (drop.length) await rdb.ref(`ledger/${uid}`).update(Object.fromEntries(drop.map(k => [k, null])))
  }
  if (feedWrites >= 50) {
    feedWrites = 0
    const keys = Object.keys((await rdb.ref('ledgerFeed').orderByKey().once('value')).val() ?? {}).sort()
    const drop = keys.slice(0, Math.max(0, keys.length - FEED_KEEP))
    if (drop.length) await rdb.ref('ledgerFeed').update(Object.fromEntries(drop.map(k => [k, null])))
  }
}

// ---- sending ----
let sent = 0, dropped = 0
// Sound is on unless they turned 알림 소리 off (then the app's quiet channel / a silent web notification).
// Every device of the person is sent to at once.
async function push(uid, { title, body, url, tag }) {
  const loud = settingsOf(uid).notifySound !== false
  await Promise.all(tokensOf(uid).map(t => pushTo(t, { title, body, url, tag }, loud)))
}
async function pushTo(t, { title, body, url, tag }, loud) {
  const message = t.platform === 'android'
    ? { token: t.token, notification: { title, body }, data: { url, tag }, android: { priority: 'HIGH', ttl: '86400s', notification: {
        tag, channel_id: !loud ? 'quiet' : tag.startsWith('chat-') || tag.startsWith('support-') || tag.startsWith('call-') ? 'messages' : 'votes',
        ...(loud ? { sound: 'default', default_vibrate_timings: true, notification_priority: 'PRIORITY_MAX' } : { notification_priority: 'PRIORITY_LOW' }),
        visibility: 'PUBLIC',
      } } }
    : { token: t.token, data: { title, body, url, tag, ...(loud ? {} : { silent: '1' }) }, webpush: { headers: { Urgency: 'high', TTL: '86400' } } }
  const r = await call(`${FCM}/v1/projects/${project}/messages:send`, { method: 'POST', headers: await headers(), body: JSON.stringify({ message }) })
  if (r.ok) { sent++; return }
  const code = r.json?.error?.details?.find?.(d => d.errorCode)?.errorCode ?? r.json?.error?.status
  if (r.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
    // The app was uninstalled / permission revoked / token rotated: forget this device.
    await t.ref.delete().catch(() => {})
    dropped++
  } else {
    warn(`FCM send failed (${r.status} ${code ?? ''})`)
  }
}

// A chat whose latest message (chat.last) is new → each other member, once per burst.
// `chat` is a Realtime Database chats/{id} node: { info, members, last, mutes }.
const roomOpen = chat => Object.entries(here[chat.id] ?? {}).some(([m, until]) => m !== chat.last?.uid && until > Date.now())
async function notifyChat(chat, count) {
  const last = chat.last
  const type = chat.info?.type, name = chat.info?.name
  for (const member of Object.keys(chat.members ?? {})) {
    if (member === last.uid || chat.mutes?.[member]) continue
    if (Math.max(here[chat.id]?.[member] ?? 0, reads[member]?.[chat.id] ?? 0) >= last.at) continue // has the room open, or read it already
    const s = settingsOf(member)
    if (s.notify === false || s.notifyMsg === false) continue
    const sender = await nameOf(last.uid)
    const more = count > 1 ? ` (+${count - 1})` : ''
    await push(member, type === 'group'
      ? { title: name || '단톡방', body: `${sender}: ${last.text}${more}`, url: `${SITE}?tab=msg&chat=${chat.id}`, tag: `chat-${chat.id}` }
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
// Same order as app/src/backend/rank.ts: higher score, then who reached it first (scoreAt).
const scoreAtMs = c => (typeof c.scoreAt === 'number' ? c.scoreAt : c.scoreAt?.toMillis?.() ?? 0)
const byRank = (a, b) => (b.score ?? 0) - (a.score ?? 0) || scoreAtMs(a) - scoreAtMs(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
function computeRewards(cands, voters, r) {
  const sorted = [...cands].sort(byRank)
  return sorted.map((c, i) => {
    const rank = i + 1
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
  const top = [...cands].sort(byRank).slice(0, 3)
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
      update: { name: c.path, fields: fsValue({ up: 0, down: 0, score: 0, bonus: (c.bonus ?? 0) + reward, earned: c.earned ?? c.up ?? 0 }).mapValue.fields },
      updateMask: { fieldPaths: ['up', 'down', 'score', 'bonus', 'earned'] },
    })
  }
  if (writes.length > 500) { warn(`Season end needs ${writes.length} writes (> 500); end it from the 관리 tab instead.`); return }
  const c = await call(`${FS}/${docsRoot}:commit`, { method: 'POST', headers: await headers(), body: JSON.stringify({ writes }) })
  if (!c.ok) { warn(`Ending season ${number} failed (${c.status}) ${JSON.stringify(c.json).slice(0, 200)}`); return }
  seasonsEnded++
  notice(`Season ${number} (${season.name}) ended automatically: rewards paid to ${paid.filter(p => p.points > 0).length} people.`)
}

// ---- one-time move of the chats from Firestore to the Realtime Database ----
// Copies every chat (info, members, last message, mutes, timeouts, group photo), each
// member's chat list, every message (keys built from the send time, so they stay in order
// and a re-run writes the same keys) and 메시지 끄기. Photos stay in Firestore (mediaId).
// Runs until meta/chatMigration says done; if Firestore's quota is used up it tries again later.
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
function keyFor(ms, fsId) {
  let t = '', n = ms
  for (let i = 0; i < 8; i++) { t = PUSH_CHARS[n % 64] + t; n = Math.floor(n / 64) }
  return t + fsId.replace(/[^0-9A-Za-z]/g, '').padEnd(12, '0').slice(0, 12)
}
const tms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0)
async function migrateChats() {
  if ((await rdb.ref('meta/chatMigration/done').get()).val()) return true
  const chats = await fdb.collection('chats').get()
  let paths = {}, n = 0, msgCount = 0
  const flush = async () => { if (n) await rdb.ref().update(paths); paths = {}; n = 0 }
  const put = async (k, v) => { paths[k] = v; if (++n >= 400) await flush() }
  for (const d of chats.docs) {
    const c = d.data(), id = d.id
    const members = c.members ?? []
    if (!(await rdb.ref(`chats/${id}/info`).get()).exists()) {
      await put(`chats/${id}/info`, { type: c.type === 'group' ? 'group' : 'dm', createdBy: c.createdBy ?? members[0] ?? '', createdAt: tms(c.createdAt) || Date.now(), ...(c.name ? { name: c.name.slice(0, 30) } : {}), ...(c.photo ? { photoAt: Date.now() } : {}) })
      if (c.photo) await put(`chatPhotos/${id}`, c.photo)
    }
    for (const m of members) { await put(`chats/${id}/members/${m}`, true); await put(`userChats/${m}/${id}`, true) }
    for (const [m, on] of Object.entries(c.mutes ?? {})) if (on) await put(`chats/${id}/mutes/${m}`, true)
    for (const [m, t] of Object.entries(c.timeouts ?? {})) if (tms(t) > Date.now()) await put(`chats/${id}/timeouts/${m}`, tms(t))
    const msgs = (await d.ref.collection('messages').get()).docs.map(m => ({ id: m.id, ...m.data() })).sort((a, b) => tms(a.at) - tms(b.at))
    const keyOf = new Map(msgs.map(m => [m.id, keyFor(tms(m.at) || 0, m.id)]))
    for (const m of msgs) {
      const node = { uid: m.uid, text: m.text ?? '', at: tms(m.at) || 0 }
      if (m.kind && m.kind !== 'text') node.kind = m.kind
      if (m.giftId) node.giftId = m.giftId
      if (m.kind === 'image') node.mediaId = m.id
      if (m.replyTo?.id && keyOf.has(m.replyTo.id)) node.replyTo = { id: keyOf.get(m.replyTo.id), uid: m.replyTo.uid, text: (m.replyTo.text ?? '').slice(0, 100) }
      await put(`msgs/${id}/${keyOf.get(m.id)}`, node)
      msgCount++
    }
    const last = msgs[msgs.length - 1]
    const cur = (await rdb.ref(`chats/${id}/last/at`).get()).val() ?? 0
    if (last && tms(last.at) > cur) await put(`chats/${id}/last`, { text: (last.kind === 'image' ? '사진' : last.text || '').slice(0, 100) || '메시지', uid: last.uid, at: tms(last.at) })
  }
  for (const d of (await fdb.collection('candidates').where('msgOff', '==', true).get()).docs) await put(`msgOff/${d.id}`, true)
  await flush()
  await rdb.ref('meta/chatMigration').set({ done: true, at: Date.now(), chats: chats.size, messages: msgCount })
  notice(`Chats moved to the Realtime Database: ${chats.size} chats, ${msgCount} messages.`)
  return true
}

// ---- main loop ----
import { execFile } from 'node:child_process'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { getDatabase, ServerValue } from 'firebase-admin/database'

if (LOCAL) process.env.FIRESTORE_EMULATOR_HOST = new URL(FS).host
if (LOCAL) process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000'
const databaseURL = process.env.DATABASE_URL || `https://${project}-default-rtdb.asia-southeast1.firebasedatabase.app`
const adminApp = initializeApp(LOCAL ? { projectId: project, databaseURL } : { credential: cert(key), projectId: project, databaseURL })
const fdb = getFirestore(adminApp)
const rdb = getDatabase(adminApp)

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
      for (const c of snap.docChanges()) {
        if (c.type === 'modified') ledgerQueue.push({ id: c.doc.id, o: candidates.get(c.doc.id), d: c.doc.data() })
        c.type === 'removed' ? candidates.delete(c.doc.id) : candidates.set(c.doc.id, c.doc.data())
      }
      if (snap.docChanges().length) boardDirty = rtDirty = true
    }),
    listen('settings', fdb.collection('settings'), snap => snap.docChanges().forEach(c => c.type === 'removed' ? settings.delete(c.doc.id) : settings.set(c.doc.id, c.doc.data()))),
    listen('tokens', fdb.collection('pushTokens'), snap => {
      tokens.clear()
      snap.forEach(d => { const t = d.data(); if (!t.uid) return; if (!tokens.has(t.uid)) tokens.set(t.uid, []); tokens.get(t.uid).push({ token: t.token ?? d.id, platform: t.platform, ref: d.ref }) })
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
    listen('season', fdb.doc('meta/season'), snap => { const e = snap.get('endsAt'); seasonEndsAt = e ? e.toMillis() : null; seasonDoc = snap.data() ?? null; boardDirty = rtDirty = true }),
    listen('notices', fdb.doc('meta/noticeIndex'), snap => { noticeIds = snap.get('ids') ?? []; boardDirty = rtDirty = true }),
    listen('coinOrders', fdb.collection('coinOrders').where('status', '==', 'open'), snap => {
      for (const c of snap.docChanges()) c.type === 'removed' ? coinOrders.delete(c.doc.id) : coinOrders.set(c.doc.id, c.doc.data())
    }),
  )
})
await firstDone
// Points moved from "this season's 추천" to earned (10 per vote received, never taken back):
// docs from before get earned = up once, so nobody's balance changes.
for (const [id, c] of candidates) {
  if (c.earned !== undefined) continue
  await fdb.runTransaction(async tx => {
    const s = await tx.get(fdb.doc(`candidates/${id}`))
    if (s.exists && s.get('earned') === undefined) tx.update(s.ref, { earned: s.get('up') ?? 0 })
  }).catch(e => warn(`Setting earned for ${id} failed: ${e.message}`))
}
await ledgerInit().catch(e => warn('Ledger start failed: ' + e.message))
try { for (const [id, v] of Object.entries((await rdb.ref('perks').once('value')).val() ?? {})) if (v?.fake) perksDone.add(id) } catch (e) { warn('Reading perks failed: ' + e.message) }

// Chat (Realtime Database): every chats/{id} change; a new last.at is a new message.
function onChatNode(snap) {
  const chat = { id: snap.key, ...snap.val() }
  const at = chat.last?.at ?? 0
  const queued = chatEvents.get(chat.id)
  if (queued) queued.chat = chat // keep mutes / members current
  if (!chat.last?.uid || at <= cursor || at <= (lastSeenAt.get(chat.id) ?? 0)) return
  lastSeenAt.set(chat.id, at)
  chatEvents.set(chat.id, { chat, count: (queued?.count ?? 0) + 1, at })
}
const chatsRef = rdb.ref('chats'), hereRef = rdb.ref('here'), readsRef = rdb.ref('reads')
chatsRef.on('child_added', onChatNode, e => warn('Chat listener failed: ' + e.message))
chatsRef.on('child_changed', onChatNode)
hereRef.on('value', s => { here = s.val() ?? {} }, e => warn('Presence listener failed: ' + e.message))
readsRef.on('value', s => { reads = s.val() ?? {} }, () => {})
await Promise.all([chatsRef.once('value'), hereRef.once('value'), readsRef.once('value')]).catch(e => warn('Realtime Database unavailable: ' + e.message))

// ---- 음성 통화: callIn/{uid} { chatId, from, at } → "📞 OOO님의 전화" right away ----
const callsPushed = new Map() // uid → at already pushed
function onCallIn(snap) {
  const uid = snap.key, c = snap.val()
  if (!c?.chatId || !c.from || !(c.at > Date.now() - 30_000) || callsPushed.get(uid) === c.at) return
  callsPushed.set(uid, c.at)
  if (settingsOf(uid).notify === false) return
  nameOf(c.from).then(name => push(uid, { title: `${c.video ? '📹' : '📞'} ${name}`, body: c.video ? '영상 통화가 왔어요' : '음성 통화가 왔어요', url: `${SITE}?tab=msg&chat=${c.chatId}`, tag: `call-${c.chatId}` }))
    .catch(e => warn('Call push failed: ' + e.message))
}
const callInRef = rdb.ref('callIn')
callInRef.on('child_added', onCallIn, e => warn('Call listener failed: ' + e.message))
callInRef.on('child_changed', onCallIn)

// ---- 예약 메시지: scheduled/{uid}/{key}, posted as that person when due ----
// Checked like a normal send: still in the chat, not in 타임아웃, messages not turned off (either
// side of a 1:1). If it can't go out, it's dropped — and a scheduled 선물 is cancelled, its points refunded.
let scheduled = {}
const scheduledRef = rdb.ref('scheduled')
scheduledRef.on('value', s => { scheduled = s.val() ?? {} }, e => warn('Scheduled listener failed: ' + e.message))
await scheduledRef.once('value').catch(() => {})
const rtVal = async path => (await rdb.ref(path).once('value')).val()
async function refundGift(uid, giftId) {
  await fdb.runTransaction(async tx => {
    const g = await tx.get(fdb.doc(`gifts/${giftId}`))
    if (!g.exists || g.get('status') !== 'open' || g.get('from') !== uid) return
    tx.update(g.ref, { status: 'cancelled', doneAt: FieldValue.serverTimestamp() })
    tx.update(fdb.doc(`candidates/${uid}`), { spent: FieldValue.increment(-g.get('amount')), lastGift: giftId })
  })
}
let scheduledSent = 0
async function deliverScheduled() {
  const now = Date.now()
  for (const [uid, items] of Object.entries(scheduled)) {
    for (const [key, it] of Object.entries(items ?? {})) {
      if (!it || !(it.at <= now)) continue
      delete items[key] // don't pick it up twice before the listener catches up
      const chatId = it.chatId
      const other = chatId.includes('_') ? chatId.split('_').find(x => x !== uid) : null
      const ok = (await rtVal(`chats/${chatId}/members/${uid}`)) === true
        && !((await rtVal(`chats/${chatId}/timeouts/${uid}`)) > now)
        && (await rtVal(`msgOff/${uid}`)) !== true
        && (!other || (await rtVal(`msgOff/${other}`)) !== true)
      if (ok) {
        const k = rdb.ref(`msgs/${chatId}`).push().key
        await rdb.ref().update({
          [`msgs/${chatId}/${k}`]: { text: it.text, uid, at: ServerValue.TIMESTAMP, ...(it.giftId ? { kind: 'gift', giftId: it.giftId } : {}) },
          [`chats/${chatId}/last`]: { text: String(it.text).slice(0, 100), uid, at: ServerValue.TIMESTAMP },
          [`scheduled/${uid}/${key}`]: null,
        })
        scheduledSent++
      } else {
        await rdb.ref(`scheduled/${uid}/${key}`).remove()
        if (it.giftId) await refundGift(uid, it.giftId).catch(e => warn('Refunding a scheduled gift failed: ' + e.message))
      }
    }
  }
}


// ---- 코인: made-up coins traded with points (nothing real behind them) ----
// Prices are a random walk run here: each tick moves every coin a little (log-normal steps,
// pulled slowly back toward its base price, with a rare sudden jump), published to the
// Realtime Database:  coins/live { at, p: { BTC: …, … } } every few seconds and
// coins/m1/{minute ms} { BTC: …, … } once a minute (the last 24 hours, for the charts).
// Orders (coinOrders/{id}, written by the app): a buy has already paid its points
// (firestore.rules: coinBuy) and gets coins at the current price; a sell gets points
// (bonus, payCoin = order id) for coins it holds. Holdings: wallets/{uid}/{sym} { q, c }
// (amount, points paid for it). coinFills/{order id} makes each fill happen exactly once.
const COINS = {
  JEONG: { base: 1000, vol: 0.0075 },
  BTC: { base: 60000, vol: 0.009 },
  ETH: { base: 3000, vol: 0.009 },
  XRP: { base: 80, vol: 0.009 },
  DOGE: { base: 15, vol: 0.0105 },
  SGP: { base: 300, vol: 0.009 },
  KIMCHI: { base: 500, vol: 0.009 },
  TTEOK: { base: 40, vol: 0.009 },
  CHICKEN: { base: 120, vol: 0.009 },
  RAMEN: { base: 8, vol: 0.0105 },
  MOON: { base: 0.5, vol: 0.012 },
}
const COIN_TICK_MS = Number(process.env.COIN_TICK_MS ?? 3000), COIN_PULL = 0.0015, COIN_KEEP_MIN = 24 * 60
const COIN_BOUND = 20 // a coin stays between base / 20 and base × 20
let coinPrices = null, coinAt = 0, coinMinute = 0
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
const roundPrice = p => (p >= 100 ? Math.round(p * 100) / 100 : Math.round(p * 10000) / 10000)
async function coinInit() {
  const live = (await rdb.ref('coins/live').once('value')).val()
  coinPrices = {}
  for (const [sym, c] of Object.entries(COINS)) coinPrices[sym] = live?.p?.[sym] > 0 ? live.p[sym] : c.base
}
// Each coin: a small random walk (about 3 % a minute) that drifts back toward its base price,
// now and then a sudden 3–8 % jump, and rarer short trends (a few minutes all one way).
const trend = {}
function coinStep() {
  for (const [sym, c] of Object.entries(COINS)) {
    const x = Math.log(coinPrices[sym] / c.base)
    // an admin boost (trend.free) moves the price without being pulled back toward the base
    let dx = (trend[sym]?.free ? 0 : -COIN_PULL * x) + c.vol * gauss()
    if (!trend[sym] && Math.random() < 1 / 2500) trend[sym] = { drift: (Math.random() < 0.5 ? -1 : 1) * (0.0005 + Math.random() * 0.0007), left: 60 + Math.floor(Math.random() * 60) }
    if (trend[sym]) { dx += trend[sym].drift; if (--trend[sym].left <= 0) delete trend[sym] }
    if (Math.random() < 1 / 3000) dx += (Math.random() < 0.5 ? -1 : 1) * (0.03 + Math.random() * 0.05) // 급등 / 급락
    coinPrices[sym] = roundPrice(Math.min(c.base * COIN_BOUND, Math.max(c.base / COIN_BOUND, coinPrices[sym] * Math.exp(dx))))
  }
}
// 관리자 코인 상승 (coinEvents/{id} { sym, pct, minutes }, written by the admin screen): the
// move is spread evenly over the minutes, then the request is removed. Applied once.
const coinEventsQueue = []
rdb.ref('coinEvents').on('child_added', s => { if (s.val()?.sym in COINS) coinEventsQueue.push({ id: s.key, ...s.val() }) }, e => warn('Coin events failed: ' + e.message))
function applyCoinEvents() {
  for (const ev of coinEventsQueue.splice(0)) {
    const pct = Math.max(-50, Math.min(50, Number(ev.pct) || 0)), minutes = Math.max(1, Math.min(30, Number(ev.minutes) || 1))
    const ticks = Math.max(1, Math.round((minutes * 60_000) / COIN_TICK_MS))
    trend[ev.sym] = { drift: Math.log(1 + pct / 100) / ticks, left: ticks, free: true }
    rdb.ref(`coinEvents/${ev.id}`).remove().catch(() => {})
  }
}
async function coinTick() {
  if (!coinPrices) return
  applyCoinEvents()
  const now = Date.now()
  if (now - coinAt < COIN_TICK_MS) return
  coinAt = now
  coinStep()
  const up = { 'coins/live': { at: now, p: { ...coinPrices } } }
  const minute = Math.floor(now / 60_000) * 60_000
  if (minute !== coinMinute) {
    up[`coins/m1/${minute}`] = { ...coinPrices }
    // the minute that just left the 24 hours (and, after a gap, a few before it)
    for (let k = 0; k < (coinMinute ? Math.min(30, (minute - coinMinute) / 60_000) : 1); k++) up[`coins/m1/${minute - (COIN_KEEP_MIN + k) * 60_000}`] = null
    coinMinute = minute
  }
  await rdb.ref().update(up)
}
async function fillCoinOrder(id, o) {
  const price = coinPrices?.[o.coin]
  const fail = reason => fdb.doc(`coinOrders/${id}`).update({ status: 'failed', reason, doneAt: FieldValue.serverTimestamp() })
  if (!price) return
  const filled = (await rdb.ref(`coinFills/${id}`).once('value')).val()
  if (o.side === 'buy') {
    if (filled == null) {
      const qty = Math.floor((o.points / price) * 1e8) / 1e8
      const w = (await rdb.ref(`wallets/${o.uid}/${o.coin}`).once('value')).val() ?? { q: 0, c: 0 }
      await rdb.ref().update({ [`wallets/${o.uid}/${o.coin}`]: { q: Math.round((w.q + qty) * 1e8) / 1e8, c: w.c + o.points }, [`coinFills/${id}`]: { price, qty } })
      await fdb.doc(`coinOrders/${id}`).update({ status: 'done', price, qty, doneAt: FieldValue.serverTimestamp() })
    } else await fdb.doc(`coinOrders/${id}`).update({ status: 'done', price: filled.price, qty: filled.qty, doneAt: FieldValue.serverTimestamp() })
    return
  }
  // sell
  let fill = filled
  if (fill == null) {
    const w = (await rdb.ref(`wallets/${o.uid}/${o.coin}`).once('value')).val() ?? { q: 0, c: 0 }
    // 8 decimals like the wallet; a sell of the whole holding can't fail on rounding
    if (o.qty > w.q + 1e-7) return fail('not-enough')
    const qty = Math.floor(Math.min(o.qty, w.q) * 1e8) / 1e8
    if (!(qty > 0)) return fail('not-enough')
    const points = Math.floor(qty * price)
    const left = Math.round((w.q - qty) * 1e8) / 1e8
    fill = { price, qty, points }
    await rdb.ref().update({ [`wallets/${o.uid}/${o.coin}`]: left > 0 ? { q: left, c: Math.round(w.c * (left / w.q)) } : null, [`coinFills/${id}`]: fill })
  }
  await fdb.runTransaction(async tx => {
    const ord = await tx.get(fdb.doc(`coinOrders/${id}`))
    if (ord.get('status') !== 'open') return
    tx.update(fdb.doc(`candidates/${o.uid}`), { bonus: FieldValue.increment(fill.points), payCoin: id })
    tx.update(ord.ref, { status: 'done', price: fill.price, qty: fill.qty, points: fill.points, doneAt: FieldValue.serverTimestamp() })
  })
}
async function fillCoinOrders() {
  for (const [id, o] of coinOrders) {
    coinOrders.delete(id)
    await fillCoinOrder(id, o).catch(e => warn(`Coin order ${id} failed: ${e.message}`))
  }
}

// A newer commit on main (new worker code or rules): stop, and the workflow starts a fresh run.
async function newerCodeOnMain() {
  if (LOCAL || !process.env.GITHUB_TOKEN || !process.env.GITHUB_SHA) return false
  try {
    // only when the worker itself changed: app deploys don't interrupt notifications
    const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/compare/${process.env.GITHUB_SHA}...main`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } })
    if (!r.ok) return false
    const files = (await r.json()).files ?? []
    return files.some(f => /^\.github\/(scripts\/(?!node_modules\/)|workflows\/notify\.yml$)/.test(f.filename))
  } catch { return false }
}
// Firestore rules: re-deployed hourly if they differ from this checkout (no Firestore reads).
const rulesCheck = () => new Promise(res => execFile('node', ['.github/scripts/deploy-firestore-rules.mjs'], { env: { ...process.env, SKIP_IF_SAME: '1' } }, err => { if (err) warn('Hourly rules check failed: ' + err.message); res() }))

await coinInit().catch(e => warn('Coin start failed: ' + e.message))
let migrated = await migrateChats().catch(e => { warn('Moving chats to the Realtime Database failed (will retry): ' + e.message); return false })
let nextMigration = Date.now() + 30 * 60_000
let rounds = 0
const TICK_MS = Number(process.env.TICK_MS ?? 1000)
let nextCodeCheck = Date.now() + 10 * 60_000, nextRules = Date.now() + 60 * 60_000
while (true) {
  const due = Date.now() - SETTLE_MS
  let sentUpTo = 0
  for (const [id, e] of chatEvents) {
    // waits SETTLE_MS only while someone has the room open (their read receipt may be on its way)
    if (e.at > due && roomOpen(e.chat)) continue
    chatEvents.delete(id)
    await notifyChat(e.chat, e.count)
    sentUpTo = Math.max(sentUpTo, e.at)
  }
  // votes and 상담 go out right away
  const readyVotes = voteEvents.splice(0)
  if (readyVotes.length) {
    const per = new Map()
    for (const v of readyVotes) { const n = per.get(v.candidateId) ?? { up: 0, down: 0 }; n[v.kind]++; per.set(v.candidateId, n); sentUpTo = Math.max(sentUpTo, v.at) }
    await notifyVotes(per)
  }
  for (const [id, e] of supportEvents) {
    supportEvents.delete(id)
    await notifySupport(e.ticket)
    sentUpTo = Math.max(sentUpTo, e.at)
  }
  // a chat still waiting keeps the cursor before it, so a restart can't skip it
  for (const e of chatEvents.values()) sentUpTo = Math.min(sentUpTo, e.at - 1)
  if (sentUpTo > cursor) {
    cursor = sentUpTo
    await cursorRef.set({ at: Timestamp.fromMillis(cursor) }, { merge: true })
    rounds++
  }
  await processLedger().catch(e => warn('Ledger failed: ' + e.message))
  await pruneLedger().catch(e => warn('Ledger prune failed: ' + e.message))
  await deliverScheduled().catch(e => warn('Scheduled messages failed: ' + e.message))
  await coinTick().catch(e => warn('Coin prices failed: ' + e.message))
  await fillCoinOrders()
  await mirrorPerks().catch(e => warn('Mirroring passes failed: ' + e.message))
  if (rtDirty || Date.now() - rtAt > RT_HEARTBEAT_MS) await writeRtBoard().catch(e => { rtDirty = true; warn('Writing the live board failed: ' + e.message) })
  if ((boardDirty && Date.now() - boardWrittenAt >= BOARD_MIN_MS) || Date.now() - boardWrittenAt > BOARD_HEARTBEAT_MS) await writeBoard().catch(e => warn('Writing the board failed: ' + e.message))
  if (!migrated && Date.now() >= nextMigration) { nextMigration = Date.now() + 30 * 60_000; migrated = await migrateChats().catch(e => { warn('Moving chats failed (will retry): ' + e.message); return false }) }
  if (resetsPending) { resetsPending = false; await passwordResets() }
  if (seasonEndsAt && Date.now() >= seasonEndsAt) { seasonEndsAt = null; await endSeasonIfDue().catch(e => warn('Season end check failed: ' + e)) }
  if (Date.now() >= nextRules && !LOCAL) { nextRules = Date.now() + 60 * 60_000; await rulesCheck() }
  if (Date.now() >= nextCodeCheck) { nextCodeCheck = Date.now() + 5 * 60_000; if (await newerCodeOnMain()) { notice('Newer code on main; handing over to a fresh run.'); break } }
  if (Date.now() - started + TICK_MS > RUN_FOR_MS && !chatEvents.size && !voteEvents.length && !supportEvents.size) break
  await new Promise(res => setTimeout(res, TICK_MS))
}
listeners.forEach(stop => stop())
chatsRef.off(); hereRef.off(); readsRef.off()
await adminApp.delete?.().catch?.(() => {})
notice(`Worker: ${rounds} rounds with activity, ${boardWrites} board updates, ${sent} notifications sent, ${dropped} stale devices removed, ${resets} password resets applied, ${seasonsEnded} seasons ended.`)
process.exit(0)
