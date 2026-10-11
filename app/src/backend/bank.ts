import { collection, doc, getDoc, increment, onSnapshot, orderBy, limit as fsLimit, query, serverTimestamp, setDoc, writeBatch, type Firestore, type Unsubscribe } from 'firebase/firestore'

// 은행 (bank): a savings account (dep, 연 50%, interest every week) and loans (loan, 연 10%, up to the
// limit the worker sets from the credit grade). The worker (.github/scripts/send-notifications.mjs)
// pays the interest and works out grade and limit every 15 minutes; the rules (firestore.rules:
// bankMove) only let a move happen together with its points change and its log line:
//   banks/{uid}                 dep, loan, limit, grade, gradeAt, nextAt, opened
//   banks/{uid}/log/{id}        kind (in · out · borrow · repay · int-dep · int-loan), amount, at

export type BankDoc = { dep: number; loan: number; limit: number; grade: number; gradeAt: number; nextAt: number }
export type BankKind = 'in' | 'out' | 'borrow' | 'repay'
export type BankLog = { id: string; kind: BankKind | 'int-dep' | 'int-loan'; amount: number; at: number }

export const WEEK_MS = 7 * 24 * 3600_000

/** My bank account, live (null until I open one). */
export function watchBank(db: Firestore, uid: string, cb: (b: BankDoc | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'banks', uid), s => {
    if (!s.exists()) return cb(null)
    const v = s.data()
    cb({ dep: v.dep ?? 0, loan: v.loan ?? 0, limit: v.limit ?? 0, grade: v.grade ?? 0, gradeAt: v.gradeAt ?? 0, nextAt: v.nextAt ?? 0 })
  }, () => cb(null))
}

/** The latest moves and interest, newest first. */
export function watchBankLog(db: Firestore, uid: string, cb: (rows: BankLog[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'banks', uid, 'log'), orderBy('at', 'desc'), fsLimit(30)), s => {
    cb(s.docs.map(d => {
      const v = d.data()
      return { id: d.id, kind: v.kind, amount: v.amount ?? 0, at: v.at?.toMillis?.() ?? Date.now() }
    }))
  }, () => cb([]))
}

/** Opens the account (zero balance). The first weekly interest is due a week from now. */
export async function openBank(db: Firestore, uid: string) {
  const ref = doc(db, 'banks', uid)
  if ((await getDoc(ref)).exists()) return
  await setDoc(ref, { ownerUid: uid, dep: 0, loan: 0, limit: 0, grade: 0, gradeAt: 0, nextAt: Date.now() + WEEK_MS, opened: serverTimestamp() })
}

/**
 * One move, in one batch with its log line:
 *   in      points → savings   (points spent, dep up)
 *   out     savings → points   (dep down, points bonus)
 *   borrow  loan up, points bonus (up to the limit, the rules check it)
 *   repay   points spent, loan down
 */
export async function bankMove(db: Firestore, uid: string, kind: BankKind, amount: number) {
  amount = Math.floor(amount)
  if (!(amount >= 1)) throw new Error('invalid-amount')
  const logRef = doc(collection(db, 'banks', uid, 'log'))
  const id = logRef.id
  const b = writeBatch(db)
  const bank = doc(db, 'banks', uid), cand = doc(db, 'candidates', uid)
  if (kind === 'in') b.update(bank, { dep: increment(amount) })
  else if (kind === 'out') b.update(bank, { dep: increment(-amount) })
  else if (kind === 'borrow') b.update(bank, { loan: increment(amount) })
  else b.update(bank, { loan: increment(-amount) })
  if (kind === 'in' || kind === 'repay') b.update(cand, { spent: increment(amount), lastBank: id })
  else b.update(cand, { bonus: increment(amount), lastBank: id })
  b.set(logRef, { uid, kind, amount, at: serverTimestamp() })
  await b.commit()
}
