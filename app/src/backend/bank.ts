import { collection, doc, getDoc, increment, onSnapshot, orderBy, limit as fsLimit, query, runTransaction, serverTimestamp, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore'

// 은행 (bank): a savings account and loans. The interest is simple and yearly: 연 50% on the savings and
// 연 10% on the loan, paid/owed a week at a time on what was put in (depBase) or borrowed (loanBase), so a
// year at 50% is +50%. The worker (.github/scripts/send-notifications.mjs) pays the weekly interest and
// works out the grade and the limit every 15 minutes. The rules (firestore.rules: bankMove, bankOpMatches)
// only let a move happen together with its points change and its log line:
//   banks/{uid}                 dep, depBase, loan, loanBase, limit, grade, gradeAt, nextAt, opened
//   banks/{uid}/log/{id}        kind (in · out · borrow · repay · int-dep · int-loan), amount, at

export type BankDoc = { dep: number; depBase: number; loan: number; loanBase: number; limit: number; grade: number; gradeAt: number; nextAt: number }
export type BankKind = 'in' | 'out' | 'borrow' | 'repay'
export type BankLog = { id: string; kind: BankKind | 'int-dep' | 'int-loan'; amount: number; at: number }

export const WEEK_MS = 7 * 24 * 3600_000

/** My bank account, live (null until I open one). */
export function watchBank(db: Firestore, uid: string, cb: (b: BankDoc | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'banks', uid), s => {
    if (!s.exists()) return cb(null)
    const v = s.data()
    cb({ dep: v.dep ?? 0, depBase: v.depBase ?? v.dep ?? 0, loan: v.loan ?? 0, loanBase: v.loanBase ?? v.loan ?? 0, limit: v.limit ?? 0, grade: v.grade ?? 0, gradeAt: v.gradeAt ?? 0, nextAt: v.nextAt ?? 0 })
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
  await setDoc(ref, { ownerUid: uid, dep: 0, depBase: 0, loan: 0, loanBase: 0, limit: 0, grade: 0, gradeAt: 0, nextAt: Date.now() + WEEK_MS, opened: serverTimestamp() })
}

/**
 * The bank's new numbers after a move (the same rules firestore.rules checks): a withdrawal or a repayment
 * takes the interest first, so the principal only drops once the balance is below it.
 */
export function movedBank(b: { dep: number; depBase: number; loan: number; loanBase: number; limit: number }, kind: BankKind, amount: number) {
  const r = { ...b }
  if (kind === 'in') { r.dep += amount; r.depBase += amount }
  else if (kind === 'out') { if (amount > b.dep) throw new Error('not-enough'); r.dep -= amount; r.depBase = Math.min(b.depBase, r.dep) }
  else if (kind === 'borrow') { if (b.loan + amount > b.limit) throw new Error('over-limit'); r.loan += amount; r.loanBase += amount }
  else { if (amount > b.loan) throw new Error('over-loan'); r.loan -= amount; r.loanBase = Math.min(b.loanBase, r.loan) }
  return r
}

/**
 * One move, in one transaction with its log line:
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
  const bank = doc(db, 'banks', uid), cand = doc(db, 'candidates', uid)
  await runTransaction(db, async tx => {
    const s = await tx.get(bank)
    if (!s.exists()) throw new Error('no-account')
    const v = s.data()
    const dep = v.dep ?? 0, loan = v.loan ?? 0
    const next = movedBank({ dep, depBase: v.depBase ?? dep, loan, loanBase: v.loanBase ?? loan, limit: v.limit ?? 0 }, kind, amount)
    tx.update(bank, { dep: next.dep, depBase: next.depBase, loan: next.loan, loanBase: next.loanBase })
    tx.update(cand, kind === 'in' || kind === 'repay' ? { spent: increment(amount), lastBank: id } : { bonus: increment(amount), lastBank: id })
    tx.set(logRef, { uid, kind, amount, at: serverTimestamp() })
  })
}
