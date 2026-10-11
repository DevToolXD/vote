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
    if (e.d > 0 && !['grant', 'season', 'app', 'giftCancel', 'betWin', 'coinSell', 'coinRefund'].includes(e.k)) {
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
import { readFileSync } from 'node:fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { getDatabase, ServerValue } from 'firebase-admin/database'
import { INDICES, KR, STOCKS_VER, US } from './stocks-list.mjs'

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


// ---- 코인: real coins (Upbit's KRW market), traded with points — 1P = 1원 ----
// The list is the top 100 coins by 24 h trading value, chosen once (meta/coins in Firestore, so the
// rules can check an order's coin) and then kept. Prices come from Upbit's public API every few
// seconds and are published to the Realtime Database:
//   coins/list/{SYM}   { n: Korean name, r: rank }
//   coins/live         { at, p: { SYM: price }, chg: { SYM: change since yesterday } }
//   coins/spark        { SYM: [last 60 one-minute prices] }        (the small lines in the list)
//   coins/h/{SYM}/{15 s slot ms} = price                           (a coin's chart, 24 h)
// An admin boost (coinEvents) is an overlay on the real price: it moves the shown price up or
// down along a path, then fades back to the real price.
// Orders (coinOrders/{id}, written by the app): a buy has already paid its points
// (firestore.rules: coinBuy) and gets coins at the current price; a sell gets points
// (bonus, payCoin = order id) for coins it holds. Holdings: wallets/{uid}/{sym} { q, c }
// (amount, points paid for it). coinFills/{order id} makes each fill happen exactly once.
const UPBIT = process.env.UPBIT_BASE || 'https://api.upbit.com'
const COIN_COUNT = 100
const COIN_TICK_MS = Number(process.env.COIN_TICK_MS ?? 5000)
const COIN_FLOOR = 0.0001 // a boosted price never goes below this (buying divides by the price)
const HIST_MS = 15_000, COIN_KEEP_MS = 24 * 60 * 60_000
let coinList = null // [{ sym, market, name }]
let coinSyms = new Set()
const realPrices = {}, realChg = {}
let coinPrices = null, coinAt = 0, coinSlot = 0, coinSparkAt = 0
const sparkBuf = {}
const overlay = {}, trend = {} // admin boost: log multiplier on the real price, and its path
// 레버리지 positions (positions/{uid}/{orderId} = { sym, lev, margin, qty, entry, liq, at }), kept in
// memory for the liquidation checks; the app reads them from the database.
let positionsByUid = {}
rdb.ref('positions').on('value', s => { positionsByUid = s.val() ?? {} }, e => warn('Positions listener failed: ' + e.message))
const LEVERAGES = [2, 3, 5, 10, 500]
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
// Coin amounts keep 8 decimals, rounded down. The tiny allowance stops 0.12345678 × 1e8 landing
// just under a whole number and losing a unit.
const floor8 = x => Math.floor(x * 1e8 + 1e-6) / 1e8
const sig = x => Number(Number(x).toPrecision(7)) // what's stored: 7 significant digits
async function upbit(path) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000)
  try {
    const r = await fetch(UPBIT + path, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`Upbit ${path.slice(0, 30)} → ${r.status}`)
    return await r.json()
  } finally { clearTimeout(t) }
}
const tickers = async markets => {
  const out = []
  for (let i = 0; i < markets.length; i += 50) out.push(...await upbit(`/v1/ticker?markets=${markets.slice(i, i + 50).join(',')}`))
  return out
}
/** The coin list: from meta/coins if it exists, else the top COIN_COUNT KRW coins by 24 h value (and saved). */
async function loadCoinList() {
  const doc = await fdb.doc('meta/coins').get()
  if (doc.exists && doc.get('list')?.length) coinList = doc.get('list')
  else {
    const all = (await upbit('/v1/market/all')).filter(m => /^KRW-[A-Z0-9]{1,12}$/.test(m.market))
    const names = new Map(all.map(m => [m.market, m.korean_name || m.english_name || m.market.slice(4)]))
    const ts = (await tickers(all.map(m => m.market))).sort((x, y) => (y.acc_trade_price_24h ?? 0) - (x.acc_trade_price_24h ?? 0)).slice(0, COIN_COUNT)
    coinList = ts.map(t => ({ sym: t.market.slice(4), market: t.market, name: names.get(t.market) }))
    await fdb.doc('meta/coins').set({ list: coinList, syms: coinList.map(c => c.sym), at: FieldValue.serverTimestamp() })
  }
  coinSyms = new Set(coinList.map(c => c.sym))
  await rdb.ref('coins/list').set(Object.fromEntries(coinList.map((c, i) => [c.sym, { n: c.name, r: i + 1 }])))
}
async function fetchPrices() {
  const ts = await tickers(coinList.map(c => c.market))
  for (const t of ts) {
    const sym = t.market.slice(4)
    if (coinSyms.has(sym) && t.trade_price > 0) { realPrices[sym] = t.trade_price; realChg[sym] = t.signed_change_rate ?? 0 }
  }
}
// 코인 reset (once): everybody who holds coins gets the points back that are tied up in them,
// the old prices / charts / trades are cleared, open orders are cancelled (buys refunded).
// The refunds are saved first (meta/coinReal.pending) and each one is applied together with
// deleting its entry, so a crash and restart in the middle can never refund anyone twice.
async function migrateToReal() {
  const ref = fdb.doc('meta/coinReal')
  let snap = await ref.get()
  if (snap.get('done')) return
  if (!snap.exists) {
    const refunds = new Map()
    const add = (uid, pts) => { if (uid && pts > 0) refunds.set(uid, (refunds.get(uid) ?? 0) + pts) }
    for (const d of (await fdb.collection('coinOrders').where('status', '==', 'open').get()).docs) {
      const o = d.data()
      if (o.side === 'buy') add(o.uid, o.points)
      await d.ref.update({ status: 'failed', reason: 'reset', doneAt: FieldValue.serverTimestamp() })
    }
    for (const [uid, coins] of Object.entries((await rdb.ref('wallets').once('value')).val() ?? {})) for (const h of Object.values(coins ?? {})) add(uid, Math.round(h?.c ?? 0))
    await ref.set({ done: false, pending: Object.fromEntries(refunds), at: FieldValue.serverTimestamp() })
    await rdb.ref().update({ wallets: null, coinTrades: null, coinFills: null, 'coins/hist': null, 'coins/m1': null, 'coins/live': null, 'coins/spark': null, 'coins/h': null })
    coinOrders.clear()
    snap = await ref.get()
  }
  let n = 0
  for (const [uid, pts] of Object.entries(snap.get('pending') ?? {})) {
    try {
      await fdb.runTransaction(async tx => {
        const cand = await tx.get(fdb.doc(`candidates/${uid}`))
        if (cand.exists) tx.update(cand.ref, { bonus: FieldValue.increment(pts), payCoin: 'refund' })
        tx.update(ref, { [`pending.${uid}`]: FieldValue.delete() })
      })
      n++
    } catch (e) { warn(`Refunding ${uid} failed (will retry): ${e.message}`) }
  }
  if (!Object.keys((await ref.get()).get('pending') ?? {}).length) await ref.update({ done: true })
  notice(`Coins reset to real prices: ${n} people refunded.`)
}
async function coinInit() {
  await migrateToReal()
  await loadCoinList()
  await fetchPrices()
  const spark = (await rdb.ref('coins/spark').once('value')).val() ?? {}
  for (const c of coinList) sparkBuf[c.sym] = Array.isArray(spark[c.sym]) ? spark[c.sym].slice(-60) : []
  coinPrices = {}
  for (const c of coinList) if (realPrices[c.sym]) coinPrices[c.sym] = realPrices[c.sym]
}
// The overlay follows the boost path (or fades back to 0): shown price = real price × exp(overlay).
function coinStep() {
  for (const c of coinList) {
    const real = realPrices[c.sym]
    if (!real) continue
    const tr = trend[c.sym]
    let o = overlay[c.sym] ?? 0
    if (tr) {
      const i = tr.total - tr.left
      o += (tr.target * (1 + tr.wave * Math.sin((2 * Math.PI * i) / tr.period + tr.phase))) / tr.norm + 0.004 * gauss()
      if (--tr.left <= 0) delete trend[c.sym]
    } else o *= 0.97
    if (!tr && Math.abs(o) < 1e-4) o = 0
    overlay[c.sym] = o
    coinPrices[c.sym] = o === 0 ? real : Math.max(COIN_FLOOR, real * Math.exp(o))
  }
}
// 관리자 코인 상승 (coinEvents/{id} { sym, pct, minutes }, written by the admin screen): the
// move is spread over the minutes, then the request is removed. Applied once.
const coinEventsQueue = []
rdb.ref('coinEvents').on('child_added', s => { const v = s.val(); if (v?.sym) coinEventsQueue.push({ id: s.key, ...v }) }, e => warn('Coin events failed: ' + e.message))
// The path of an admin boost: the log-price moves by `target` over `ticks`, with waves on top
// (a sine over the ride), normalized so the whole ride adds up to exactly the target.
function boostPath(pct, ticks) {
  // a drop of 100 % or more goes to the price floor (never 0: buying divides by the price)
  const target = Math.log(Math.max(1e-9, 1 + pct / 100)), period = 25 + Math.random() * 35, phase = Math.random() * 2 * Math.PI, wave = 0.9
  let norm = 0
  for (let i = 0; i < ticks; i++) norm += 1 + wave * Math.sin((2 * Math.PI * i) / period + phase)
  return { target, norm, total: ticks, left: ticks, period, phase, wave }
}
async function applyCoinEvents() {
  const done = []
  for (const ev of coinEventsQueue.splice(0)) {
    if (coinSyms.has(ev.sym)) {
      const pct = Number(ev.pct) || 0, minutes = Math.max(1, Math.min(30, Number(ev.minutes) || 1))
      trend[ev.sym] = boostPath(pct, Math.max(1, Math.round((minutes * 60_000) / COIN_TICK_MS)))
    }
    done.push(rdb.ref(`coinEvents/${ev.id}`).remove().catch(() => {}))
  }
  await Promise.all(done) // removed before the worker can exit
}
let coinFetchWarned = 0
let coinInitAt = 0
async function coinTick() {
  if (!coinPrices) {
    // the start-up didn't finish (Upbit unreachable?): try again every 30 seconds
    if (Date.now() - coinInitAt > 30_000) { coinInitAt = Date.now(); await coinInit().catch(e => warn('Coin start failed (retrying): ' + e.message)) }
    return
  }
  await applyCoinEvents()
  const now = Date.now()
  if (now - coinAt < COIN_TICK_MS) return
  coinAt = now
  await fetchPrices().catch(e => { if (now - coinFetchWarned > 5 * 60_000) { coinFetchWarned = now; warn('Fetching prices failed (the last ones stay): ' + e.message) } })
  coinStep()
  const p = {}, chg = {}
  for (const c of coinList) if (coinPrices[c.sym]) {
    p[c.sym] = sig(coinPrices[c.sym])
    // change since yesterday, with the boost included: (1 + real change) × overlay − 1
    chg[c.sym] = Number((((1 + (realChg[c.sym] ?? 0)) * Math.exp(overlay[c.sym] ?? 0)) - 1).toFixed(5))
  }
  // liquidation: a long is closed (margin lost) once the price falls to its liquidation price
  for (const [uid, byId] of Object.entries(positionsByUid)) for (const [id, pos] of Object.entries(byId ?? {})) {
    const price = p[pos.sym]
    if (!price || !(price <= pos.liq)) continue
    delete positionsByUid[uid]?.[id]
    rdb.ref().update({ [`positions/${uid}/${id}`]: null, [`coinFills/${id}`]: { price, qty: pos.qty, points: 0, liquidated: true } }).catch(e => warn('Liquidation failed: ' + e.message))
    recordTrade(id, { uid, coin: pos.sym, side: 'liq' }, price, pos.qty, 0).catch(() => {})
  }
  const up = { 'coins/live': { at: now, p, chg } }
  // charts: one sample per coin every 15 seconds, the last 24 hours kept
  const slot = Math.floor(now / HIST_MS) * HIST_MS
  if (slot !== coinSlot) {
    for (const sym of Object.keys(p)) {
      up[`coins/h/${sym}/${slot}`] = p[sym]
      for (let k = 0; k < (coinSlot ? Math.min(40, (slot - coinSlot) / HIST_MS) : 1); k++) up[`coins/h/${sym}/${slot - COIN_KEEP_MS - k * HIST_MS}`] = null
    }
    coinSlot = slot
  }
  // the small lines in the list: one price a minute, the last 60
  if (now - coinSparkAt >= 60_000) {
    coinSparkAt = now
    const spark = {}
    for (const sym of Object.keys(p)) { const b = (sparkBuf[sym] ??= []); b.push(p[sym]); if (b.length > 60) b.shift(); spark[sym] = b }
    up['coins/spark'] = spark
  }
  await rdb.ref().update(up)
}

