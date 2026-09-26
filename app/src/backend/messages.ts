import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  deleteField,
  Timestamp as FsTimestamp,
  type Firestore,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'

// Direct messages and group chats, at chats/{chatId} with messages in
// chats/{chatId}/messages. A 1:1 chat's id is the two uids sorted and joined
// with '_', so there's only ever one per pair. firestore.rules enforces who can
// read, create and send, including the 메시지 끄기 setting (candidates/{uid}.msgOff).

export const MAX_GROUP = 10
export const MAX_TEXT = 500
export const MAX_GROUP_NAME = 30

export type ChatDoc = {
  type: 'dm' | 'group'
  members: string[]
  name: string
  createdBy: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  last?: { text: string; uid: string; at: Timestamp | null }
  reads?: Record<string, Timestamp | null>
  /** Group icon (small JPEG data URL). */
  photo?: string
  /** Members who turned this chat's 알림 off. */
  mutes?: Record<string, boolean>
  /** 타임아웃 (group chats, set by the admin): uid → until when they can't send. */
  timeouts?: Record<string, Timestamp>
}
export type ChatRow = ChatDoc & { id: string }
/** 'image': the photo itself is in chats/{id}/media/{messageId}; 'system': e.g. "A님이 B님을 초대했어요". */
export type MessageKind = 'text' | 'image' | 'system' | 'gift'
export type ReplyRef = { id: string; uid: string; text: string }
export type MessageRow = { id: string; uid: string; text: string; at: Timestamp | null; kind?: MessageKind; giftId?: string; replyTo?: ReplyRef }

export const dmId = (a: string, b: string) => [a, b].sort().join('_')
const ms = (t: Timestamp | null | undefined) => (t ? t.toMillis() : 0)

/** Chats I'm in, most recently active first. */
export function subscribeMyChats(db: Firestore, uid: string, cb: (rows: ChatRow[]) => void, onError?: (e: unknown) => void): Unsubscribe {
  const q = query(collection(db, 'chats'), where('members', 'array-contains', uid))
  return onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as ChatDoc) }))
    rows.sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))
    cb(rows)
  }, onError)
}

/** Messages per page: the room listens to the latest page and loads older ones on scroll. */
export const PAGE = 40
const rowsOf = (docs: { id: string; data: (o: { serverTimestamps: 'estimate' }) => unknown }[]) =>
  docs.map(d => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Omit<MessageRow, 'id'>) })).reverse()

/** The latest PAGE messages of one chat, oldest first. `fromCache`: the first answer can come from the on-device cache (maybe partial) before the server's. */
export function subscribeMessages(db: Firestore, chatId: string, cb: (rows: MessageRow[], fromCache: boolean) => void, onError?: (e: unknown) => void): Unsubscribe {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('at', 'desc'), limit(PAGE))
  return onSnapshot(q, snap => cb(rowsOf(snap.docs), snap.metadata.fromCache), onError)
}

/** The PAGE messages before `before` (oldest first), read once when scrolling up. */
export async function loadOlderMessages(db: Firestore, chatId: string, before: Timestamp): Promise<MessageRow[]> {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('at', 'desc'), startAfter(before), limit(PAGE))
  return rowsOf((await getDocs(q)).docs)
}

/** Merges a fresh page into what the room already shows (by id), oldest first. */
export function mergeMessages(prev: MessageRow[] | null, rows: MessageRow[]) {
  const byId = new Map((prev ?? []).map(m => [m.id, m]))
  for (const r of rows) byId.set(r.id, r)
  return [...byId.values()].sort((a, b) => ms(a.at) - ms(b.at))
}

export const isUnread = (c: ChatDoc, me: string) =>
  !!c.last && c.last.uid !== me && ms(c.last.at) > ms(c.reads?.[me])

