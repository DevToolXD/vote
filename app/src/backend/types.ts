import type { ItemKind } from '../data'

/** A registered voter is also a candidate on the leaderboard — this is their combined doc, at candidates/{uid}. */
export type CandidateDoc = {
  name: string
  ownerUid: string
  up: number
  down: number
  /** Kept equal to up - down so the leaderboard query can `orderBy('score', 'desc')`. */
  score: number
  gender: string
  bio: string
  frame: string
  plate: string
  skin: string
  spent: number
  owned: Record<ItemKind, string[]>
  createdAt: unknown
}

export const DEFAULT_OWNED: Record<ItemKind, string[]> = { frame: ['none'], plate: ['none'], skin: ['none'] }

/** A voter's decision on one candidate, at votes/{voterUid}_{candidateId}. */
export type VoteDoc = {
  uid: string
  candidateId: string
  value: -1 | 0 | 1
  updatedAt: unknown
}
