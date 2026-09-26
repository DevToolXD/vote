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
  /** Login id (the part before @vote.local), shown on profiles. */
  loginId?: string
  /** The gift involved in this person's last 포인트 선물 step (firestore.rules checks it). */
  lastGift?: string
  /** Got the one-time 300P for opening the installed app. */
  appBonus?: boolean
  /** 메시지 끄기: nobody can message them or add them to a chat. */
  msgOff?: boolean
  owned: Record<ItemKind, string[]>
  createdAt: unknown
  /** 투표 2배권, bought once and kept (an early purchase stored the season number: also owned). */
  pass2x?: boolean | number
}

export const DEFAULT_OWNED: Record<ItemKind, string[]> = { frame: ['none'], plate: ['none'], skin: ['none'] }

/** A voter's decision on one candidate, at votes/{voterUid}_{candidateId}. */
export type VoteDoc = {
  uid: string
  candidateId: string
  /** Season `ups` belongs to; a season reset leaves the doc but it stops counting. */
  season: number
  /** 추천 / 비추천 counted this season (one vote a week, adding up). */
  ups: number
  downs: number
  /** When this week's vote was first cast; the week lasts 7 days from here. */
  weekAt: { toMillis(): number } | null
  /** This week's vote — can be changed or cancelled until the week is over. */
  weekKind: 'up' | 'down' | 'none'
  /** Votes cast this week (0 = cancelled, 2 = twice with the 투표 2배권). Older docs lack it: 1 unless 'none'. */
  weekN?: number
  updatedAt: unknown
}

export const VOTE_EVERY_MS = 7 * 24 * 60 * 60 * 1000

/** My history with one candidate, as the app needs it. */
export type WeekKind = 'up' | 'down' | 'none'
export type MyVote = { ups: number; downs: number; weekEndsAt: number; weekKind: WeekKind; weekN: number }
export const PASS_PRICE = 5000

export type PodiumEntry = { id: string; name: string; score: number; frame: string }
export type Season = {
  name: string
  number: number
  startedAt?: { toMillis(): number }
  /** When the season ends by itself (the worker pays rewards and starts the next one). */
  endsAt?: { toMillis(): number } | null
  rewards?: import('./rewards').Rewards
  /** Set by a season reset: the season that just ended and its final TOP 3. */
  last?: { name: string; top: PodiumEntry[] }
}
/** Before the admin ever names or resets a season, the app shows this one. */
export const DEFAULT_SEASON: Season = { name: 'BETA', number: 1 }
