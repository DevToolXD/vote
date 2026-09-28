import {
  arrayUnion, collection, doc, increment, onSnapshot, runTransaction, serverTimestamp, writeBatch,
  type Firestore, type Timestamp, type Unsubscribe,
} from 'firebase/firestore'
import { postGift, type ChatRow } from './messages'
import { FRAMES, SKINS, priceOf, type ItemKind } from '../data'

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
  /** 아이템 선물: the item given (amount = its shop price, held from the sender). */
  itemKind?: ItemKind
  itemKey?: string
}

const KIND_LABEL: Record<ItemKind, string> = { frame: '프레임', plate: '이름표', skin: '막대 스킨' }
/** "매트릭스 프레임", "왕관 이름표" … */
export const itemLabel = (kind: ItemKind, key: string) => `${((kind === 'skin' ? SKINS : FRAMES).find(([k]) => k === key)?.[1] ?? key)} ${KIND_LABEL[kind]}`
/** No real limit (only what you have); this just keeps the number sane to type. */
export const MAX_GIFT = 1_000_000_000_000

export async function sendGift(db: Firestore, me: string, chat: ChatRow, amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_GIFT) throw new Error('invalid-amount')
  const giftRef = doc(collection(db, 'gifts'))
  const to = chat.type === 'dm' ? chat.members.find(m => m !== me) ?? null : null
  const b = writeBatch(db)
  b.set(giftRef, { chatId: chat.id, from: me, to, amount, status: 'open', createdAt: serverTimestamp() })
  b.update(doc(db, 'candidates', me), { spent: increment(amount), lastGift: giftRef.id })
  await b.commit()
  // The card in the chat (Realtime Database); retried a few times, since the points are already held.
  const text = `🎁 ${amount.toLocaleString()}P 선물`
  for (let i = 0; ; i++) {
    try { await postGift(db, me, chat.id, giftRef.id, text); break } catch (e) { if (i >= 2) throw e; await new Promise(r => setTimeout(r, 800 * (i + 1))) }
  }
}

/** 아이템 선물: holds the item's price like a 포인트 선물; whoever takes it gets the item, 취소 refunds the points. */
export async function sendItemGift(db: Firestore, me: string, chat: ChatRow, kind: ItemKind, key: string) {
  const amount = priceOf(kind, key)
  if (key === 'none' || amount < 1) throw new Error('invalid-item')
  const giftRef = doc(collection(db, 'gifts'))
  const to = chat.type === 'dm' ? chat.members.find(m => m !== me) ?? null : null
  const b = writeBatch(db)
  b.set(giftRef, { chatId: chat.id, from: me, to, amount, status: 'open', createdAt: serverTimestamp(), itemKind: kind, itemKey: key })
  b.update(doc(db, 'candidates', me), { spent: increment(amount), lastGift: giftRef.id })
  await b.commit()
  const text = `🎁 ${itemLabel(kind, key)} 선물`
  for (let i = 0; ; i++) {
    try { await postGift(db, me, chat.id, giftRef.id, text); break } catch (e) { if (i >= 2) throw e; await new Promise(r => setTimeout(r, 800 * (i + 1))) }
  }
}
/** What taking a gift changes on my candidate doc: points, or the item. */
const claimPatch = (g: Gift, giftId: string) => (g.itemKind && g.itemKey
  ? { [`owned.${g.itemKind}`]: arrayUnion(g.itemKey), lastGift: giftId }
  : { bonus: increment(g.amount), lastGift: giftId })

// Latest server state of each gift a chat is showing (see subscribeGift), so 받기 / 취소
// can write straight away; the rules re-check the gift is still open at commit time.
const seen = new Map<string, Gift>()

/**
 * 받기 — first come first served in a group; throws 'gift-gone' if someone was faster
 * or it was cancelled. Writes directly when the gift is on screen (no reads, works even
 * when the day's read quota is used up); falls back to a transaction otherwise.
 */
export async function claimGift(db: Firestore, me: string, giftId: string, myOwned?: Record<ItemKind, string[]>) {
  const ref = doc(db, 'gifts', giftId)
  const g = seen.get(giftId)
  if (g?.itemKind && g.itemKey && myOwned?.[g.itemKind]?.includes(g.itemKey)) throw new Error('already-owned')
  if (g && g.status === 'open' && g.from !== me && (!g.to || g.to === me)) {
    try {
      const b = writeBatch(db)
      b.update(ref, { status: 'claimed', claimedBy: me, doneAt: serverTimestamp() })
      b.update(doc(db, 'candidates', me), claimPatch(g, giftId))
      await b.commit()
      return
    } catch { /* taken meanwhile, or out of date: check below */ }
  }
  await runTransaction(db, async tx => {
    const g = (await tx.get(ref)).data() as Gift | undefined
    if (!g || g.status !== 'open') throw new Error('gift-gone')
    if (g.from === me || (g.to && g.to !== me)) throw new Error('gift-not-yours')
    if (g.itemKind && g.itemKey) {
      const mine = (await tx.get(doc(db, 'candidates', me))).data() as { owned?: Record<string, string[]> } | undefined
      if (mine?.owned?.[g.itemKind]?.includes(g.itemKey)) throw new Error('already-owned')
    }
    tx.update(ref, { status: 'claimed', claimedBy: me, doneAt: serverTimestamp() })
    tx.update(doc(db, 'candidates', me), claimPatch(g, giftId))
  })
}

/** 취소 — only while nobody has taken it; the points come back. */
export async function cancelGift(db: Firestore, me: string, giftId: string) {
  const ref = doc(db, 'gifts', giftId)
  const g = seen.get(giftId)
  if (g && g.status === 'open' && g.from === me) {
    try {
      const b = writeBatch(db)
      b.update(ref, { status: 'cancelled', doneAt: serverTimestamp() })
      b.update(doc(db, 'candidates', me), { spent: increment(-g.amount), lastGift: giftId })
      await b.commit()
      return
    } catch { /* taken meanwhile, or out of date: check below */ }
  }
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
    stop = onSnapshot(doc(db, 'gifts', id), s => {
      if (!s.exists()) return
      const g = { id: s.id, ...s.data() } as Gift
      if (!s.metadata.hasPendingWrites && !s.metadata.fromCache) seen.set(id, g); else seen.delete(id)
      cb(g)
    }, () => {
      if (tries++ < 5) timer = setTimeout(listen, 800 * tries)
    })
  }
  listen()
  return () => { clearTimeout(timer); stop() }
}
