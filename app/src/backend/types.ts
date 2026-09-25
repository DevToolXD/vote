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
  /** Small JPEG data URL (or '' for none) — see backend/image.ts. */
  photoURL: string
  frame: string
  plate: string
  skin: string
  spent: number
  /** Points added by the admin or carried over from past seasons' recommendations. */
  bonus?: number
  /** 메시지 끄기: nobody can message them or add them to a chat. */
  msgOff?: boolean
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

export type PodiumEntry = { id: string; name: string; score: number; frame: string }
export type Season = {
  name: string
  number: number
  startedAt?: { toMillis(): number }
  /** Set by a season reset: the season that just ended and its final TOP 3. */
  last?: { name: string; top: PodiumEntry[] }
}
/** Before the admin ever names or resets a season, the app shows this one. */
export const DEFAULT_SEASON: Season = { name: 'BETA', number: 1 }
