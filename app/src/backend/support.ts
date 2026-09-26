import {
  collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch,
  type Firestore, type Timestamp, type Unsubscribe,
} from 'firebase/firestore'

// 상담: a chat between someone (often signed in anonymously because they forgot
// their password) and the admin, at support/{uid} + support/{uid}/messages.

export type SupportFrom = 'user' | 'admin'
export type Ticket = {
  id: string
  loginId: string
  name: string
  updatedAt: Timestamp | null
  last?: { from: SupportFrom; text: string; at: Timestamp | null }
  adminRead?: boolean
  userRead?: boolean
  /** Set when 상담원 presses 상담 끝내기; until then the person sees the 상담 in 계정. */
  closed?: boolean
  closedAt?: Timestamp | null
  /** The account this 상담 belongs to (set on 비밀번호 초기화), so it survives logging in. */
  accountUid?: string
}
export type SupportMessage = { id: string; from: SupportFrom; text: string; at: Timestamp | null }

export const MAX_SUPPORT_TEXT = 1000

export function subscribeTicket(db: Firestore, uid: string, cb: (t: Ticket | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'support', uid), s => cb(s.exists() ? ({ id: s.id, ...s.data({ serverTimestamps: 'estimate' }) } as Ticket) : null), () => cb(null))
}

/** 상담 linked to my account (after a password reset from 상담). */
export function subscribeLinkedTickets(db: Firestore, uid: string, cb: (t: Ticket[]) => void): Unsubscribe {
  const q = query(collection(db, 'support'), where('accountUid', '==', uid))
  return onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as Ticket))), () => cb([]))
}

/** Admin: 상담 끝내기. The person sees that it ended and can't send any more. */
export async function closeTicket(db: Firestore, ticketUid: string) {
  const ref = doc(db, 'support', ticketUid)
  const text = '상담이 끝났어요. 더 궁금한 점이 있으면 새로 상담을 시작해주세요'
  const b = writeBatch(db)
  b.update(ref, { closed: true, closedAt: serverTimestamp(), last: { from: 'admin', text, at: serverTimestamp() }, updatedAt: serverTimestamp(), adminRead: true, userRead: false })
  b.set(doc(collection(ref, 'messages')), { from: 'admin', text, at: serverTimestamp() })
  await b.commit()
}

/** Admin: ties the 상담 to an account, so its owner still sees it after logging in. */
export async function linkTicket(db: Firestore, ticketUid: string, accountUid: string) {
  await updateDoc(doc(db, 'support', ticketUid), { accountUid })
}

/** Admin: every 상담, most recent first. */
export function subscribeTickets(db: Firestore, cb: (t: Ticket[]) => void): Unsubscribe {
  const q = query(collection(db, 'support'), orderBy('updatedAt', 'desc'), limit(100))
  return onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as Ticket))), () => cb([]))
}

export function subscribeSupportMessages(db: Firestore, uid: string, cb: (m: SupportMessage[]) => void): Unsubscribe {
  const q = query(collection(db, 'support', uid, 'messages'), orderBy('at', 'asc'), limit(300))
  return onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as SupportMessage))), () => cb([]))
}

/**
 * Sends a 상담 message. The first message from a user creates the ticket (with the
 * name and login id they gave); after that it just updates the preview.
 */
export async function sendSupport(db: Firestore, ticketUid: string, from: SupportFrom, text: string, opts: { exists: boolean; name?: string; loginId?: string }) {
  const t = text.trim()
  if (!t || t.length > MAX_SUPPORT_TEXT) throw new Error('invalid-message')
  const ref = doc(db, 'support', ticketUid)
  const b = writeBatch(db)
  const last = { from, text: t.slice(0, 1000), at: serverTimestamp() }
  if (!opts.exists) {
    b.set(ref, { loginId: (opts.loginId ?? '').trim().toLowerCase().slice(0, 20), name: (opts.name ?? '').trim().slice(0, 20), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), last, adminRead: false, userRead: true })
  } else {
    b.update(ref, { last, updatedAt: serverTimestamp(), ...(from === 'user' ? { adminRead: false, userRead: true } : { adminRead: true, userRead: false }) })
  }
  b.set(doc(collection(ref, 'messages')), { from, text: t, at: serverTimestamp() })
  await b.commit()
}

export async function markSupportRead(db: Firestore, ticketUid: string, who: SupportFrom) {
  const b = writeBatch(db)
  b.update(doc(db, 'support', ticketUid), who === 'admin' ? { adminRead: true } : { userRead: true })
  await b.commit()
}
