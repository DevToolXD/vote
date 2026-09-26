import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocFromCache,
  setDoc,
  updateDoc,
  deleteField,
  Timestamp as FsTimestamp,
  serverTimestamp as fsServerTimestamp,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  endBefore,
  get,
  getDatabase,
  limitToLast,
  onValue,
  orderByKey,
  push,
  query as rtQuery,
  ref,
  serverTimestamp,
  update,
  type Database,
} from 'firebase/database'

// Direct messages and group chats live in the Realtime Database, which is billed by
// bandwidth instead of per document read (a busy group chat used to eat Firestore's
// daily free reads in a couple of hours):
//   chats/{id}        info {type, name, createdBy, createdAt, photoAt}, members {uid: true},
//                     last {text, uid, at}, mutes {uid: true}, timeouts {uid: until}
//   chatPhotos/{id}   group icon (data URL)
//   msgs/{id}/{key}   {uid, text, at, kind?, giftId?, replyTo?, mediaId?} (keys are chronological)
//   userChats/{uid}   {chatId: true} — my chat list
//   here/{id}/{uid}   "has this room open until" (no notification then)
//   reads/{uid}/{id}  when I last read a chat (unread badges on my other devices)
//   msgOff/{uid}      메시지 끄기
// database.rules.json enforces who can read, create and send. Firestore keeps a copy of
// each chat's members (chats/{id}), because the 포인트 선물 and photo rules check them there;
// photos stay in Firestore at chats/{id}/media/{messageId} (read once, then cached).
// A 1:1 chat's id is the two uids sorted and joined with '_', so there's only ever one per pair.

export const MAX_GROUP = 10
export const MAX_TEXT = 500
export const MAX_GROUP_NAME = 30

/** A moment in time, like a Firestore Timestamp (the UI calls toMillis()). */
export type Stamp = { toMillis(): number }
const stamp = (ms: number): Stamp => ({ toMillis: () => ms })

export type ChatDoc = {
  type: 'dm' | 'group'
  members: string[]
  name: string
  createdBy: string
  createdAt: Stamp | null
  updatedAt: Stamp | null
  last?: { text: string; uid: string; at: Stamp | null }
  /** My own last-read time (from reads/{me}). */
  reads?: Record<string, Stamp | null>
  /** Group icon (small JPEG data URL). */
  photo?: string
  /** Members who turned this chat's 알림 off. */
  mutes?: Record<string, boolean>
  /** 타임아웃 (group chats, set by the admin): uid → until when they can't send. */
  timeouts?: Record<string, Stamp>
}
export type ChatRow = ChatDoc & { id: string }
/** 'image': the photo itself is in Firestore chats/{id}/media/{mediaId ?? id}; 'system': e.g. "A님이 B님을 초대했어요". */
export type MessageKind = 'text' | 'image' | 'system' | 'gift'
export type ReplyRef = { id: string; uid: string; text: string }
export type MessageRow = { id: string; uid: string; text: string; at: Stamp | null; kind?: MessageKind; giftId?: string; replyTo?: ReplyRef; mediaId?: string }

export const dmId = (a: string, b: string) => [a, b].sort().join('_')
const ms = (t: Stamp | null | undefined) => (t ? t.toMillis() : 0)

// The Realtime Database belonging to the same app as `db` (tests run one app per user).
const rtdbs = new WeakMap<Firestore, Database>()
export function setChatDatabase(db: Firestore, rtdb: Database) { rtdbs.set(db, rtdb) }
const R = (db: Firestore) => rtdbs.get(db) ?? getDatabase(db.app)

type ChatNode = {
  info?: { type: 'dm' | 'group'; name?: string; createdBy: string; createdAt?: number; photoAt?: number }
  members?: Record<string, true>
  last?: { text: string; uid: string; at: number }
  mutes?: Record<string, boolean>
  timeouts?: Record<string, number>
}
function toRow(id: string, n: ChatNode, photo: string | undefined, myRead: number | undefined, me: string): ChatRow | null {
  if (!n.info || !n.members?.[me]) return null
  const created = n.info.createdAt ?? 0
  return {
    id, type: n.info.type, name: n.info.name ?? '', createdBy: n.info.createdBy,
    members: Object.keys(n.members), createdAt: stamp(created), updatedAt: stamp(n.last?.at ?? created),
    last: n.last ? { text: n.last.text, uid: n.last.uid, at: stamp(n.last.at) } : undefined,
    reads: myRead ? { [me]: stamp(myRead) } : undefined,
    photo, mutes: n.mutes,
    timeouts: n.timeouts ? Object.fromEntries(Object.entries(n.timeouts).map(([u, t]) => [u, stamp(t)])) : undefined,
  }
}

