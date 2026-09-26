import {
  collection, doc, increment, onSnapshot, runTransaction, serverTimestamp, writeBatch,
  type Firestore, type Timestamp, type Unsubscribe,
} from 'firebase/firestore'
import type { ChatRow } from './messages'

// 포인트 선물 in chats. Sending holds the points (spent += amount); in a 1:1 only
// the other person can take it, in a group the first member to tap does; the
// sender can cancel until then and gets the points back. firestore.rules checks
// every step (see giftSend / giftClaim / giftCancel and match /gifts).

export type Gift = {
  id: string
  chatId: string
  from: string
  to: string | null
  amount: number
  status: 'open' | 'claimed' | 'cancelled'
  claimedBy?: string
  createdAt: Timestamp | null
}
export const MAX_GIFT = 100000

export async function sendGift(db: Firestore, me: string, chat: ChatRow, amount: number) {
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GIFT) throw new Error('invalid-amount')
  const giftRef = doc(collection(db, 'gifts'))
  const chatRef = doc(db, 'chats', chat.id)
  const to = chat.type === 'dm' ? chat.members.find(m => m !== me) ?? null : null
  const text = `🎁 ${amount.toLocaleString()}P 선물`
  const b = writeBatch(db)
  b.set(giftRef, { chatId: chat.id, from: me, to, amount, status: 'open', createdAt: serverTimestamp() })
  b.update(doc(db, 'candidates', me), { spent: increment(amount), lastGift: giftRef.id })
  b.set(doc(collection(chatRef, 'messages')), { uid: me, text, kind: 'gift', giftId: giftRef.id, at: serverTimestamp() })
  b.update(chatRef, { last: { text, uid: me, at: serverTimestamp() }, updatedAt: serverTimestamp(), [`reads.${me}`]: serverTimestamp() })
  await b.commit()
}

/** 받기 — first come first served in a group; throws 'gift-gone' if someone was faster or it was cancelled. */
export async function claimGift(db: Firestore, me: string, giftId: string) {
  const ref = doc(db, 'gifts', giftId)
  await runTransaction(db, async tx => {
    const g = (await tx.get(ref)).data() as Gift | undefined
    if (!g || g.status !== 'open') throw new Error('gift-gone')
    if (g.from === me || (g.to && g.to !== me)) throw new Error('gift-not-yours')
    tx.update(ref, { status: 'claimed', claimedBy: me, doneAt: serverTimestamp() })
    tx.update(doc(db, 'candidates', me), { bonus: increment(g.amount), lastGift: giftId })
  })
}

/** 취소 — only while nobody has taken it; the points come back. */
export async function cancelGift(db: Firestore, me: string, giftId: string) {
  const ref = doc(db, 'gifts', giftId)
  await runTransaction(db, async tx => {
    const g = (await tx.get(ref)).data() as Gift | undefined
    if (!g || g.status !== 'open') throw new Error('gift-gone')
    if (g.from !== me) throw new Error('gift-not-yours')
    tx.update(ref, { status: 'cancelled', doneAt: serverTimestamp() })
    tx.update(doc(db, 'candidates', me), { spent: increment(-g.amount), lastGift: giftId })
  })
}

/** Watches one gift; if the listener is refused (e.g. a brief race), it retries. */
export function subscribeGift(db: Firestore, id: string, cb: (g: Gift | null) => void): Unsubscribe {
  let stop: Unsubscribe = () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  let tries = 0
  const listen = () => {
    stop = onSnapshot(doc(db, 'gifts', id), s => { if (s.exists()) cb({ id: s.id, ...s.data() } as Gift) }, () => {
      if (tries++ < 5) timer = setTimeout(listen, 800 * tries)
    })
  }
  listen()
  return () => { clearTimeout(timer); stop() }
}