/** Opens (creating if needed) my 1:1 chat with `other`. */
export async function openDm(db: Firestore, me: string, other: string) {
  if (me === other) throw new Error('cannot-message-self')
  const id = dmId(me, other)
  const ref = doc(db, 'chats', id)
  if (!(await getDoc(ref)).exists()) {
    await setDoc(ref, {
      type: 'dm', members: [me, other].sort(), name: '', createdBy: me,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  }
  return id
}

/** Creates a group chat with me plus `others` (2 to MAX_GROUP - 1 people). */
export async function createGroup(db: Firestore, me: string, others: string[], name: string) {
  const members = [me, ...others.filter(o => o !== me)]
  if (new Set(members).size !== members.length) throw new Error('duplicate-member')
  if (members.length < 3 || members.length > MAX_GROUP) throw new Error('invalid-group-size')
  const ref = doc(collection(db, 'chats'))
  await setDoc(ref, {
    type: 'group', members, name: name.trim().slice(0, MAX_GROUP_NAME), createdBy: me,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function sendMessage(db: Firestore, me: string, chatId: string, text: string, replyTo?: ReplyRef) {
  const t = text.trim()
  if (!t || t.length > MAX_TEXT) throw new Error('invalid-message')
  const chatRef = doc(db, 'chats', chatId)
  const b = writeBatch(db)
  b.set(doc(collection(chatRef, 'messages')), { uid: me, text: t, at: serverTimestamp(), ...(replyTo ? { replyTo: { ...replyTo, text: replyTo.text.slice(0, 100) } } : {}) })
  b.update(chatRef, {
    last: { text: t.slice(0, 100), uid: me, at: serverTimestamp() },
    updatedAt: serverTimestamp(),
    [`reads.${me}`]: serverTimestamp(),
  })
  await b.commit()
}

/** Sends a photo (a data URL from fileToChatImage): the message plus its media doc, in one batch. */
export async function sendImage(db: Firestore, me: string, chatId: string, dataUrl: string) {
  const chatRef = doc(db, 'chats', chatId)
  const msgRef = doc(collection(chatRef, 'messages'))
  const b = writeBatch(db)
  b.set(msgRef, { uid: me, text: '', kind: 'image', at: serverTimestamp() })
  b.set(doc(chatRef, 'media', msgRef.id), { uid: me, data: dataUrl, at: serverTimestamp() })
  b.update(chatRef, {
    last: { text: '사진', uid: me, at: serverTimestamp() },
    updatedAt: serverTimestamp(),
    [`reads.${me}`]: serverTimestamp(),
  })
  await b.commit()
}

const imageCache = new Map<string, Promise<string>>()
/** A photo message's image, downloaded once (then kept on the device). */
export function loadImage(db: Firestore, chatId: string, messageId: string) {
  const k = chatId + '/' + messageId
  let p = imageCache.get(k)
  if (!p) {
    // A photo never changes: the on-device cache is enough once it has been seen (no read).
    const ref = doc(db, 'chats', chatId, 'media', messageId)
    p = getDocFromCache(ref).catch(() => getDoc(ref)).then(s => (s.data()?.data as string) ?? '')
    p.catch(() => imageCache.delete(k))
    imageCache.set(k, p)
  }
  return p
}

async function postSystem(db: Firestore, me: string, chatId: string, text: string) {
  const chatRef = doc(db, 'chats', chatId)
  const b = writeBatch(db)
  b.set(doc(collection(chatRef, 'messages')), { uid: me, text, kind: 'system', at: serverTimestamp() })
  b.update(chatRef, { last: { text: text.slice(0, 100), uid: me, at: serverTimestamp() }, updatedAt: serverTimestamp(), [`reads.${me}`]: serverTimestamp() })
  await b.commit()
}

/** Adds people to a group chat (up to MAX_GROUP in total) and posts "…님을 초대했어요". */
export async function inviteMembers(db: Firestore, me: string, chatId: string, ids: string[], notice: string) {
  if (!ids.length) return
  await updateDoc(doc(db, 'chats', chatId), { members: arrayUnion(...ids) })
  await postSystem(db, me, chatId, notice).catch(() => {})
}

/** Until when `uid` can't send in this chat (0 = free to talk). */
export const timedOutUntil = (c: ChatDoc, uid: string, now = Date.now()) => {
  const t = c.timeouts?.[uid]?.toMillis() ?? 0
  return t > now ? t : 0
}

/**
 * Admin only (firestore.rules: adminTimeout): puts `target` in 타임아웃 for `ms`
 * (0 lifts it) and posts `notice` ("…님을 10분 동안 타임아웃했어요") in the chat.
 */
export async function setChatTimeout(db: Firestore, me: string, chatId: string, target: string, ms: number, notice: string) {
  const chatRef = doc(db, 'chats', chatId)
  const b = writeBatch(db)
  b.update(chatRef, {
    [`timeouts.${target}`]: ms > 0 ? FsTimestamp.fromMillis(Date.now() + ms) : deleteField(),
    last: { text: notice.slice(0, 100), uid: me, at: serverTimestamp() }, updatedAt: serverTimestamp(), [`reads.${me}`]: serverTimestamp(),
  })
  b.set(doc(collection(chatRef, 'messages')), { uid: me, text: notice, kind: 'system', at: serverTimestamp() })
  await b.commit()
}

/** Group chat icon / name, shared by everyone in it. */
export async function setGroupInfo(db: Firestore, chatId: string, patch: { photo?: string; name?: string }) {
  await updateDoc(doc(db, 'chats', chatId), patch)
}

export async function markRead(db: Firestore, me: string, chatId: string) {
  await updateDoc(doc(db, 'chats', chatId), { [`reads.${me}`]: serverTimestamp() })
}

/** This chat's 알림 on/off, for me only. */
export async function setChatMuted(db: Firestore, me: string, chatId: string, muted: boolean) {
  await updateDoc(doc(db, 'chats', chatId), { [`mutes.${me}`]: muted })
}

/** Leaves a group chat (1:1 chats can't be left, only muted by turning messages off). */
export async function leaveGroup(db: Firestore, me: string, chatId: string) {
  await updateDoc(doc(db, 'chats', chatId), { members: arrayRemove(me) })
}

/** 메시지 끄기: nobody can message me or add me to a group, and I can't send either. */
export async function setMessagesOff(db: Firestore, me: string, off: boolean) {
  await updateDoc(doc(db, 'candidates', me), { msgOff: off })
}
