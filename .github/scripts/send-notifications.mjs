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
// What is really in the database is looked at now and then (and at once after an account is deleted): a row left by an earlier
// worker, by a write that failed, or for a doc deleted behind the worker's back would otherwise stay on the ranking for good.
const RT_SYNC_MS = 2 * 60_000
let rtSyncAt = 0
async function writeRtBoard() {
  rtDirty = false
  if (Date.now() - rtSyncAt >= RT_SYNC_MS) {
    rtRows = new Map(Object.entries((await rdb.ref('board/rows').once('value')).val() ?? {}))
    rtSyncAt = Date.now()
  }
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
const lastAgg = new Map()  // `${uid}|${kind}` → { key, feed, at, d, n, x }: votes, hearts and listens within 30 minutes go into one line
// Who paid whom, noted by the worker at the moment it pays (hearts, listens) or sees it (votes), so the
// ledger line can say where the points came from. Entries are 'what|…|count' strings, merged per line.
const payNotes = new Map() // uid → [{ at, d, k, x }]
function notePay(uid, k, d, entries) {
  if (!uid || !d) return
  const list = (payNotes.get(uid) ?? []).filter(n => Date.now() - n.at < 15 * 60_000)
  list.push({ at: Date.now(), d, k, x: entries.join(';') }); payNotes.set(uid, list)
}
/** 'a|b|1;c|d|2' + more → one list: the same entries add their counts (the newest 30 are kept). */
function mergeX(old, more) {
  const map = new Map()
  for (const e of [old, more].flatMap(t => (t ?? '').split(';')).filter(Boolean)) {
    const i = e.lastIndexOf('|'), key = e.slice(0, i), n = Number(e.slice(i + 1)) || 1
    const cur = map.get(key) ?? 0
    map.delete(key); map.set(key, cur + n)
  }
  return [...map].slice(-30).map(([k, n]) => `${k}|${n}`).join(';')
}
const countX = x => (x ?? '').split(';').filter(Boolean).reduce((n, e) => n + (Number(e.slice(e.lastIndexOf('|') + 1)) || 1), 0)
const gains = new Map()    // uid → [{ at, d, k }] within ALERT_WINDOW_MS
const ledgerWrites = new Map()
let feedWrites = 0

const voterNotes = new Map() // candidate uid → [{ by, at }]: who voted for them lately
function voterEntries(uid, n) {
  const list = (voterNotes.get(uid) ?? []).filter(v => Date.now() - v.at < 15 * 60_000)
  const mine = list.splice(0, n)
  voterNotes.set(uid, list)
  return mine.map(v => `${v.by}|1`).join(';')
}
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
async function classify(o, d, uid = '') {
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
  for (const pass of ['pass2x', 'passFake', 'passSpeed']) if (d[pass] && !o[pass] && dSpent > 0) { const cost = pass === 'passFake' ? Math.min(dSpent, 299) : pass === 'passSpeed' ? Math.min(dSpent, 500) : Math.min(dSpent, 5000); out.push({ d: -cost, k: 'pass', x: pass }); dSpent -= cost }
  const items = marketMoved ? [] : newItems(o, d)
  if (items.length && dSpent > 0) { out.push({ d: -dSpent, k: 'buy', x: items.join(',') }); dSpent = 0 }
  const gone = (d.lastGift !== o.lastGift || marketMoved ? [] : newItems(d, o)).concat(marketMoved ? [] : ['pass2x', 'passFake', 'passSpeed'].filter(k => o[k] && !d[k]))
  if (gone.length && dSpent === 0) out.push({ d: 0, k: 'revoke', x: gone.join(',') })
  // hearts and listens the worker itself paid (it noted who from): not an admin grant
  const notes = payNotes.get(uid) ?? []
  while (dBonus > 0 && notes.length && notes[0].d <= dBonus) { const n = notes.shift(); out.push({ d: n.d, k: n.k, x: n.x }); dBonus -= n.d }
  if (dEarned) out.push({ d: dEarned, k: 'vote', x: voterEntries(uid, Math.max(1, Math.round(dEarned / 10))) })
  if (dBonus) out.push({ d: dBonus, k: 'grant' })
  if (dSpent) out.push({ d: -dSpent, k: 'other' })
  return out.filter(e => e.d !== 0 || ['revoke', 'giftItemClaim', 'marketList', 'marketCancel'].includes(e.k))
}
const AGG = ['vote', 'heart', 'song']
/** `balance`: the points after all of `lines`; every line then shows what the points were after it. */
async function record(uid, lines, at = Date.now(), balance = null) {
  const up = {}
  let running = balance == null ? null : balance - lines.reduce((n, e) => n + e.d, 0)
  for (const e of lines) {
    if (running != null) running += e.d
    const bal = running == null ? {} : { b: running }
    const ak = `${uid}|${e.k}`, lv = AGG.includes(e.k) ? lastAgg.get(ak) : null
    const cnt = e.k === 'vote' ? Math.max(1, Math.round(e.d / 10)) : Math.max(1, countX(e.x))
    if (lv && at - lv.at < 30 * 60_000) {
      lv.d += e.d; lv.n += cnt; lv.at = at; lv.x = mergeX(lv.x, e.x)
      const f = { d: lv.d, n: lv.n, at, ...(lv.x ? { x: lv.x } : {}), ...bal }
      for (const [k, v] of Object.entries(f)) { up[`ledger/${uid}/${lv.key}/${k}`] = v; if (lv.feed) up[`ledgerFeed/${lv.feed}/${k}`] = v }
    } else {
      const key = rdb.ref(`ledger/${uid}`).push().key, feed = rdb.ref('ledgerFeed').push().key
      const row = { at, d: e.d, k: e.k, ...(e.x ? { x: e.x } : {}), ...(AGG.includes(e.k) ? { n: cnt } : {}), ...bal }
      up[`ledger/${uid}/${key}`] = row
      up[`ledgerFeed/${feed}`] = { ...row, u: uid }
      if (AGG.includes(e.k)) lastAgg.set(ak, { key, feed, at, d: e.d, n: cnt, x: e.x ?? '' })
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
    if (before) await record(uid, await classify({ ...stateOf({}), ...before }, now, uid), Date.now(), now.earned + now.bonus - now.spent)
    await saveState(uid, c)
  }
}
async function processLedger() {
  while (ledgerQueue.length) {
    const { id, o, d } = ledgerQueue.shift()
    if (!o) continue
    const a = stateOf(o), b = stateOf(d)
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    await record(id, await classify(a, b, id), Date.now(), b.earned + b.bonus - b.spent)
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

// (declared before the listeners, which can fire while the rest of the file is still starting)
// Deleting an account (the admin's 계정 삭제, asked for in deletions/{uid}), in this order, so it's quick and nothing stays usable:
//  1. banned/{uid} (no new account under this id) and the login: they can't use the app from this moment on;
//  2. the ranking: the leaderboard entry and its row on the live board, so they're gone from it at once;
//  3. the rest, several steps at a time: their votes taken back (tallies too), the points they moved put back, every doc of theirs;
//  4. the 선물 docs, once the points are back.
// The request ends as 'done' (or 'failed' with the reason), so the admin's screen can say which. Every step can be run again
// (after a failure, a crash or a restart), and money that's been put back is marked, so it's never moved twice.
const deletionQueue = new Set()
const inDeletion = new Set()
let deletionRunning = null
let bannedSweepAt = 0
const secs = ms => (ms / 1000).toFixed(1)
const banned_mark = id => fdb.doc(`banned/${id}`).update({ wiped: true }).catch(() => {})

// Runs fn over items, `limit` at a time. After the first failure no new item is started; the failure is thrown once the running ones are done.
async function eachLimit(items, limit, fn) {
  let i = 0, error = null
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length && !error) {
      try { await fn(items[i++]) } catch (e) { error ??= e }
    }
  }))
  if (error) throw error
}
// The refs of what a query matches (their data isn't read).
const refsOf = async q => (await q.select().get()).docs.map(d => d.ref)
// Deletes refs, 500 to a batch.
async function deleteRefs(refs) {
  for (let i = 0; i < refs.length; i += 500) {
    const b = fdb.batch()
    for (const r of refs.slice(i, i + 500)) b.delete(r)
    await b.commit()
  }
}

