// Season rewards. The same rules are applied by the background worker when a
// season ends on its own (.github/scripts/send-notifications.mjs → endSeason) —
// keep the two in step.

import { byRank } from './rank'

export type Rewards = { first: number; second: number; third: number; top6: number; participant: number }
export const DEFAULT_REWARDS: Rewards = { first: 500, second: 300, third: 150, top6: 90, participant: 50 }

export type RewardRow = { id: string; name: string; rank: number; points: number }

/**
 * Ranks in leaderboard order (see rank.ts: same score → who reached it first is ahead, so
 * ranks never repeat). Ranks 1–3 get first/second/third,
 * 4–6 get top6; everyone who took part this season (got or cast a vote) also gets
 * `participant` on top.
 */
export function computeRewards(cands: { id: string; name: string; score: number; up: number; down: number; scoreAt?: { toMillis(): number } | null }[], voters: Set<string>, r: Rewards): RewardRow[] {
  const sorted = [...cands].sort(byRank)
  return sorted.map((c, i) => {
    const rank = i + 1
    const place = rank === 1 ? r.first : rank === 2 ? r.second : rank === 3 ? r.third : rank <= 6 ? r.top6 : 0
    const took = c.up + c.down > 0 || voters.has(c.id)
    return { id: c.id, name: c.name, rank, points: place + (took ? r.participant : 0) }
  })
}

/** The 보상 공지 text, filled in from the current season. */
export function rewardNotice(seasonName: string, r: Rewards, endsAt: number | null) {
  const when = endsAt ? new Date(endsAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null
  return {
    title: `시즌 ${seasonName} 보상 안내`,
    body: [
      when ? `시즌 ${seasonName}은 ${when}에 끝나요.` : `시즌 ${seasonName}이 끝나면 보상을 드려요.`,
      '',
      `🥇 1등 ${r.first.toLocaleString()}P`,
      `🥈 2등 ${r.second.toLocaleString()}P`,
      `🥉 3등 ${r.third.toLocaleString()}P`,
      `4~6등 ${r.top6.toLocaleString()}P`,
      `시즌에 참여한 모든 사람 ${r.participant.toLocaleString()}P`,
      '',
      '같은 점수면 그 점수에 먼저 도달한 사람이 앞 등수예요. 참여 보상은 등수 보상과 따로 더해져요.',
      '보상은 시즌이 끝나면 자동으로 지급돼요.',
    ].join('\n'),
  }
}
