import type { CandidateRow } from './backend/candidates'
import type { MyVote, WeekKind } from './backend/types'
import { fmt } from './data'
import { byRank } from './backend/rank'

export type Person = CandidateRow & {
  rank: number
  /** My history with this person (undefined = never voted for them). */
  my?: MyVote
  /** This week's vote for them ('none' = not voted this week, or cancelled). */
  weekKind: WeekKind
  /** How many votes this week (0–2; 2 only with the 투표 2배권). */
  weekN: number
  /** A week is running (I voted in the last 7 days): I can switch/cancel until it ends. */
  inWeek: boolean
  /** Time left in this week, e.g. "3일" ('' when no week is running). */
  weekLeft: string
  upN: number
  downN: number
  scoreLabel: string
  upLabel: string
  downLabel: string
  photoCss: string
  isMe: boolean
}

/** "3일 후" / "5시간 후" / "곧" */
export function waitLabel(ms: number) {
  if (ms <= 0) return ''
  const h = ms / 3_600_000
  return h >= 24 ? `${Math.ceil(h / 24)}일 후` : h >= 1 ? `${Math.ceil(h)}시간 후` : '곧'
}

/**
 * Ranks never repeat: higher score first, and on the same score whoever reached it first
 * (see backend/rank.ts) — so there is exactly one 1st, 2nd and 3rd.
 */
export function buildPeople(rows: CandidateRow[], myVotes: Record<string, MyVote>, myUid: string | null, now = Date.now()): Person[] {
  return [...rows].sort(byRank).map((d, i) => {
    const my = myVotes[d.id]
    const left = my ? my.weekEndsAt - now : 0
    return {
      ...d,
      rank: i + 1,
      my,
      weekKind: left > 0 ? my?.weekKind ?? 'none' : 'none',
      weekN: left > 0 ? my?.weekN ?? 0 : 0,
      inWeek: left > 0,
      weekLeft: waitLabel(left).replace(/ 후$/, ''),
      upN: d.up,
      downN: d.down,
      scoreLabel: fmt(d.score),
      upLabel: d.up.toLocaleString(),
      downLabel: d.down.toLocaleString(),
      photoCss: d.photoURL ? `url(${d.photoURL})` : 'none',
      isMe: d.id === myUid,
    }
  })
}