// The points they moved are put back, so nobody is left better or worse off through an account that's gone:
//  - a 선물 they sent that nobody took: cancelled;  one someone took: the points come back from that person
//  - a 선물 for them that isn't taken yet: cancelled, and the sender gets the points back;  one they took: the sender gets them back
//  - 당근마켓 listings of theirs: taken down (wipePerson)
// Each gift is changed in one transaction together with the points it moves, and marked `undone`, so a repeated run never moves them twice.
async function undoMoney(id) {
  const done = { cancelled: 0, takenBack: 0, refunded: 0 }
  const cand = uid => fdb.doc(`candidates/${uid}`)
  const undoGift = ref => fdb.runTransaction(async tx => {
    const g = await tx.get(ref)
    if (!g.exists || g.get('undone')) return null
    const d = g.data()
    const cancel = d.status === 'open' && (d.from === id || d.to === id)
    const refundTo = d.from && d.from !== id && ((d.to === id && d.status === 'open') || d.claimedBy === id) ? d.from : null
    const takeFrom = d.from === id && d.status === 'claimed' && !d.itemKind && d.claimedBy && d.claimedBy !== id ? d.claimedBy : null
    if (!cancel && !refundTo && !takeFrom) return null
    const payee = refundTo ? await tx.get(cand(refundTo)) : null
    const payer = takeFrom ? await tx.get(cand(takeFrom)) : null
    if (payee?.exists) tx.update(cand(refundTo), { spent: Math.max(0, (payee.get('spent') ?? 0) - d.amount) })
    if (payer?.exists) tx.update(cand(takeFrom), { bonus: (payer.get('bonus') ?? 0) - d.amount })
    tx.update(ref, { undone: true, doneAt: FieldValue.serverTimestamp(), ...(cancel ? { status: 'cancelled' } : {}) })
    return { cancel, refundTo, takeFrom }
  })
  const refs = new Map()
  for (const f of ['from', 'to', 'claimedBy']) for (const r of await refsOf(fdb.collection('gifts').where(f, '==', id))) refs.set(r.path, r)
  await eachLimit([...refs.values()], 8, async ref => {
    const r = await undoGift(ref)
    if (!r) return
    if (r.cancel) done.cancelled++
    if (r.refundTo) done.refunded++
    if (r.takeFrom) done.takenBack++
  })
  return Object.entries(done).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ')
}
// Their 선물 docs go once the points are back (so none is deleted before its money was undone).
async function deleteGifts(id) {
  const refs = new Map()
  for (const f of ['from', 'to', 'claimedBy']) for (const r of await refsOf(fdb.collection('gifts').where(f, '==', id))) refs.set(r.path, r)
  await deleteRefs([...refs.values()])
}