// ---- 주식: domestic and foreign stocks (Yahoo Finance), traded with points — 1P = 1원 ----
// Prices come from Yahoo's quote endpoint (one answer for the whole list; a cookie + crumb are
// needed) every STOCK_TICK_MS. A US stock's dollar price is turned into won with the live USD/KRW
// rate (Yahoo's KRW=X), so the price shown IS the number of points one share costs. If the batch
// answer fails, a rotating slice is priced one by one with the chart endpoint instead.
// The list (meta/stocks, so the rules can check an order) is built once: Korean codes are tried as
// .KS and then .KQ and anything Yahoo does not know is left out. Ids are `S_` + ticker or code
// (never clashing with a coin) and `I_` + name for the indices (shown, not traded).
//   stocks/list/{id}    { t: ticker, n: Korean name, m: 'KR' | 'US' | 'IX', r: order }
//   stocks/live         { at, fx, st: { KR, US } market states, p: { id: points }, chg: { id: change since yesterday } }
//   stocks/info/{id}    { o, h, l, pc, v, hi, lo, cap, st }   open, high, low, previous close, volume, 52 w high / low, market cap
//   stocks/spark/{id}   [last 30 daily closes]
//   stocks/d/{id}       { d: [days since 1970], v: [closes] }  5 years of daily closes
//   stocks/h/{id}/{minute ms} = price                           24 h of changes (the 1-day chart)
// Orders are the coin ones (coinOrders, wallets, coinTrades): fillCoinOrder prices a `S_` coin from
// here, and only while the last good quote is recent.
const YAHOO = process.env.YAHOO_BASE || 'https://query1.finance.yahoo.com'
const YAHOO_COOKIE = process.env.YAHOO_COOKIE_URL || 'https://fc.yahoo.com'
const STOCK_TICK_MS = Number(process.env.STOCK_TICK_MS ?? 30_000)
const STOCK_STALE_MS = 15 * 60_000
const STOCK_MIN_LIST = Number(process.env.STOCK_MIN_LIST ?? 20) // fewer than this in the answer: not a real list
const STOCK_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
let stockList = null // [{ sym, y: Yahoo symbol, t, n, m }]
let stockTradable = new Set()
// The built-in list (stocks-list.mjs) is shown while Yahoo refuses the real build; the real one is retried every 2 minutes.
let stockProvisional = false, stockBuildAt = 0
const stockPrices = {}, stockChg = {}, stockInfo = {}, stockLastSample = {}
let stockFx = 0, stockOkAt = 0, stockAt = 0, stockSlot = 0, stockInitAt = 0, stockWarned = 0, stockRot = 0, stockInfoSig = ''
let stockState = {}
let stockDailyBusy = false, stockDailyAt = 0, stockDailyTry = 0
let ySession = null
const num = v => (Number.isFinite(v) ? sig(v) : 0)
// Yahoo answers 429 ("too many requests") to a server that asks too often. Then the worker stops asking
// for a while, and each new refusal waits longer (2, 4, 8 … 30 minutes), instead of retrying at once.
let yCooldownUntil = 0, yCooldownStep = 0
const yWait = () => Math.max(0, Math.ceil((yCooldownUntil - Date.now()) / 60_000))
function yLimited(what) {
  yCooldownStep = Math.min(yCooldownStep ? yCooldownStep * 2 : 120_000, 30 * 60_000)
  yCooldownUntil = Date.now() + yCooldownStep
  ySession = null
  return new Error(`${what} (야후가 요청을 잠시 제한했어요 · ${Math.round(yCooldownStep / 60_000)}분 뒤 다시 시도)`)
}
async function yahooSession() {
  if (Date.now() < yCooldownUntil) throw new Error(`야후가 요청을 잠시 제한했어요 · ${yWait()}분 뒤 다시 시도`)
  if (ySession) return ySession
  const r = await fetch(YAHOO_COOKIE, { redirect: 'manual', headers: { 'User-Agent': STOCK_UA } })
  const cookie = (r.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
  const c = await fetch(`${YAHOO}/v1/test/getcrumb`, { headers: { 'User-Agent': STOCK_UA, Cookie: cookie } })
  if (c.status === 429) throw yLimited('Yahoo crumb → 429')
  const crumb = (await c.text()).trim()
  if (!c.ok || !crumb || crumb.length > 60 || crumb.includes('<')) throw new Error(`Yahoo crumb → ${c.status}`)
  yCooldownStep = 0
  return (ySession = { cookie, crumb })
}
async function yahoo(path, again = true) {
  const ses = await yahooSession()
  let last = null
  for (const host of YAHOO_HOSTS) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10_000)
    try {
      const r = await fetch(`${host}${path}${path.includes('?') ? '&' : '?'}crumb=${encodeURIComponent(ses.crumb)}`, { signal: ctl.signal, headers: { 'User-Agent': STOCK_UA, Accept: 'application/json', Cookie: ses.cookie } })
      if (r.status === 429) throw yLimited(`Yahoo ${path.slice(0, 40)} → 429`)
      if ((r.status === 401 || r.status === 403) && again) { ySession = null; return yahoo(path, false) }
      if (!r.ok) throw new Error(`Yahoo ${host.replace(/^https:\/\//, '')} ${path.slice(0, 40)} → ${r.status}`)
      yCooldownStep = 0
      return await r.json()
    } catch (e) { last = e; if (String(e.message).includes('제한했어요')) break } finally { clearTimeout(t) }
  }
  throw last
}
// The same answers come from a second Yahoo host: if the first one refuses or fails, that one is asked.
const YAHOO_HOSTS = [YAHOO, process.env.YAHOO_ALT_BASE || 'https://query2.finance.yahoo.com'].filter((h, i, a) => a.indexOf(h) === i)
/** Quotes for many symbols, in batches. A batch that fails leaves its symbols out; only all failing is an error. */
async function yahooQuotes(symbols) {
  const out = new Map()
  let failed = null
  for (let i = 0; i < symbols.length; i += 100) {
    try {
      const j = await yahoo(`/v7/finance/quote?symbols=${encodeURIComponent(symbols.slice(i, i + 100).join(','))}`)
      for (const q of j?.quoteResponse?.result ?? []) out.set(q.symbol, q)
    } catch (e) { failed = e }
  }
  if (!out.size && failed) throw failed
  return out
}
// What the app shows when the prices don't come: the last outcome, written to stocks/status.
let stockStatusSig = '', stockStatusAt = 0
function setStockStatus(ok, msg) {
  const sig = `${ok}|${msg}`
  if (sig === stockStatusSig && Date.now() - stockStatusAt < 5 * 60_000) return
  stockStatusSig = sig; stockStatusAt = Date.now()
  rdb.ref('stocks/status').set({ at: Date.now(), ok, msg: String(msg).slice(0, 200) }).catch(() => {})
}
const quoteOk = q => q && q.regularMarketPrice > 0
/** The chart endpoint's meta as a quote (the fallback when the batch answer fails). */
async function chartQuote(y) {
  const m = (await yahoo(`/v8/finance/chart/${encodeURIComponent(y)}?range=1d&interval=1d`))?.chart?.result?.[0]?.meta
  if (!m) return null
  const prev = m.chartPreviousClose ?? m.previousClose
  return { symbol: y, currency: m.currency, regularMarketPrice: m.regularMarketPrice, regularMarketPreviousClose: prev, regularMarketChangePercent: prev > 0 ? ((m.regularMarketPrice - prev) / prev) * 100 : 0, regularMarketDayHigh: m.regularMarketDayHigh, regularMarketDayLow: m.regularMarketDayLow, regularMarketVolume: m.regularMarketVolume, fiftyTwoWeekHigh: m.fiftyTwoWeekHigh, fiftyTwoWeekLow: m.fiftyTwoWeekLow }
}
/** The stock list: from meta/stocks if it is the current version, else built from Yahoo (and saved). */
async function loadStockList() {
  const doc = await fdb.doc('meta/stocks').get()
  if (doc.exists && doc.get('ver') === STOCKS_VER && doc.get('list')?.length) { stockList = doc.get('list'); stockProvisional = false }
  else {
    try { stockList = await buildStockList(); stockProvisional = false }
    catch (e) {
      // Yahoo refused the start (rate limit or outage): publish the built-in list so the app can show the stocks.
      // It is not saved, so the next start (or the retry in stockTick) builds the real one.
      stockList = provisionalStockList(); stockProvisional = true; stockBuildAt = Date.now()
      warn('Stock list: Yahoo refused the start, showing the built-in list until it answers: ' + e.message)
    }
  }
  await publishStockList()
}
/** Builds the list from Yahoo quotes and saves it to meta/stocks. Throws when Yahoo does not answer enough. */
async function buildStockList() {
  const q = await yahooQuotes([...KR.map(([c]) => c + '.KS'), ...US.map(([t]) => t), ...INDICES.map(([t]) => t), 'KRW=X'])
  const kq = KR.filter(([c]) => !quoteOk(q.get(c + '.KS'))).map(([c]) => c + '.KQ')
  if (kq.length) for (const [k, v] of await yahooQuotes(kq)) q.set(k, v)
  if (!quoteOk(q.get('KRW=X'))) throw new Error('No USD/KRW rate yet')
  const list = []
  for (const [c, n] of KR) { const y = quoteOk(q.get(c + '.KS')) ? c + '.KS' : c + '.KQ'; if (quoteOk(q.get(y))) list.push({ sym: 'S_' + c, y, t: c, n, m: 'KR' }) }
  for (const [t, n] of US) if (quoteOk(q.get(t))) list.push({ sym: 'S_' + t, y: t, t, n, m: 'US' })
  for (const [y, t, n] of INDICES) if (quoteOk(q.get(y))) list.push({ sym: 'I_' + y.replace(/[^A-Za-z0-9]/g, ''), y, t, n, m: 'IX' })
  if (list.length < STOCK_MIN_LIST) throw new Error('Too few stock quotes to build the list')
  await fdb.doc('meta/stocks').set({ ver: STOCKS_VER, list, syms: list.filter(s => s.m !== 'IX').map(s => s.sym), at: FieldValue.serverTimestamp() })
  return list
}
/** The built-in list: every listed code, priced once Yahoo answers (Korean codes as .KS; the real list finds .KQ ones). */
function provisionalStockList() {
  return [
    ...KR.map(([c, n]) => ({ sym: 'S_' + c, y: c + '.KS', t: c, n, m: 'KR' })),
    ...US.map(([t, n]) => ({ sym: 'S_' + t, y: t, t, n, m: 'US' })),
    ...INDICES.map(([y, t, n]) => ({ sym: 'I_' + y.replace(/[^A-Za-z0-9]/g, ''), y, t, n, m: 'IX' })),
  ]
}
/** Publishes the list to the app. While provisional nothing is tradable (no prices to trade at yet). */
async function publishStockList() {
  stockTradable = new Set(stockProvisional ? [] : stockList.filter(s => s.m !== 'IX').map(s => s.sym))
  notice(`Stocks: ${stockList.filter(s => s.m === 'KR').length} Korean, ${stockList.filter(s => s.m === 'US').length} US, ${stockList.filter(s => s.m === 'IX').length} indices listed${stockProvisional ? ' (built-in, prices pending)' : ''}.`)
  await rdb.ref('stocks/list').set(Object.fromEntries(stockList.map((s, i) => [s.sym, { t: s.t, n: s.n, m: s.m, r: i + 1 }])))
}
/** One quote → price (points), change and the small facts; `rate` is won per unit of its currency. */
function applyStock(s, x) {
  const rate = s.m === 'IX' ? 1 : x.currency === 'KRW' ? 1 : x.currency === 'USD' ? stockFx : 0
  if (!quoteOk(x) || !rate) return false
  stockPrices[s.sym] = sig(x.regularMarketPrice * rate)
  stockChg[s.sym] = Number(((x.regularMarketChangePercent ?? 0) / 100).toFixed(5))
  stockInfo[s.sym] = { o: num(x.regularMarketOpen * rate), h: num(x.regularMarketDayHigh * rate), l: num(x.regularMarketDayLow * rate), pc: num(x.regularMarketPreviousClose * rate), v: Math.round(x.regularMarketVolume ?? 0) || 0, hi: num(x.fiftyTwoWeekHigh * rate), lo: num(x.fiftyTwoWeekLow * rate), cap: x.marketCap ? Math.round(x.marketCap * rate) : 0, st: x.marketState ?? '' }
  if (x.marketState && s.m !== 'IX') stockState[s.m] = x.marketState
  return true
}
async function fetchStockPrices() {
  const q = await yahooQuotes([...stockList.map(s => s.y), 'KRW=X'])
  if (quoteOk(q.get('KRW=X'))) stockFx = q.get('KRW=X').regularMarketPrice
  let n = 0
  for (const s of stockList) if (applyStock(s, q.get(s.y))) n++
  if (!n) throw new Error('No stock prices in the answer')
  stockOkAt = Date.now()
}
/** The batch answer failed: price a rotating slice of the list one by one. */
async function fetchStockSlice() {
  if (!stockFx) { const fx = await chartQuote('KRW=X'); if (quoteOk(fx)) stockFx = fx.regularMarketPrice; else throw new Error('No USD/KRW rate') }
  const slice = stockList.slice(stockRot, stockRot + 40)
  stockRot = stockRot + 40 >= stockList.length ? 0 : stockRot + 40
  let n = 0
  for (const s of slice) { const x = await chartQuote(s.y).catch(() => null); if (x && applyStock(s, x)) n++ }
  if (n) stockOkAt = Date.now()
}
/** 5 years of daily closes per stock (and the small lines for the list): refreshed about daily. */
async function stockDaily() {
  if (stockDailyBusy || !stockList || !stockFx) return
  stockDailyBusy = true
  try {
    const spark = {}
    let i = 0, ok = 0
    const work = async () => {
      while (i < stockList.length) {
        const s = stockList[i++]
        try {
          const r = (await yahoo(`/v8/finance/chart/${encodeURIComponent(s.y)}?range=5y&interval=1d`))?.chart?.result?.[0]
          const rate = s.m === 'IX' ? 1 : r?.meta?.currency === 'KRW' ? 1 : r?.meta?.currency === 'USD' ? stockFx : 0
          const close = r?.indicators?.quote?.[0]?.close ?? []
          const d = [], v = []
          ;(r?.timestamp ?? []).forEach((t, k) => { if (close[k] > 0 && rate) { d.push(Math.floor(t / 86400)); v.push(num(close[k] * rate)) } })
          if (v.length < 2) continue
          await rdb.ref(`stocks/d/${s.sym}`).set({ d, v })
          spark[s.sym] = v.slice(-30)
          ok++
        } catch (e) { /* one stock's history failing leaves it as it was */ }
      }
    }
    await Promise.all([work(), work(), work(), work()])
    if (ok) { await rdb.ref('stocks/spark').update(spark); stockDailyAt = Date.now(); await rdb.ref('stocks/dmeta').set({ at: stockDailyAt }) }
  } finally { stockDailyBusy = false }
}
// 은행 (bank): a savings account earns its interest every week, a loan owes its interest every week,
// and every account's credit grade and loan limit are worked out from what the person has now: the
// points, the savings and the items (their prices are in app/src/shared/prices.json, the rates and the
// grades in app/src/shared/bank.json, the same files the app reads).
const sharedJson = name => JSON.parse(readFileSync(new URL(`../../app/src/shared/${name}`, import.meta.url), 'utf8'))
const BANK = sharedJson('bank.json'), PRICES = sharedJson('prices.json')
const BANK_EVERY_MS = Number(process.env.BANK_EVERY_MS ?? 15 * 60_000)
const WEEK_MS = 7 * 24 * 3600_000
let bankAt = 0
const itemPrice = (kind, k) => k === 'none' ? 0 : kind === 'plate' ? (PRICES.plate[k] ?? (PRICES.frame[k] || PRICES.frameFallback) + PRICES.plateExtra) : (PRICES[kind][k] || PRICES.fallback)
const pointsOfDoc = c => (c.earned ?? c.up ?? 0) + (c.bonus ?? 0) - (c.spent ?? 0)
const itemsValue = c => ['frame', 'plate', 'skin'].reduce((n, kind) => n + (c.owned?.[kind] ?? []).reduce((m, k) => m + itemPrice(kind, k), 0), 0)
/** The grade from the net worth (the first grade it reaches) and the loan limit it allows. */
function creditOf(netWorth) {
  const g = BANK.grades.find(x => netWorth >= x.min) ?? BANK.grades.at(-1)
  return { grade: g.grade, limit: Math.max(0, Math.min(BANK.loan.cap, Math.floor(netWorth * g.ratio))) }
}
async function bankTick() {
  const now = Date.now()
  if (now - bankAt < BANK_EVERY_MS) return
  bankAt = now
  for (const d of (await fdb.collection('banks').limit(1000).get()).docs) {
    try {
      const b = d.data(), uid = d.id
      const cand = await fdb.doc(`candidates/${uid}`).get()
      if (!cand.exists) continue
      // the weekly interest for every week that is due (a worker that was down catches up). It is simple:
      // each week is the yearly rate ÷ 52 of the principal (what was put in / borrowed), never of the interest,
      // so a year at 50% is +50%.
      let dep = b.dep ?? 0, loan = b.loan ?? 0, nextAt = b.nextAt ?? now + WEEK_MS
      const depBase = b.depBase ?? dep, loanBase = b.loanBase ?? loan
      const logs = []
      let weeks = 0
      while (nextAt <= now && weeks < 52) {
        const di = Math.round(depBase * BANK.deposit.annual / BANK.deposit.weeks)
        const li = Math.round(loanBase * BANK.loan.annual / BANK.loan.weeks)
        dep += di
        loan += li
        if (di) logs.push({ kind: 'int-dep', amount: di })
        if (li) logs.push({ kind: 'int-loan', amount: li })
        nextAt += WEEK_MS
        weeks++
      }
      const net = pointsOfDoc(cand.data()) + dep + itemsValue(cand.data()) - loan
      const credit = creditOf(net)
      const batch = fdb.batch()
      batch.update(d.ref, { dep, depBase, loan, loanBase, nextAt, grade: credit.grade, limit: credit.limit, gradeAt: now })
      for (const l of logs) batch.set(d.ref.collection('log').doc(), { uid, ...l, at: FieldValue.serverTimestamp() })
      await batch.commit()
    } catch (e) { warn(`Bank account ${d.id} failed: ${e.message}`) }
  }
}

