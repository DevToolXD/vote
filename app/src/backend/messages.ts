import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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
}
export type ChatRow = ChatDoc & { id: string }
/** 'image': the photo itself is in chats/{id}/media/{messageId}; 'system': e.g. "A님이 B님을 초대했어요". */
export type MessageKind = 'text' | 'image' | 'system' | 'gift'
export type MessageRow = { id: string; uid: string; text: string; at: Timestamp | null; kind?: MessageKind; giftId?: string }

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

/** The latest messages of one chat, oldest first. */
export function subscribeMessages(db: Firestore, chatId: string, cb: (rows: MessageRow[]) => void, onError?: (e: unknown) => void): Unsubscribe {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('at', 'desc'), limit(200))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Omit<MessageRow, 'id'>) })).reverse())
  }, onError)
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

export async function sendMessage(db: Firestore, me: string, chatId: string, text: string) {
  const t = text.trim()
  if (!t || t.length > MAX_TEXT) throw new Error('invalid-message')
  const chatRef = doc(db, 'chats', chatId)
  const b = writeBatch(db)
  b.set(doc(collection(chatRef, 'messages')), { uid: me, text: t, at: serverTimestamp() })
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
/** A photo message's image, loaded once per session. */
export function loadImage(db: Firestore, chatId: string, messageId: string) {
  const k = chatId + '/' + messageId
  let p = imageCache.get(k)
  if (!p) {
    p = getDoc(doc(db, 'chats', chatId, 'media', messageId)).then(s => (s.data()?.data as string) ?? '')
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
