import type { Post } from './posts'

// 인스타그램 알고리즘: the order the feed, 검색 and 릴스 show the photos in. It is worked out on the phone from
// the photos it has (no server): newer photos first, people whose photos I heart a lot come up more, people whose
// photos I keep passing by come up less, and a photo that has been posted before is shown 96% less.

/** A photo's fingerprint: its length and a few thousand characters spread over it (the same file gives the same one). */
export function photoKey(photo: string): string {
  const step = Math.max(1, Math.floor(photo.length / 4000))
  let h = 2166136261
  for (let i = 0; i < photo.length; i += step) h = Math.imul(h ^ photo.charCodeAt(i), 16777619)
  for (let i = Math.max(0, photo.length - 96); i < photo.length; i++) h = Math.imul(h ^ photo.charCodeAt(i), 16777619)
  return `${photo.length}:${(h >>> 0).toString(36)}`
}

/** What a photo that was posted before is worth: 4% (96% less shown). */
export const REPOST_WEIGHT = 0.04

export type Ranked = { post: Post; score: number; repost: boolean; affinity: number }

/** The photos in the order to show them, best first. `me` is whose taste it is (null: nobody's, only freshness counts). */
export function rankPosts(posts: Post[], me: string | null, now = Date.now()): Ranked[] {
  // the first photo with a fingerprint is the original; later ones with the same fingerprint are reposts
  const first = new Map<string, string>()
  for (const p of [...posts].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))) {
    const k = photoKey(p.photo)
    if (!first.has(k)) first.set(k, p.id)
  }
  // my taste: per person, the share of their photos I have hearted
  const seen = new Map<string, { n: number; h: number }>()
  for (const p of posts) {
    const s = seen.get(p.uid) ?? { n: 0, h: 0 }
    s.n++
    if (me && p.likes.includes(me)) s.h++
    seen.set(p.uid, s)
  }
  return posts.map(post => {
    const s = seen.get(post.uid)!
    // hearts given / photos seen, smoothed so one photo says little: 0 (never) … 1 (always)
    const affinity = me && post.uid !== me ? (s.h + 0.3) / (s.n + 1) : 0.3
    const ageH = Math.max(0, (now - post.at) / 3_600_000)
    const fresh = Math.pow(0.5, ageH / 36)
    const person = 0.45 + 1.8 * affinity
    const crowd = 1 + 0.25 * Math.log2(1 + post.likes.length)
    const repost = first.get(photoKey(post.photo)) !== post.id
    return { post, affinity, repost, score: fresh * person * crowd * (repost ? REPOST_WEIGHT : 1) }
  }).sort((a, b) => b.score - a.score || b.post.at - a.post.at)
}
