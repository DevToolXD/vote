import type { CandidateRow } from './backend/candidates'
import { fmt, type Vote } from './data'

export type Person = CandidateRow & {
  rank: number
  v: Vote
  upN: number
  downN: number
  scoreLabel: string
  upLabel: string
  downLabel: string
  photoCss: string
  isMe: boolean
}

/**
 * `rows` is already ordered by score (the Firestore query does that). Equal scores
 * share a rank (1, 2, 2, 4 …), so a tie never shows one person above the other.
 */
export function buildPeople(rows: CandidateRow[], myVotes: Record<string, Vote>, myUid: string | null): Person[] {
  let rank = 0
  return rows.map((d, i) => {
    const v = myVotes[d.id] || 0
    if (i === 0 || d.score !== rows[i - 1].score) rank = i + 1
    return {
      ...d,
      rank,
      v,
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
