// Ranking order, used everywhere a rank is shown or paid (and mirrored by the worker in
// .github/scripts/send-notifications.mjs): higher score first; on the same score, whoever
// reached it first (candidates/{id}.scoreAt, set with every tally change) is ahead. So ranks
// never repeat: 1, 2, 3 … Docs from before scoreAt count as having reached it earliest.

type Rankable = { id: string; score: number; scoreAt?: { toMillis(): number } | null; sa?: number }
export const scoreAtOf = (c: Rankable) => (typeof c.sa === 'number' ? c.sa : c.scoreAt?.toMillis?.() ?? 0)
export const byRank = (a: Rankable, b: Rankable) => b.score - a.score || scoreAtOf(a) - scoreAtOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