/** Chats I'm in, most recently active first. */
export function subscribeMyChats(db: Firestore, uid: string, cb: (rows: ChatRow[]) => void, onError?: (e: unknown) => void): Unsubscribe {
  const rtdb = R(db)
  const nodes = new Map<string, ChatNode>()
  const photos = new Map<string, string>()
  const stops = new Map<string, () => void>()
  const photoStops = new Map<string, () => void>()
  let myReads: Record<string, number> = {}
  let pending = false
  const emit = () => {
    if (pending) return
    pending = true
    queueMicrotask(() => {
      pending = false
      const rows = [...nodes.entries()].map(([id, n]) => toRow(id, n, photos.get(id), myReads[id], uid)).filter((r): r is ChatRow => !!r)
      rows.sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))
      cb(rows)
    })
  }
  const watchPhoto = (id: string, n: ChatNode) => {
    if (!n.info?.photoAt || photoStops.has(id)) return
    photoStops.set(id, onValue(ref(rtdb, `chatPhotos/${id}`), s => { if (s.val()) photos.set(id, s.val()); else photos.delete(id); emit() }, () => {}))
  }
  const stopIndex = onValue(ref(rtdb, `userChats/${uid}`), s => {
    const ids = new Set(Object.keys((s.val() ?? {}) as Record<string, true>))
    for (const [id, stop] of stops) if (!ids.has(id)) { stop(); stops.delete(id); nodes.delete(id); photoStops.get(id)?.(); photoStops.delete(id) }
    for (const id of ids) {
      if (stops.has(id)) continue
      stops.set(id, onValue(ref(rtdb, `chats/${id}`), c => {
        const n = (c.val() ?? {}) as ChatNode
        nodes.set(id, n)
        watchPhoto(id, n)
        emit()
      }, () => { nodes.delete(id); emit() })) // left, or no longer allowed
    }
    if (!ids.size) emit()
  }, e => onError?.(e))
  const stopReads = onValue(ref(rtdb, `reads/${uid}`), s => { myReads = (s.val() ?? {}) as Record<string, number>; emit() }, () => {})
  return () => { stopIndex(); stopReads(); stops.forEach(f => f()); photoStops.forEach(f => f()) }
}

/** Messages per page: the room listens to the latest page and loads older ones on scroll. */
export const PAGE = 40
type MsgNode = { uid: string; text: string; at: number; kind?: MessageKind; giftId?: string; replyTo?: ReplyRef; mediaId?: string }
const rowsOf = (val: Record<string, MsgNode> | null): MessageRow[] =>
  Object.entries(val ?? {}).map(([id, m]) => ({ ...m, id, at: stamp(m.at) })).sort((a, b) => (a.id < b.id ? -1 : 1))

/** The latest PAGE messages of one chat, oldest first. */
export function subscribeMessages(db: Firestore, chatId: string, cb: (rows: MessageRow[], fromCache: boolean) => void, onError?: (e: unknown) => void): Unsubscribe {
  return onValue(rtQuery(ref(R(db), `msgs/${chatId}`), orderByKey(), limitToLast(PAGE)), s => cb(rowsOf(s.val()), false), onError)
}

/** The PAGE messages before the message `beforeId` (oldest first), read once when scrolling up. */
export async function loadOlderMessages(db: Firestore, chatId: string, beforeId: string): Promise<MessageRow[]> {
  const s = await get(rtQuery(ref(R(db), `msgs/${chatId}`), orderByKey(), endBefore(beforeId), limitToLast(PAGE)))
  return rowsOf(s.val())
}

/** Merges a fresh page into what the room already shows (by id), oldest first. */
export function mergeMessages(prev: MessageRow[] | null, rows: MessageRow[]) {
  const byId = new Map((prev ?? []).map(m => [m.id, m]))
  for (const r of rows) byId.set(r.id, r)
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
}

// My own read times are also kept on this device, so the unread badges react instantly.
const READS_KEY = 'pv-reads'
const myReads: Record<string, number> = (() => { try { return JSON.parse(localStorage.getItem(READS_KEY) || '{}') } catch { return {} } })()
const readListeners = new Set<() => void>()
function noteMyRead(chatId: string, at: number) {
  if ((myReads[chatId] ?? 0) >= at) return
  myReads[chatId] = at
  try { localStorage.setItem(READS_KEY, JSON.stringify(myReads)) } catch { /* private mode */ }
  readListeners.forEach(f => f())
}
/** Re-render when I mark something read on this device. */
export function onMyReads(cb: () => void) { readListeners.add(cb); return () => { readListeners.delete(cb) } }
export const setReadsUser = (_uid: string) => {}

