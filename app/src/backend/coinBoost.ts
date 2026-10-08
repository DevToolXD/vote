import { push, ref, serverTimestamp, set } from 'firebase/database'
import type { Firestore } from 'firebase/firestore'
import { R } from './messages'
import type { CoinSym } from './coins'

// 관리자: make one coin rise (or fall) over a few minutes. The request goes to coinEvents/{id};
// the price worker (.github/scripts/send-notifications.mjs) applies it and removes it. Only the
// admin can write it (database.rules.json: coinEvents); the rules keep it to ±50 % over ≤ 30 min.
export async function boostCoin(db: Firestore, sym: CoinSym, pct: number, minutes: number) {
  if (!Number.isFinite(pct) || pct === 0 || Math.abs(pct) > 50) throw new Error('invalid-pct')
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30) throw new Error('invalid-minutes')
  const id = push(ref(R(db), 'coinEvents')).key!
  await set(ref(R(db), `coinEvents/${id}`), { sym, pct, minutes, at: serverTimestamp() })
}
