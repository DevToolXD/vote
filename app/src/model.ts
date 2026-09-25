import type { CandidateRow } from './backend/candidates'
import type { MyVote } from './backend/types'
import { fmt } from './data'

export type Person = CandidateRow & {
  rank: number
  /** My history with this person (undefined = never voted for them). */
  my?: MyVote
  /** I can 추천 them right now (never, or 7+ days since my last 추천). */
  upReady: boolean
  /** When I can 추천 again, e.g. "3일 후" ('' when ready). */
  upWait: string
  /** I've used my one 비추천 on them. */
  downDone: boolean
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
 * `rows` is already ordered by score (the Firestore query does that). Equal scores
 * share a rank (1, 2, 2, 4 …), so a tie never shows one person above the other.
 */
export function buildPeople(rows: CandidateRow[], myVotes: Record<string, MyVote>, myUid: string | null, now = Date.now()): Person[] {
  let rank = 0
  return rows.map((d, i) => {
    const my = myVotes[d.id]
    const wait = my ? my.nextUpAt - now : 0
    if (i === 0 || d.score !== rows[i - 1].score) rank = i + 1
    return {
      ...d,
      rank,
      my,
      upReady: wait <= 0,
      upWait: waitLabel(wait),
      downDone: !!my?.down,
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