// Everything else of theirs goes too: nothing is left in the feeds, the chats, the wallets or last season's podium. The steps run
// together and each one on its own (one failing doesn't stop the rest); returns the names of the steps that failed.
async function wipePerson(id) {
  const failed = []
  const step = async (name, fn) => { try { await fn() } catch (e) { failed.push(name); warn(`Wiping ${name} of ${id} failed: ${e.message}`) } }
  const byUid = (col, field = 'uid') => refsOf(fdb.collection(col).where(field, '==', id))
  await Promise.all([
    step('posts', async () => eachLimit(await byUid('posts'), 8, r => fdb.recursiveDelete(r))), // with their comments and views
    step('homework', async () => eachLimit(await byUid('homework'), 8, r => fdb.recursiveDelete(r))),
    // their comments on other people's posts and 문서 (a collection-group query: it needs the comments index, see ensure-indexes.mjs)
    step('comments', async () => deleteRefs(await refsOf(fdb.collectionGroup('comments').where('uid', '==', id)))),
    step('songs', async () => eachLimit(await byUid('songs'), 8, async song => {
      await deleteRefs(await refsOf(fdb.collection('songPlays').where('vid', '==', song.id)))
      await song.delete()
    })),
    step('listens', async () => deleteRefs(await byUid('songPlays'))),
    step('bets', async () => deleteRefs(await byUid('gambles'))),
    step('orders', async () => deleteRefs(await byUid('coinOrders'))),
    step('market', async () => deleteRefs(await byUid('market', 'seller'))),
    step('devices', async () => deleteRefs(await byUid('pushTokens'))),
    step('addresses', async () => deleteRefs(await byUid('ips'))),
    step('records', () => Promise.all([`settings/${id}`, `support/${id}`, `userIps/${id}`, `noticeReads/${id}`, `pwResets/${id}`, `recs/${id}`, `banks/${id}`]
      .map(p => fdb.recursiveDelete(fdb.doc(p))))),
    // last season's podium, and the season results that name them
    step('seasons', async () => {
      const sRef = fdb.doc('meta/season')
      await fdb.runTransaction(async tx => {
        const top = (await tx.get(sRef)).get('last.top')
        if (Array.isArray(top) && top.some(t => t.id === id)) tx.update(sRef, { 'last.top': top.filter(t => t.id !== id) })
      })
      for (const r of (await fdb.collection('seasonResults').get()).docs) {
        const paid = r.get('paid')
        if (Array.isArray(paid) && paid.some(x => x.id === id || x.uid === id)) await r.ref.update({ paid: paid.filter(x => x.id !== id && x.uid !== id) })
      }
    }),
    // Realtime Database: their wallet, positions, history, flags, and every chat they were in
    step('wallet', async () => {
      await Promise.all(['wallets', 'positions', 'ledger', 'ledgerState', 'alerts', 'perks', 'reads', 'here', 'msgOff', 'scheduled', 'status', 'phone', 'callIn']
        .map(root => rdb.ref(`${root}/${id}`).remove()))
      const feed = (await rdb.ref('ledgerFeed').once('value')).val() ?? {}
      const mine = Object.keys(feed).filter(k => feed[k] && (feed[k].uid === id || feed[k].u === id))
      if (mine.length) await rdb.ref('ledgerFeed').update(Object.fromEntries(mine.map(k => [k, null])))
    }),
    step('chats', async () => {
      const mine = Object.keys((await rdb.ref(`userChats/${id}`).once('value')).val() ?? {})
      await eachLimit(mine, 4, async c => {
        if (c.includes('_')) { // a 1:1 chat goes away for both
          const other = c.split('_').find(u => u !== id)
          await Promise.all([rdb.ref(`chats/${c}`).remove(), rdb.ref(`msgs/${c}`).remove(), rdb.ref(`chatPhotos/${c}`).remove(), other ? rdb.ref(`userChats/${other}/${c}`).remove() : null])
        } else { // a group: they leave and their messages go
          const msgs = (await rdb.ref(`msgs/${c}`).once('value')).val() ?? {}
          const upd = Object.fromEntries(Object.entries(msgs).filter(([, m]) => m?.uid === id).map(([k]) => [`msgs/${c}/${k}`, null]))
          await rdb.ref().update({ ...upd, [`chats/${c}/members/${id}`]: null, [`chats/${c}/mutes/${id}`]: null, [`chats/${c}/timeouts/${id}`]: null })
        }
      })
      await rdb.ref(`userChats/${id}`).remove()
    }),
  ])
  return failed
}
// Votes they cast are taken back (each candidate's tallies with them, for the current season), then the votes on them go.
async function rollbackVotes(id) {
  const cur = (await fdb.doc('meta/season').get()).get('number') ?? 1
  const cast = await refsOf(fdb.collection('votes').where('uid', '==', id))
  // a vote's id is voter_candidate, so each one is its own transaction: its candidate's tallies change in the same write as the vote goes
  await eachLimit(cast, 12, vRef => fdb.runTransaction(async tx => {
    const vs = await tx.get(vRef)
    if (!vs.exists) return
    const vote = vs.data(), cRef = fdb.doc(`candidates/${vote.candidateId}`)
    const c = vote.candidateId && vote.candidateId !== id ? await tx.get(cRef) : null
    const ups = vote.season === cur ? vote.ups ?? 0 : 0, downs = vote.season === cur ? vote.downs ?? 0 : 0
    if (c?.exists && (ups || downs)) {
      const up = (c.get('up') ?? 0) - ups, down = (c.get('down') ?? 0) - downs
      tx.update(cRef, { up, down, score: up - down })
    }
    tx.delete(vRef)
  }))
  await deleteRefs(await refsOf(fdb.collection('votes').where('candidateId', '==', id)))
}
// Everything of theirs, in an order that keeps the money right: votes and the points they moved first (both read the people who are left),
// then their 선물 docs, only once the money is undone. Returns what went wrong (empty = all done) and what was undone.
async function clearAll(id) {
  const [votes, money, rest] = await Promise.allSettled([rollbackVotes(id), undoMoney(id), wipePerson(id)])
  const problems = []
  if (votes.status === 'rejected') problems.push('votes: ' + votes.reason?.message)
  if (rest.status === 'fulfilled') problems.push(...rest.value)
  else problems.push('wipe: ' + rest.reason?.message)
  let undone = ''
  if (money.status === 'fulfilled') {
    undone = money.value
    await deleteGifts(id).catch(e => problems.push('gifts: ' + e.message))
  } else problems.push('money: ' + money.reason?.message)
  return { problems, undone }
}