async function stockInit() {
  await loadStockList()
  // a failed first price fetch must not skip the history: the regular ticks retry the prices
  await fetchStockPrices().then(() => setStockStatus(true, 'ok'), e => setStockStatus(false, '시세 가져오기 실패: ' + e.message))
  stockDailyAt = (await rdb.ref('stocks/dmeta/at').once('value')).val() ?? 0
  if (Date.now() - stockDailyAt > 20 * 3600_000) { stockDailyTry = Date.now(); stockDaily().catch(e => warn('Stock history failed: ' + e.message)) }
}
async function stockTick() {
  if (!stockList) {
    // the start-up didn't finish (Yahoo unreachable?): try again every 30 seconds
    if (Date.now() - stockInitAt > 30_000) {
      stockInitAt = Date.now()
      await stockInit().catch(e => { setStockStatus(false, 'Yahoo 연결 실패: ' + e.message); if (stockInitAt - stockWarned > 5 * 60_000) { stockWarned = stockInitAt; warn('Stock start failed (retrying every 30 s): ' + e.message) } })
    }
    return
  }
  const now = Date.now()
  if (stockProvisional && now - stockBuildAt > 120_000) {
    stockBuildAt = now
    await buildStockList().then(async list => { stockList = list; stockProvisional = false; await publishStockList() }).catch(() => {})
  }
  if (now - stockAt < STOCK_TICK_MS) return
  stockAt = now
  await fetchStockPrices().then(() => setStockStatus(true, 'ok'), async e => {
    setStockStatus(false, '시세 가져오기 실패: ' + e.message)
    if (now - stockWarned > 5 * 60_000) { stockWarned = now; warn('Fetching stock prices failed (trying them one by one): ' + e.message) }
    await fetchStockSlice().catch(() => {})
  })
  if (!stockOkAt) return
  // the daily history again after 20 hours (a failed try waits an hour)
  if (now - stockDailyAt > 20 * 3600_000 && now - stockDailyTry > 3600_000) { stockDailyTry = now; stockDaily().catch(e => warn('Stock history failed: ' + e.message)) }
  const p = {}, chg = {}
  for (const s of stockList) if (stockPrices[s.sym]) { p[s.sym] = stockPrices[s.sym]; chg[s.sym] = stockChg[s.sym] ?? 0 }
  const up = { 'stocks/live': { at: stockOkAt, fx: Math.round(stockFx * 100) / 100, st: stockState, p, chg } }
  const infoSig = JSON.stringify(stockInfo)
  if (infoSig !== stockInfoSig) { stockInfoSig = infoSig; up['stocks/info'] = stockInfo }
  // the 1-day chart: a price is stored (one a minute) only when it changed
  const slot = Math.floor(now / 60_000) * 60_000
  if (slot !== stockSlot) {
    for (const s of stockList) {
      const v = p[s.sym]
      if (v && stockLastSample[s.sym] !== v) { up[`stocks/h/${s.sym}/${slot}`] = v; stockLastSample[s.sym] = v }
      for (let k = 0; k < (stockSlot ? Math.min(40, (slot - stockSlot) / 60_000) : 1); k++) up[`stocks/h/${s.sym}/${slot - COIN_KEEP_MS - k * 60_000}`] = null
    }
    stockSlot = slot
  }
  await rdb.ref().update(up)
}
// 거래 내역 for everyone (coinTrades/{coin}/{id} = who, side, points, qty, price): the newest 200
// per coin are kept; the app shows the latest ones on each coin's page.
const tradeWrites = new Map()
async function recordTrade(id, o, price, qty, points) {
  const name = await nameOf(o.uid)
  const ref = rdb.ref(`coinTrades/${o.coin}/${id}`)
  await ref.set({ name, side: o.side, points, qty, price, at: ServerValue.TIMESTAMP })
  const n = (tradeWrites.get(o.coin) ?? 0) + 1
  tradeWrites.set(o.coin, n)
  if (n >= 50) {
    tradeWrites.set(o.coin, 0)
    const keys = Object.keys((await rdb.ref(`coinTrades/${o.coin}`).orderByKey().once('value')).val() ?? {}).sort()
    const drop = keys.slice(0, Math.max(0, keys.length - 200))
    if (drop.length) await rdb.ref(`coinTrades/${o.coin}`).update(Object.fromEntries(drop.map(k => [k, null])))
  }
}
async function fillCoinOrder(id, o) {
  const isStock = o.coin.startsWith('S_')
  // a stock is priced from the last good quote, and only while that is recent
  const price = isStock ? (Date.now() - stockOkAt < STOCK_STALE_MS ? stockPrices[o.coin] : undefined) : coinPrices?.[o.coin]
  const fail = reason => fdb.doc(`coinOrders/${id}`).update({ status: 'failed', reason, doneAt: FieldValue.serverTimestamp() })
  if (isStock && o.side !== 'buy' && o.side !== 'sell') return fail('no-leverage') // liquidation only watches coins
  if (o.side === 'close') return fillClose(id, o, fail)
  if (!price) return 'retry'
  const filled = (await rdb.ref(`coinFills/${id}`).once('value')).val()
  if (o.side === 'long') {
    // 레버리지: the margin is already paid (coinBuy rules); the position is size = margin × lev
    if (filled == null) {
      const qty = floor8((o.points * o.lev) / price)
      const liq = price * (1 - 1 / o.lev)
      await rdb.ref().update({ [`positions/${o.uid}/${id}`]: { sym: o.coin, lev: o.lev, margin: o.points, qty, entry: price, liq, at: ServerValue.TIMESTAMP }, [`coinFills/${id}`]: { price, qty } })
      await recordTrade(id, { ...o, side: 'buy' }, price, qty, o.points).catch(e => warn('Recording a trade failed: ' + e.message))
      await fdb.doc(`coinOrders/${id}`).update({ status: 'done', price, qty, lev: o.lev, liq, doneAt: FieldValue.serverTimestamp() })
    } else await fdb.doc(`coinOrders/${id}`).update({ status: 'done', price: filled.price, qty: filled.qty, doneAt: FieldValue.serverTimestamp() })
    return
  }
  if (o.side === 'buy') {
    if (filled == null) {
      const qty = floor8(o.points / price)
      const w = (await rdb.ref(`wallets/${o.uid}/${o.coin}`).once('value')).val() ?? { q: 0, c: 0 }
      await rdb.ref().update({ [`wallets/${o.uid}/${o.coin}`]: { q: Math.round((w.q + qty) * 1e8) / 1e8, c: w.c + o.points }, [`coinFills/${id}`]: { price, qty } })
      await recordTrade(id, o, price, qty, o.points).catch(e => warn('Recording a trade failed: ' + e.message))
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
    const qty = floor8(Math.min(o.qty, w.q))
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
  await recordTrade(id, o, fill.price, fill.qty, fill.points).catch(e => warn('Recording a trade failed: ' + e.message))
}
// Closing a leveraged position: margin ± profit or loss (never below 0) comes back as bonus.
async function fillClose(id, o, fail) {
  const pos = (await rdb.ref(`positions/${o.uid}/${o.posId}`).once('value')).val()
  if (!pos) return fail('no-position')
  const price = coinPrices?.[pos.sym]
  if (!price) return
  const points = Math.max(0, Math.floor(pos.margin + pos.qty * (price - pos.entry)))
  await rdb.ref().update({ [`positions/${o.uid}/${o.posId}`]: null, [`coinFills/${id}`]: { price, qty: pos.qty, points } })
  await fdb.runTransaction(async tx => {
    const ord = await tx.get(fdb.doc(`coinOrders/${id}`))
    if (ord.get('status') !== 'open') return
    if (points > 0) tx.update(fdb.doc(`candidates/${o.uid}`), { bonus: FieldValue.increment(points), payCoin: id })
    tx.update(ord.ref, { status: 'done', price, qty: pos.qty, points, doneAt: FieldValue.serverTimestamp() })
  })
  await recordTrade(id, { uid: o.uid, coin: pos.sym, side: 'sell' }, price, pos.qty, points).catch(e => warn('Recording a trade failed: ' + e.message))
}
async function fillCoinOrders() {
  for (const [id, o] of [...coinOrders]) {
    coinOrders.delete(id)
    // no price yet (the first quotes haven't arrived): the order waits for the next round
    const r = await fillCoinOrder(id, o).catch(e => { warn(`Coin order ${id} failed: ${e.message}`) })
    if (r === 'retry') coinOrders.set(id, o)
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

coinInitAt = Date.now()
await coinInit().catch(e => warn('Coin start failed (retrying): ' + e.message))
stockInitAt = Date.now()
await stockInit().catch(e => warn('Stock start failed (retrying): ' + e.message))
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
  await stockTick().catch(e => warn('Stock prices failed: ' + e.message))
  await bankTick().catch(e => warn('Bank failed: ' + e.message))
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