export const isUnread = (c: ChatDoc & { id?: string }, me: string) =>
  !!c.last && c.last.uid !== me && ms(c.last.at) > Math.max(ms(c.reads?.[me]), c.id ? myReads[c.id] ?? 0 : 0)

/** Reading along in the open room: this device's unread badge only, nothing sent. */
export const noteRead = (chatId: string, at: number) => noteMyRead(chatId, at)

/** "Has this room open" lasts this long unless refreshed every HEARTBEAT_MS; no notifications meanwhile. */
export const HERE_MS = 200_000, HEARTBEAT_MS = 90_000

/** In the room and on screen (entering, or the heartbeat): read up to now, here for HERE_MS. */
export async function markHere(db: Firestore, me: string, chatId: string) {
  noteMyRead(chatId, Date.now())
  await update(ref(R(db)), { [`here/${chatId}/${me}`]: Date.now() + HERE_MS, [`reads/${me}/${chatId}`]: serverTimestamp() })
}

/** Left the room (or the app went to the background): read up to now, not here any more. */
export async function markGone(db: Firestore, me: string, chatId: string) {
  noteMyRead(chatId, Date.now())
  await update(ref(R(db)), { [`here/${chatId}/${me}`]: null, [`reads/${me}/${chatId}`]: serverTimestamp() })
}
/** Marks a chat read (e.g. from another screen). */
export const markRead = markGone

/** Opens (creating if needed) my 1:1 chat with `other`. */
export async function openDm(db: Firestore, me: string, other: string) {
  if (me === other) throw new Error('cannot-message-self')
  const id = dmId(me, other)
  const rtdb = R(db)
  if (!(await get(ref(rtdb, `chats/${id}/info`))).exists()) {
    // The Firestore copy of the members (for the gift/photo rules); already there for older chats.
    await setDoc(doc(db, 'chats', id), { type: 'dm', members: [me, other].sort(), name: '', createdBy: me, createdAt: fsServerTimestamp(), updatedAt: fsServerTimestamp() }).catch(() => {})
    await update(ref(rtdb), {
      [`chats/${id}/info`]: { type: 'dm', createdBy: me, createdAt: serverTimestamp() },
      [`chats/${id}/members/${me}`]: true, [`chats/${id}/members/${other}`]: true,
      [`userChats/${me}/${id}`]: true, [`userChats/${other}/${id}`]: true,
    })
  } else {
    await update(ref(rtdb), { [`userChats/${me}/${id}`]: true })
  }
  return id
}

/** Creates a group chat with me plus `others` (2 to MAX_GROUP - 1 people). */
export async function createGroup(db: Firestore, me: string, others: string[], name: string) {
  const members = [me, ...others.filter(o => o !== me)]
  if (new Set(members).size !== members.length) throw new Error('duplicate-member')
  if (members.length < 3 || members.length > MAX_GROUP) throw new Error('invalid-group-size')
  const fsRef = doc(collection(db, 'chats')) // random id without '_' (1:1 ids have one)
  const n = name.trim().slice(0, MAX_GROUP_NAME)
  await setDoc(fsRef, { type: 'group', members, name: n, createdBy: me, createdAt: fsServerTimestamp(), updatedAt: fsServerTimestamp() })
  const paths: Record<string, unknown> = { [`chats/${fsRef.id}/info`]: { type: 'group', name: n, createdBy: me, createdAt: serverTimestamp() } }
  for (const m of members) { paths[`chats/${fsRef.id}/members/${m}`] = true; paths[`userChats/${m}/${fsRef.id}`] = true }
  await update(ref(R(db)), paths)
  return fsRef.id
}

/** A message plus the chat's last-message preview, in one write. */
async function post(db: Firestore, me: string, chatId: string, msg: Omit<MsgNode, 'uid' | 'at'>, preview: string, key?: string) {
  const rtdb = R(db)
  const k = key ?? push(ref(rtdb, `msgs/${chatId}`)).key!
  noteMyRead(chatId, Date.now())
  await update(ref(rtdb), {
    [`msgs/${chatId}/${k}`]: { ...msg, uid: me, at: serverTimestamp() },
    [`chats/${chatId}/last`]: { text: preview.slice(0, 100), uid: me, at: serverTimestamp() },
  })
  return k
}

export async function sendMessage(db: Firestore, me: string, chatId: string, text: string, replyTo?: ReplyRef) {
  const t = text.trim()
  if (!t || t.length > MAX_TEXT) throw new Error('invalid-message')
  await post(db, me, chatId, { text: t, ...(replyTo ? { replyTo: { ...replyTo, text: replyTo.text.slice(0, 100) } } : {}) }, t)
}

