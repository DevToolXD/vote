import { arrayRemove, arrayUnion, collection, doc, increment, onSnapshot, query, serverTimestamp, where, writeBatch, type Firestore, type Timestamp, type Unsubscribe } from 'firebase/firestore'
import type { GiftKind } from './gifts'

// 당근마켓: sell something you own for a price you set. Listing puts it in escrow (it leaves
// your 보관함 until sold or taken down); a buyer pays, gets it, and the seller is paid — one
// batch, checked by firestore.rules (marketList / marketBuy / marketCancel / marketPayout, match /market; lastMarket / lastSale / lastCancel name the listing).

export type Listing = {
  id: string
  seller: string
  kind: GiftKind
  key: string
  price: number
  status: 'open' | 'sold' | 'cancelled'
  createdAt: Timestamp | null
  buyer?: string
}
/** Keeps the number sane to type; there's no other limit. */
export const MAX_PRICE = 1_000_000_000_000

/** Open listings, newest first. */
export function subscribeMarket(db: Firestore, cb: (rows: Listing[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'market'), where('status', '==', 'open')), s => {
    const rows = s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Listing, 'id'>) }))
    rows.sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()))
    cb(rows)
  }, () => cb([]))
}

type Me = { id: string; frame: string; plate: string; skin: string }

/** Puts one of my items up for sale (taken off me if I'm wearing it). */
export async function listItem(db: Firestore, me: Me, kind: GiftKind, key: string, price: number) {
  if (!Number.isSafeInteger(price) || price < 1 || price > MAX_PRICE) throw new Error('invalid-price')
  const ref = doc(collection(db, 'market'))
  const b = writeBatch(db)
  b.set(ref, { seller: me.id, kind, key, price, status: 'open', createdAt: serverTimestamp() })
  b.update(doc(db, 'candidates', me.id), kind === 'pass'
    ? { [key]: false, lastMarket: ref.id }
    : { [`owned.${kind}`]: arrayRemove(key), lastMarket: ref.id, ...(me[kind] === key ? { [kind]: 'none' } : {}) })
  await b.commit()
}

export async function buyListing(db: Firestore, myUid: string, l: Listing) {
  const b = writeBatch(db)
  b.update(doc(db, 'market', l.id), { status: 'sold', buyer: myUid, doneAt: serverTimestamp() })
  b.update(doc(db, 'candidates', myUid), l.kind === 'pass'
    ? { [l.key]: true, spent: increment(l.price), lastMarket: l.id }
    : { [`owned.${l.kind}`]: arrayUnion(l.key), spent: increment(l.price), lastMarket: l.id })
  b.update(doc(db, 'candidates', l.seller), { bonus: increment(l.price), lastSale: l.id })
  await b.commit()
}

/** Takes my listing down; the item comes back. */
export async function cancelListing(db: Firestore, myUid: string, l: Listing) {
  const b = writeBatch(db)
  b.update(doc(db, 'market', l.id), { status: 'cancelled', doneAt: serverTimestamp() })
  b.update(doc(db, 'candidates', myUid), l.kind === 'pass'
    ? { [l.key]: true, lastCancel: l.id }
    : { [`owned.${l.kind}`]: arrayUnion(l.key), lastCancel: l.id })
  await b.commit()
}
