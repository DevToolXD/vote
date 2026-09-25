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
 * `rows` is already ordered by score (the Firestore query does that). Rank is just
 * position in that order — ties keep insertion order, same as the query would.
 */
export function buildPeople(rows: CandidateRow[], myVotes: Record<string, Vote>, myUid: string | null): Person[] {
  return rows.map((d, i) => {
    const v = myVotes[d.id] || 0
    return {
      ...d,
      rank: i + 1,
      v,
      upN: d.up,
      downN: d.down,
      scoreLabel: fmt(d.score),
      upLabel: d.up.toLocaleString(),
      downLabel: d.down.toLocaleString(),
      photoCss: 'none',
      isMe: d.id === myUid,
    }
  })
}