async function deletionsTick() {
  for (const id of [...deletionQueue]) {
    deletionQueue.delete(id)
    inDeletion.add(id)
    const ref = fdb.doc(`deletions/${id}`), t0 = Date.now(), took = {}
    try {
      await fdb.doc(`banned/${id}`).set({ at: FieldValue.serverTimestamp(), by: (await ref.get()).get('by') ?? '' })
      // the login goes at once (the hourly purge of banned/ is only a backstop)
      if (!LOCAL) {
        const del = await call(`${AUTH}/v1/projects/${project}/accounts:batchDelete`, { method: 'POST', headers: await headers(), body: JSON.stringify({ localIds: [id], force: true }) })
        if (del.ok && !del.json?.errors?.length) await fdb.doc(`banned/${id}`).update({ authDeleted: true })
        else warn(`Removing the login of ${id} failed (${del.status}); the hourly purge will try again.`)
      }
      took.login = Date.now() - t0
      // the ranking: the entry, and its row on the live board (the app reads that one first)
      await fdb.doc(`candidates/${id}`).delete()
      await rdb.ref(`board/rows/${id}`).remove()
      candidates.delete(id); rtSyncAt = 0; rtDirty = boardDirty = true
      took.ranking = Date.now() - t0
      const { problems, undone } = await clearAll(id)
      took.rest = Date.now() - t0
      if (problems.length) throw new Error(problems.join('; '))
      await banned_mark(id)
      await ref.update({ status: 'done', doneAt: FieldValue.serverTimestamp() })
      notice(`Account ${id} deleted in ${secs(Date.now() - t0)} s (login ${secs(took.login)} s, ranking ${secs(took.ranking)} s, the rest ${secs(took.rest)} s).${undone ? ' Rolled back: ' + undone : ''}`)
    } catch (e) {
      warn(`Deleting ${id} failed: ${e.message}`)
      await ref.update({ status: 'failed', error: String(e.message ?? e).slice(0, 200) }).catch(() => {})
    } finally {
      inDeletion.delete(id)
    }
  }
}
// Accounts deleted before everything of theirs was wiped get the same clean-up once (their leftovers: ranking rows, chats, wallet, history …).
// Marked banned/{uid}.wiped when done. Checked every 30 minutes.
async function bannedSweep() {
  if (Date.now() - bannedSweepAt < 30 * 60_000) return
  bannedSweepAt = Date.now()
  for (const b of (await fdb.collection('banned').get()).docs) {
    const id = b.id
    if (b.get('wiped') || inDeletion.has(id)) continue
    const { problems } = await clearAll(id)
    await rdb.ref(`board/rows/${id}`).remove().catch(() => {})
    if (problems.length) warn(`Clean-up of ${id} is not finished: ${problems.join('; ')}`)
    else { await banned_mark(id); notice(`Cleaned up what was left of the deleted account ${id}.`) }
  }
}
const listensBySong = new Map() // vid → Map(uid → secs)
const RECS_EVERY_MS = 10 * 60_000, RECS_NEIGHBOURS = 150, RECS_PICKS = 12
let recsAt = 0, recsDirty = true
const listeners = []
// accounts that changed (a new account, or a move): their grade is worked out at once, not at the next sweep
const bankQueue = new Set(), bankSeen = new Map()
// 문서 and 인스타그램 posts whose hearts changed ('homework/ID', 'posts/ID'): each new heart (from someone else)
// pays the author HEART_POINTS, once per person. Spotify listens ('songPlays/ID') pay the song's owner.
const homeQueue = new Set(), playQueue = new Set()
const firstDone = new Promise(resolve => {
  const seen = new Set(), total = 13
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
    listen('banks', fdb.collection('banks'), snap => {
      for (const c of snap.docChanges()) {
        if (c.type === 'removed') { bankSeen.delete(c.doc.id); continue }
        const v = c.doc.data(), prev = bankSeen.get(c.doc.id)
        bankSeen.set(c.doc.id, v)
        // a new account, or one whose savings or loan moved (the worker's own grade and interest writes don't count)
        if (!prev || prev.dep !== v.dep || prev.loan !== v.loan || prev.depBase !== v.depBase || prev.loanBase !== v.loanBase) bankQueue.add(c.doc.id)
      }
    }),
    listen('homework', fdb.collection('homework'), snap => {
      for (const c of snap.docChanges()) if (c.type !== 'removed') homeQueue.add('homework/' + c.doc.id)
    }),
    // the latest 200 photos (hearts on older ones are not paid)
    listen('posts', fdb.collection('posts').orderBy('at', 'desc').limit(200), snap => {
      for (const c of snap.docChanges()) if (c.type !== 'removed') homeQueue.add('posts/' + c.doc.id)
    }),
    listen('songPlays', fdb.collection('songPlays'), snap => {
      for (const c of snap.docChanges()) {
        const vid = c.doc.get('vid'), uid = c.doc.get('uid')
        if (!vid || !uid) continue
        if (c.type === 'removed') listensBySong.get(vid)?.delete(uid)
        else { if (!listensBySong.has(vid)) listensBySong.set(vid, new Map()); listensBySong.get(vid).set(uid, c.doc.get('secs') ?? 0) }
        if (c.type !== 'removed' && Math.floor((c.doc.get('secs') ?? 0) / 60) > (c.doc.get('paidMin') ?? 0)) playQueue.add(c.doc.id)
      }
      recsDirty = true
    }),
    // account deletions the admin asked for (deletions/{uid}, status 'queued')
    listen('deletions', fdb.collection('deletions').where('status', '==', 'queued'), snap => {
      for (const c of snap.docChanges()) if (c.type !== 'removed') deletionQueue.add(c.doc.id)
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
        if (at > cursor && v.candidateId && (v.weekKind === 'up' || v.weekKind === 'down')) {
          voteEvents.push({ candidateId: v.candidateId, kind: v.weekKind, at })
          if (v.uid) voterNotes.set(v.candidateId, [...(voterNotes.get(v.candidateId) ?? []), { by: v.uid, at: Date.now() }])
        }
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

// ---- 주식: domestic and foreign stocks (네이버 증권), traded with points — 1P = 1원 ----
// Prices come from Naver Finance: the Korean stocks in one batch (polling.finance.naver.com), the foreign
// stocks and the indices one by one (api.stock.naver.com, a few at a time), every STOCK_TICK_MS. A US
// stock's dollar price is turned into won with the live USD/KRW rate (a free rate API), so the price shown
// IS the number of points one share costs. The list keeps the symbols the app already knows (`y`:
// 005930.KS, AAPL, ^GSPC); the worker turns one into Naver's own code (005930, AAPL.O, .INX) when it asks.
// The list (meta/stocks, so the rules can check an order) is built once: anything Naver does not know is
// left out. Ids are `S_` + ticker or code (never clashing with a coin) and `I_` + name for the indices.
//   stocks/list/{id}    { t: ticker, n: Korean name, m: 'KR' | 'US' | 'IX', r: order }
//   stocks/live         { at, fx, st: { KR, US } market states, p: { id: points }, chg: { id: change since yesterday } }
//   stocks/info/{id}    { o, h, l, pc, v, hi, lo, cap, st }   open, high, low, previous close, volume, 52 w high / low, market cap
//   stocks/spark/{id}   [last 30 daily closes]
//   stocks/d/{id}       { d: [days since 1970], v: [closes] }  5 years of daily closes
//   stocks/h/{id}/{minute ms} = price                           24 h of changes (the 1-day chart)
// Orders are the coin ones (coinOrders, wallets, coinTrades): fillCoinOrder prices a `S_` coin from
// here, and only while the last good quote is recent.
const NAVER_API = process.env.NAVER_API_BASE || 'https://api.stock.naver.com'
const NAVER_M = process.env.NAVER_M_BASE || 'https://m.stock.naver.com'
const NAVER_POLL = process.env.NAVER_POLL_BASE || 'https://polling.finance.naver.com'
const NAVER_SISE = process.env.NAVER_SISE_BASE || 'https://api.finance.naver.com'
const FX_URLS = process.env.FX_URL ? [process.env.FX_URL] : ['https://open.er-api.com/v6/latest/USD', 'https://api.frankfurter.app/latest?from=USD&to=KRW']
const STOCK_TICK_MS = Number(process.env.STOCK_TICK_MS ?? 30_000)
const STOCK_STALE_MS = 15 * 60_000
const STOCK_MIN_LIST = Number(process.env.STOCK_MIN_LIST ?? 20) // fewer than this in the answer: not a real list
const STOCK_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
let stockList = null // [{ sym, y: symbol, t, n, m, nc?: Naver's code }]
let stockTradable = new Set()
// The built-in list (stocks-list.mjs) is shown while Naver refuses the real build; the real one is retried every 2 minutes.
let stockProvisional = false, stockBuildAt = 0
const stockPrices = {}, stockChg = {}, stockInfo = {}, stockLastSample = {}, stockHiLo = {}
let stockFx = 0, stockOkAt = 0, stockAt = 0, stockSlot = 0, stockInitAt = 0, stockWarned = 0, stockInfoSig = ''
let stockState = {}
let stockDailyBusy = false, stockDailyAt = 0, stockDailyTry = 0
const num = v => (Number.isFinite(v) ? sig(v) : 0)
const nv = v => { const x = Number(String(v ?? '').replace(/[, ]/g, '')); return Number.isFinite(x) ? x : 0 }
/** One GET (6 s at most). `err.down`: the site didn't answer properly (no connection, a timeout, 5xx, 429), as opposed to "not found". */
async function httpGet(url, text = false) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6_000)
  const what = url.replace(/^https?:\/\//, '').slice(0, 60)
  try {
    let r
    try { r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': STOCK_UA, Accept: 'application/json, text/plain, */*', Referer: 'https://m.stock.naver.com/' } }) }
    catch (e) { throw Object.assign(new Error(`${what} → ${e.name === 'AbortError' ? 'timeout' : e.message}`), { down: true }) }
    if (!r.ok) throw Object.assign(new Error(`${what} → ${r.status}`), { down: r.status >= 500 || r.status === 429 })
    return text ? await r.text() : await r.json()
  } finally { clearTimeout(t) }
}
// Naver not answering (an outage, or it turned this server away): after a few failures in a row the
// worker stops asking for a while — 1, 2, 4 … 30 minutes — instead of sending hundreds of requests
// into the void. Everything else in the worker carries on meanwhile (the stocks run beside it).
const NV_FAIL_LIMIT = 8
let nvFails = 0, nvDownUntil = 0, nvDownStep = 0
const nvWait = () => Math.max(1, Math.ceil((nvDownUntil - Date.now()) / 60_000))
async function naverGet(url, text = false) {
  if (Date.now() < nvDownUntil) throw Object.assign(new Error(`네이버 증권이 응답하지 않아 쉬는 중 · ${nvWait()}분 뒤 다시 시도`), { down: true, resting: true })
  try {
    const v = await httpGet(url, text)
    nvFails = 0; nvDownStep = 0
    return v
  } catch (e) {
    if (!e.down) { nvFails = 0; throw e } // it answered ("not found"): it's up
    if (++nvFails >= NV_FAIL_LIMIT) {
      nvFails = 0
      nvDownStep = Math.min(nvDownStep ? nvDownStep * 2 : 60_000, 30 * 60_000)
      nvDownUntil = Date.now() + nvDownStep
      warn(`Naver isn't answering (${e.message}); trying again in ${Math.round(nvDownStep / 60_000)} min`)
    }
    throw e
  }
}
/** The first of these addresses that answers. */
async function naverFirst(urls, text = false) {
  let last = null
  for (const u of urls) { try { return await naverGet(u, text) } catch (e) { last = e } }
  throw last
}
// Naver's code for an index (the Korean ones by name, the world ones with a dot) and where its pages live.
const NAVER_INDEX = { '^KS11': ['KOSPI', 'domestic'], '^KQ11': ['KOSDAQ', 'domestic'], '^GSPC': ['.INX', 'foreign'], '^DJI': ['.DJI', 'foreign'], '^IXIC': ['.IXIC', 'foreign'] }
const kindOf = s => s.m === 'KR' ? 'domestic' : s.m === 'IX' ? (NAVER_INDEX[s.y]?.[1] ?? 'foreign') : 'foreign'
const usGuesses = t => { const b = t.replace('-', ''); return [`${b}.O`, b, `${b}.N`, `${b}.K`, `${b}.A`] }
/** One answer of Naver's `basic` as a quote (price, change %, state). */
function basicQuote(j, symbol, m) {
  const price = nv(j?.closePrice)
  if (!(price > 0)) return null
  const dir = String(j?.compareToPreviousPrice?.name ?? j?.compareToPreviousPrice?.code ?? '')
  let pct = nv(j?.fluctuationsRatio)
  if (/FALL|LOWER|^4$|^5$/.test(dir)) pct = -Math.abs(pct); else if (/RIS|UPPER|^1$|^2$/.test(dir)) pct = Math.abs(pct)
  const cur = String(j?.currencyType?.code ?? '') || (m === 'US' ? 'USD' : 'KRW')
  return { symbol, currency: cur, regularMarketPrice: price, regularMarketChangePercent: pct, regularMarketPreviousClose: price / (1 + pct / 100), marketState: String(j?.marketStatus ?? '').toUpperCase() === 'OPEN' ? 'REGULAR' : 'CLOSED' }
}
/** The Korean stocks, a hundred a batch (polling.finance.naver.com). Returns Map(code → quote). */
async function pollKorean(codes) {
  const out = new Map()
  for (let i = 0; i < codes.length; i += 100) {
    const j = await naverGet(`${NAVER_POLL}/api/realtime?query=SERVICE_ITEM:${codes.slice(i, i + 100).join(',')}`)
    for (const area of j?.result?.areas ?? []) for (const d of area?.datas ?? []) {
      const price = nv(d.nv), prev = nv(d.pcv)
      if (!(price > 0) || !d.cd) continue
      out.set(String(d.cd), { symbol: String(d.cd), currency: 'KRW', regularMarketPrice: price, regularMarketPreviousClose: prev || price, regularMarketChangePercent: prev > 0 ? ((price - prev) / prev) * 100 : 0, regularMarketOpen: nv(d.ov) || price, regularMarketDayHigh: nv(d.hv) || price, regularMarketDayLow: nv(d.lv) || price, regularMarketVolume: nv(d.aq), marketState: String(d.ms ?? '').toUpperCase() === 'OPEN' ? 'REGULAR' : 'CLOSED' })
    }
  }
  return out
}
/** One stock or index by its Naver code: Naver's `basic` (from the second host too, unless only guessing). */
async function naverBasic(s, nc, guessing = false) {
  const base = s.m === 'IX' ? `index/${nc}` : `stock/${nc}`
  const urls = [`${NAVER_API}/${base}/basic`, `${NAVER_M}/api/${base}/basic`]
  return basicQuote(await naverFirst(guessing ? urls.slice(0, 1) : urls), s.y, s.m)
}
// Tickers Naver knows under none of the guesses (asked once per run, not every tick)
const naverUnknown = new Set()
/** Naver's code for a stock or index: for a foreign stock the first guess Naver answers to (kept on the entry). */
async function resolveNaver(s) {
  if (s.nc) return s.nc
  if (s.m === 'KR') return (s.nc = s.t) // a Korean stock's ticker IS its six-digit code
  if (s.m === 'IX') return (s.nc = NAVER_INDEX[s.y]?.[0] ?? s.t)
  if (naverUnknown.has(s.t)) return null
  let answered = true
  for (const g of usGuesses(s.t)) {
    try { const q = await naverBasic(s, g, true); if (q) { s.nc = g; s.q0 = q; return g } }
    catch (e) { if (e.down) { answered = false; break } }
  }
  if (answered) naverUnknown.add(s.t) // every guess got a real "no": stop asking
  return null
}
/** Runs `fn` over `items`, a few at a time. */
async function pool(items, n, fn) {
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const it = items[i++]; await fn(it).catch(() => {}) } }))
}
/** Quotes for a list of stocks: Map(sym → quote). Only all of them failing is an error. */
async function naverQuotes(list) {
  const out = new Map()
  let failed = null
  const kr = list.filter(s => s.m === 'KR')
  if (kr.length) {
    try { const q = await pollKorean(kr.map(s => s.t)); for (const s of kr) if (q.has(s.t)) out.set(s.sym, q.get(s.t)) } catch (e) { failed = e }
    // the ones the batch missed (all of them, if the batch failed) one by one
    await pool(kr.filter(s => !out.has(s.sym)).slice(0, 60), 6, async s => { const q = await naverBasic(s, s.t); if (q) out.set(s.sym, q) })
  }
  await pool(list.filter(s => s.m !== 'KR'), 8, async s => {
    const nc = await resolveNaver(s)
    if (!nc) return
    const q = s.q0 ?? await naverBasic(s, nc)
    s.q0 = null
    if (q) out.set(s.sym, q)
  })
  if (!out.size) throw failed ?? new Error('네이버 증권이 시세를 주지 않았어요')
  return out
}
/** The USD/KRW rate from a free rate API (the first that answers). */
async function fetchFx() {
  let last = null
  for (const u of FX_URLS) {
    try { const r = nv((await httpGet(u))?.rates?.KRW); if (r > 100 && r < 100000) return r } catch (e) { last = e }
  }
  throw last ?? new Error('No USD/KRW rate')
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
/** The stock list: from meta/stocks if it is the current version, else built from Naver (and saved). */
async function loadStockList() {
  const doc = await fdb.doc('meta/stocks').get()
  if (doc.exists && doc.get('ver') === STOCKS_VER && doc.get('list')?.length) { stockList = doc.get('list'); stockProvisional = false }
  else {
    try { stockList = await buildStockList(); stockProvisional = false }
    catch (e) {
      // Naver refused the start (outage): publish the built-in list so the app can show the stocks.
      // It is not saved, so the next start (or the retry in stockTick) builds the real one.
      stockList = provisionalStockList(); stockProvisional = true; stockBuildAt = Date.now()
      warn('Stock list: Naver refused the start, showing the built-in list until it answers: ' + e.message)
    }
  }
  await publishStockList()
}
/** Builds the list from Naver quotes and saves it to meta/stocks. Throws when Naver does not answer enough. */
async function buildStockList() {
  const all = provisionalStockList()
  const q = await naverQuotes(all)
  stockFx = await fetchFx().catch(() => stockFx)
  if (!stockFx) throw new Error('No USD/KRW rate yet')
  const list = all.filter(s => quoteOk(q.get(s.sym))).map(({ q0, ...s }) => s)
  if (list.length < STOCK_MIN_LIST) throw new Error('Too few stock quotes to build the list')
  await fdb.doc('meta/stocks').set({ ver: STOCKS_VER, list, syms: list.filter(s => s.m !== 'IX').map(s => s.sym), at: FieldValue.serverTimestamp() })
  return list
}
/** The built-in list: every listed code, priced once Naver answers. */
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
/** Won per unit of a stock's price: a US stock in dollars is turned into won, the rest are in won (or points). */
const stockRate = (s, x) => s.m !== 'US' || x.currency === 'KRW' ? 1 : x.currency === 'USD' ? stockFx : 0
/** One quote → price (points), change and the small facts. */
function applyStock(s, x) {
  const rate = stockRate(s, x)
  if (!quoteOk(x) || !rate) return false
  stockPrices[s.sym] = sig(x.regularMarketPrice * rate)
  stockChg[s.sym] = Number(((x.regularMarketChangePercent ?? 0) / 100).toFixed(5))
  const hl = stockHiLo[s.sym] ?? [0, 0]
  stockInfo[s.sym] = { o: num(x.regularMarketOpen * rate), h: num(x.regularMarketDayHigh * rate), l: num(x.regularMarketDayLow * rate), pc: num(x.regularMarketPreviousClose * rate), v: Math.round(x.regularMarketVolume ?? 0) || 0, hi: Math.max(hl[0], stockPrices[s.sym]), lo: hl[1] ? Math.min(hl[1], stockPrices[s.sym]) : stockPrices[s.sym], cap: 0, st: x.marketState ?? '' }
  if (x.marketState && s.m !== 'IX') stockState[s.m] = x.marketState
  return true
}
// How often each market is asked: the Korean stocks are one batch (two requests), but each US stock
// is a request of its own, so those are asked less often — and much less while the US market is
// closed (their prices don't move then). Indices every minute.
const US_OPEN_MS = 3 * 60_000, US_CLOSED_MS = 15 * 60_000, IX_EVERY_MS = 60_000
let usAt = 0, ixAt = 0
async function fetchStockPrices() {
  const now = Date.now()
  const usDue = now - usAt >= (stockState.US === 'REGULAR' ? US_OPEN_MS : US_CLOSED_MS)
  const ixDue = now - ixAt >= IX_EVERY_MS
  const want = stockList.filter(s => s.m === 'KR' || (s.m === 'US' ? usDue : ixDue))
  const [q, fx] = await Promise.all([naverQuotes(want), usDue || !stockFx ? fetchFx().catch(() => 0) : 0])
  if (fx) stockFx = fx
  let n = 0
  for (const s of want) if (applyStock(s, q.get(s.sym))) n++
  if (!n) throw new Error('No stock prices in the answer')
  if (want.some(s => s.m === 'US' && q.has(s.sym))) usAt = now
  if (want.some(s => s.m === 'IX' && q.has(s.sym))) ixAt = now
  stockOkAt = Date.now()
}
/** A stock's daily closes (in its own currency) from Naver: [days since 1970[], closes[]]. */
async function naverDaily(s) {
  const nc = await resolveNaver(s)
  if (!nc) return null
  const day = n => { const d = new Date(Date.now() - n * 86400_000); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}` }
  const kind = kindOf(s)
  const path = s.m === 'IX' ? `chart/${kind}/index/${nc}/day` : `chart/${kind}/item/${nc}/day`
  const d = [], v = []
  const add = (date, close) => {
    const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(date))
    if (m && close > 0) { d.push(Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400_000)); v.push(close) }
  }
  try {
    const j = await naverGet(`${NAVER_API}/${path}?startDateTime=${day(5 * 366)}0000&endDateTime=${day(0)}2359`)
    for (const r of Array.isArray(j) ? j : j?.priceInfos ?? j?.result ?? []) add(r.localDate ?? r.localTradedAt, nv(r.closePrice))
  } catch { /* the older Korean sheet below */ }
  if (v.length < 2 && s.m === 'KR') {
    // siseJson: [["날짜", ...], ["20260102", open, high, low, close, volume, ...], ...]
    const t = await naverGet(`${NAVER_SISE}/siseJson.naver?symbol=${nc}&requestType=1&startTime=${day(5 * 366)}&endTime=${day(0)}&timeframe=day`, true)
    for (const m of t.matchAll(/\[\s*["'](\d{8})["']\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/g)) add(m[1], Number(m[5]))
  }
  return v.length >= 2 ? [d, v] : null
}
/** 5 years of daily closes per stock (and the small lines for the list): refreshed about daily. */
async function stockDaily() {
  if (stockDailyBusy || !stockList || !stockFx) return
  stockDailyBusy = true
  try {
    const spark = {}
    let ok = 0
    await pool(stockList, 4, async s => {
      const h = await naverDaily(s)
      if (!h) return
      const rate = s.m === 'US' ? stockFx : 1
      const d = h[0], v = h[1].map(c => num(c * rate))
      await rdb.ref(`stocks/d/${s.sym}`).set({ d, v })
      spark[s.sym] = v.slice(-30)
      const year = v.slice(-252)
      stockHiLo[s.sym] = [Math.max(...year), Math.min(...year)]
      ok++
    })
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
// 문서 and 인스타그램: a heart from someone else pays the author HEART_POINTS. The post remembers who has been
// paid (`paid`), so a heart taken back and given again pays nothing more, and your own hearts pay nothing.
const HEART_POINTS = 2
async function homeTick() {
  const paths = [...homeQueue]
  homeQueue.clear()
  for (const path of paths) {
    const ref = fdb.doc(path)
    // a photo from before comments were counted: count them once
    if (path.startsWith('posts/')) {
      await ref.get().then(async snap => {
        if (snap.exists && snap.get('comments') === undefined) await ref.update({ comments: (await ref.collection('comments').count().get()).data().count })
      }).catch(e => warn(`Counting comments of ${path} failed: ${e.message}`))
    }
    const paidNow = await fdb.runTransaction(async tx => {
      const post = await tx.get(ref)
      if (!post.exists) return null
      const v = post.data(), author = v.uid, paid = Array.isArray(v.paid) ? v.paid : []
      const likers = Array.isArray(v.likes) ? v.likes : []
      const fresh = [...new Set(likers)].filter(u => u && u !== author && !paid.includes(u))
      if (!fresh.length || !author) return null
      const cand = fdb.doc(`candidates/${author}`)
      const c = await tx.get(cand)
      if (!c.exists) return null
      tx.update(cand, { bonus: FieldValue.increment(fresh.length * HEART_POINTS) })
      tx.update(ref, { paid: [...paid, ...fresh] })
      return { author, fresh }
    }).catch(e => { warn(`Hearts for ${path} failed: ${e.message}`); return null })
    // the ledger line says whose hearts, on which photo
    if (paidNow) notePay(paidNow.author, 'heart', paidNow.fresh.length * HEART_POINTS, paidNow.fresh.map(u => `${path}|${u}|1`))
  }
}

// Spotify: the app counts how long someone listens to a song (songPlays/{vid}_{listener}: `secs`, added up over
// every play, the rules limit it to real time and never for your own song). Every full minute pays the song's
// owner SONG_POINTS and counts as a play of the song (`plays`); `paidMin` is the minutes already paid.
const SONG_POINTS = 8
async function playTick() {
  const ids = [...playQueue]
  playQueue.clear()
  for (const id of ids) {
    const ref = fdb.doc(`songPlays/${id}`)
    const paid = await fdb.runTransaction(async tx => {
      const play = await tx.get(ref)
      if (!play.exists) return null
      const v = play.data(), due = Math.floor((v.secs ?? 0) / 60) - (v.paidMin ?? 0)
      if (due <= 0) return null
      const songRef = fdb.doc(`songs/${v.vid}`)
      const song = await tx.get(songRef)
      const owner = song.get('uid')
      if (!song.exists || !owner || owner === v.uid) { tx.update(ref, { paidMin: (v.paidMin ?? 0) + due }); return null }
      const cand = fdb.doc(`candidates/${owner}`)
      const c = await tx.get(cand)
      if (c.exists) tx.update(cand, { bonus: FieldValue.increment(due * SONG_POINTS) })
      tx.update(songRef, { plays: FieldValue.increment(due) })
      tx.update(ref, { paidMin: (v.paidMin ?? 0) + due })
      return c.exists ? { owner, vid: v.vid, listener: v.uid, due } : null
    }).catch(e => { warn(`Listen ${id} failed: ${e.message}`); return null })
    if (paid) notePay(paid.owner, 'song', paid.due * SONG_POINTS, [`${paid.vid}|${paid.listener}|${paid.due}`])
  }
}

// Spotify picks: recs/{uid} holds the songs that people with the most similar taste listened to most, which this person has not
// heard and did not add. Who listened to what is kept here in memory (from the songPlays listener above); every RECS_EVERY_MS
// (when something changed) the picks are written. Similar taste: the seconds two people both listened to, against all their listening.
async function recsTick(force = false) {
  if (!force && (!recsDirty || Date.now() - recsAt < RECS_EVERY_MS)) return
  recsDirty = false; recsAt = Date.now()
  const songs = await fdb.collection('songs').select('uid').get()
  const owner = new Map(songs.docs.map(d => [d.id, d.get('uid')]))
  const byUser = new Map() // uid → Map(vid → secs)
  for (const [vid, m] of listensBySong) if (owner.has(vid)) for (const [uid, secs] of m) {
    if (!byUser.has(uid)) byUser.set(uid, new Map())
    byUser.get(uid).set(vid, secs)
  }
  const total = m => [...m.values()].reduce((a, b) => a + b, 0) || 1
  const writes = []
  for (const [u, mine] of byUser) {
    const tu = total(mine), near = new Map()
    for (const vid of mine.keys()) for (const [l, secs] of listensBySong.get(vid)) if (l !== u) near.set(l, (near.get(l) ?? 0) + Math.min(secs, mine.get(vid)))
    const score = new Map()
    for (const [l, shared] of [...near.entries()].sort((a, b) => b[1] - a[1]).slice(0, RECS_NEIGHBOURS)) {
      const theirs = byUser.get(l)
      if (!theirs) continue
      const sim = shared / Math.sqrt(tu * total(theirs))
      for (const [vid, secs] of theirs) if (!mine.has(vid) && owner.get(vid) !== u) score.set(vid, (score.get(vid) ?? 0) + sim * secs)
    }
    const ids = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, RECS_PICKS).map(([vid]) => vid)
    writes.push([u, ids])
  }
  for (let i = 0; i < writes.length; i += 400) {
    const batch = fdb.batch()
    for (const [u, ids] of writes.slice(i, i + 400)) batch.set(fdb.doc(`recs/${u}`), { ids, at: FieldValue.serverTimestamp() })
    await batch.commit()
  }
}

async function bankTick() {
  const now = Date.now()
  const sweep = now - bankAt >= BANK_EVERY_MS
  if (!sweep && !bankQueue.size) return
  const queued = sweep ? null : [...bankQueue]
  bankQueue.clear()
  if (sweep) bankAt = now
  const docs = queued ? await Promise.all(queued.map(uid => fdb.doc(`banks/${uid}`).get())) : (await fdb.collection('banks').limit(1000).get()).docs
  for (const d of docs) {
    if (!d.exists) continue
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
// The stocks run beside the main loop: a slow or unreachable Naver never holds up notifications,
// coin orders or chat. One run at a time.
let stockRunning = false
function stockKick() {
  if (stockRunning) return
  stockRunning = true
  stockTick().catch(e => warn('Stock prices failed: ' + e.message)).finally(() => { stockRunning = false })
}
async function stockTick() {
  if (!stockList) {
    // the start-up didn't finish (Naver unreachable?): try again every 30 seconds
    if (Date.now() - stockInitAt > 30_000) {
      stockInitAt = Date.now()
      await stockInit().catch(e => { setStockStatus(false, '네이버 증권 연결 실패: ' + e.message); if (stockInitAt - stockWarned > 5 * 60_000) { stockWarned = stockInitAt; warn('Stock start failed (retrying every 30 s): ' + e.message) } })
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
  await fetchStockPrices().then(() => setStockStatus(true, 'ok'), e => {
    setStockStatus(false, '시세 가져오기 실패: ' + e.message)
    if (now - stockWarned > 5 * 60_000) { stockWarned = now; warn('Fetching stock prices failed: ' + e.message) }
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
    return files.some(f => /^(\.github\/(scripts\/(?!node_modules\/)|workflows\/notify\.yml$)|app\/src\/shared\/)/.test(f.filename))
  } catch { return false }
}
// Firestore rules: re-deployed hourly if they differ from this checkout (no Firestore reads).
const rulesCheck = () => new Promise(res => execFile('node', ['.github/scripts/deploy-firestore-rules.mjs'], { env: { ...process.env, SKIP_IF_SAME: '1' } }, err => { if (err) warn('Hourly rules check failed: ' + err.message); res() }))

coinInitAt = Date.now()
await coinInit().catch(e => warn('Coin start failed (retrying): ' + e.message))
stockKick() // starts the stocks (beside the loop, see stockKick)
let migrated = await migrateChats().catch(e => { warn('Moving chats to the Realtime Database failed (will retry): ' + e.message); return false })
let nextMigration = Date.now() + 30 * 60_000
let rounds = 0
const TICK_MS = Number(process.env.TICK_MS ?? 1000)
let nextCodeCheck = Date.now() + 10 * 60_000, nextRules = Date.now() + 60 * 60_000
while (true) {
  // a deletion runs beside the rest (nothing else should hold it up); the worker doesn't stop while one is running
  if (deletionQueue.size && !deletionRunning) deletionRunning = deletionsTick().catch(e => warn('Deletions failed: ' + e.message)).finally(() => { deletionRunning = null })
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
  stockKick()
  await bankTick().catch(e => warn('Bank failed: ' + e.message))
  await homeTick().catch(e => warn('Hearts failed: ' + e.message))
  await playTick().catch(e => warn('Listens failed: ' + e.message))
  await recsTick().catch(e => warn('Picks failed: ' + e.message))
  await bannedSweep().catch(e => warn('Clean-up of deleted accounts failed: ' + e.message))
  await fillCoinOrders()
  await mirrorPerks().catch(e => warn('Mirroring passes failed: ' + e.message))
  if (rtDirty || Date.now() - rtAt > RT_HEARTBEAT_MS || Date.now() - rtSyncAt >= RT_SYNC_MS) await writeRtBoard().catch(e => { rtDirty = true; warn('Writing the live board failed: ' + e.message) })
  if ((boardDirty && Date.now() - boardWrittenAt >= BOARD_MIN_MS) || Date.now() - boardWrittenAt > BOARD_HEARTBEAT_MS) await writeBoard().catch(e => warn('Writing the board failed: ' + e.message))
  if (!migrated && Date.now() >= nextMigration) { nextMigration = Date.now() + 30 * 60_000; migrated = await migrateChats().catch(e => { warn('Moving chats failed (will retry): ' + e.message); return false }) }
  if (resetsPending) { resetsPending = false; await passwordResets() }
  if (seasonEndsAt && Date.now() >= seasonEndsAt) { seasonEndsAt = null; await endSeasonIfDue().catch(e => warn('Season end check failed: ' + e)) }
  if (Date.now() >= nextRules && !LOCAL) { nextRules = Date.now() + 60 * 60_000; await rulesCheck() }
  if (Date.now() >= nextCodeCheck) { nextCodeCheck = Date.now() + 5 * 60_000; if (await newerCodeOnMain()) { notice('Newer code on main; handing over to a fresh run.'); break } }
  if (Date.now() - started + TICK_MS > RUN_FOR_MS && !chatEvents.size && !voteEvents.length && !supportEvents.size && !deletionRunning) break
  await new Promise(res => setTimeout(res, TICK_MS))
}
if (deletionRunning) await deletionRunning
listeners.forEach(stop => stop())
chatsRef.off(); hereRef.off(); readsRef.off()
await adminApp.delete?.().catch?.(() => {})
notice(`Worker: ${rounds} rounds with activity, ${boardWrites} board updates, ${sent} notifications sent, ${dropped} stale devices removed, ${resets} password resets applied, ${seasonsEnded} seasons ended.`)
process.exit(0)
