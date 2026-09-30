import { collection, doc, getDoc, increment, serverTimestamp, writeBatch, type Firestore, type Timestamp } from 'firebase/firestore'

// 몰래 도박장: bet any amount; 1 bet in 2 pays back double. The points leave together with
// the bet doc; the result comes from the server time the bet landed (firestore.rules:
// gambleBet / gamblePay / match /gambles — betWon), so it's settled before anyone can see it.

export type Bet = { id: string; amount: number; won: boolean; paid: boolean }
type BetDoc = { uid: string; amount: number; at: Timestamp | null; paid: boolean }

/** Same test as betWon() in firestore.rules. */
const won = (at: Timestamp) => at.toMillis() % 100 < 37

async function readBet(db: Firestore, id: string): Promise<Bet | null> {
  const s = await getDoc(doc(db, 'gambles', id))
  const d = s.data() as BetDoc | undefined
  if (!d?.at) return null
  return { id, amount: d.amount, won: won(d.at), paid: d.paid }
}

async function pay(db: Firestore, me: string, bet: Bet) {
  const b = writeBatch(db)
  b.update(doc(db, 'gambles', bet.id), { paid: true })
  b.update(doc(db, 'candidates', me), { bonus: increment(bet.amount * 2), payBet: bet.id })
  await b.commit()
}

/** Places a bet and settles it: returns the bet, already paid out when it won. */
export async function placeBet(db: Firestore, me: string, amount: number): Promise<Bet> {
  if (!Number.isFinite(amount) || amount < 1) throw new Error('invalid-amount')
  const ref = doc(collection(db, 'gambles'))
  const b = writeBatch(db)
  b.set(ref, { uid: me, amount, at: serverTimestamp(), paid: false })
  b.update(doc(db, 'candidates', me), { spent: increment(amount), lastBet: ref.id })
  await b.commit()
  const bet = await readBet(db, ref.id)
  if (!bet) throw new Error('bet-missing')
  if (bet.won) { await pay(db, me, bet); bet.paid = true }
  return bet
}

/** A won bet that wasn't paid out (the app closed or the network dropped right after it): pays it now. */
export async function settleLastBet(db: Firestore, me: string, lastBet: string | undefined): Promise<Bet | null> {
  if (!lastBet) return null
  const bet = await readBet(db, lastBet)
  if (!bet || !bet.won || bet.paid) return null
  await pay(db, me, bet)
  return { ...bet, paid: true }
}