/** Sends a photo (a data URL from fileToChatImage): the image in Firestore, then the message. */
export async function sendImage(db: Firestore, me: string, chatId: string, dataUrl: string) {
  const key = push(ref(R(db), `msgs/${chatId}`)).key!
  await setDoc(doc(db, 'chats', chatId, 'media', key), { uid: me, data: dataUrl, at: fsServerTimestamp() })
  await post(db, me, chatId, { text: '', kind: 'image' }, '사진', key)
}

/** A 포인트 선물 card (the gift itself is in Firestore, see gifts.ts). */
export async function postGift(db: Firestore, me: string, chatId: string, giftId: string, text: string) {
  await post(db, me, chatId, { text, kind: 'gift', giftId }, text)
}

const imageCache = new Map<string, Promise<string>>()
/** A photo message's image, downloaded once (then kept on the device). */
export function loadImage(db: Firestore, chatId: string, mediaId: string) {
  const k = chatId + '/' + mediaId
  let p = imageCache.get(k)
  if (!p) {
    // A photo never changes: the on-device cache is enough once it has been seen (no read).
    const r = doc(db, 'chats', chatId, 'media', mediaId)
    p = getDocFromCache(r).catch(() => getDoc(r)).then(s => (s.data()?.data as string) ?? '')
    p.catch(() => imageCache.delete(k))
    imageCache.set(k, p)
  }
  return p
}

async function postSystem(db: Firestore, me: string, chatId: string, text: string) {
  await post(db, me, chatId, { text, kind: 'system' }, text)
}

/** Adds people to a group chat (up to MAX_GROUP in total) and posts "…님을 초대했어요". */
export async function inviteMembers(db: Firestore, me: string, chatId: string, ids: string[], notice: string) {
  if (!ids.length) return
  await updateDoc(doc(db, 'chats', chatId), { members: arrayUnion(...ids) })
  const paths: Record<string, unknown> = {}
  for (const m of ids) { paths[`chats/${chatId}/members/${m}`] = true; paths[`userChats/${m}/${chatId}`] = true }
  await update(ref(R(db)), paths)
  await postSystem(db, me, chatId, notice).catch(() => {})
}

/** Until when `uid` can't send in this chat (0 = free to talk). */
export const timedOutUntil = (c: ChatDoc, uid: string, now = Date.now()) => {
  const t = c.timeouts?.[uid]?.toMillis() ?? 0
  return t > now ? t : 0
}

/**
 * Admin only (rules: timeouts, adminTimeout): puts `target` in 타임아웃 for `ms`
 * (0 lifts it) and posts `notice` ("…님을 10분 동안 타임아웃했어요") in the chat.
 */
export async function setChatTimeout(db: Firestore, me: string, chatId: string, target: string, ms: number, notice: string) {
  const until = ms > 0 ? Date.now() + ms : 0
  // Firestore's copy keeps 포인트 선물 blocked too.
  await updateDoc(doc(db, 'chats', chatId), { [`timeouts.${target}`]: until ? FsTimestamp.fromMillis(until) : deleteField() })
  await update(ref(R(db)), { [`chats/${chatId}/timeouts/${target}`]: until || null })
  await postSystem(db, me, chatId, notice)
}

/** Group chat icon / name, shared by everyone in it. */
export async function setGroupInfo(db: Firestore, chatId: string, patch: { photo?: string; name?: string }) {
  const paths: Record<string, unknown> = {}
  if (patch.name !== undefined) paths[`chats/${chatId}/info/name`] = patch.name
  if (patch.photo !== undefined) { paths[`chatPhotos/${chatId}`] = patch.photo || null; paths[`chats/${chatId}/info/photoAt`] = serverTimestamp() }
  await update(ref(R(db)), paths)
}

/** This chat's 알림 on/off, for me only. */
export async function setChatMuted(db: Firestore, me: string, chatId: string, muted: boolean) {
  await update(ref(R(db)), { [`chats/${chatId}/mutes/${me}`]: muted || null })
}

/** Leaves a group chat (1:1 chats can't be left, only muted by turning messages off). */
export async function leaveGroup(db: Firestore, me: string, chatId: string) {
  await update(ref(R(db)), { [`chats/${chatId}/members/${me}`]: null, [`userChats/${me}/${chatId}`]: null, [`here/${chatId}/${me}`]: null })
  await updateDoc(doc(db, 'chats', chatId), { members: arrayRemove(me) }).catch(() => {})
}

/** 메시지 끄기: nobody can message me or add me to a group, and I can't send either. */
export async function setMessagesOff(db: Firestore, me: string, off: boolean) {
  await updateDoc(doc(db, 'candidates', me), { msgOff: off })
  await update(ref(R(db)), { [`msgOff/${me}`]: off || null })
}
