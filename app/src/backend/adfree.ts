import { searchAudius } from './audius'
import type { Song } from './songs'

// 광고 없는 버전: a song added from a YouTube link plays through YouTube (which puts its ads before it). When the same song is on
// Audius (a free catalogue with no ads), that one is played instead: the title is matched, and only a close match counts.
// It is looked for once per song and remembered on the device (also "none found", for a week).

const ON = 'adfree-on', CACHE = 'adfree-cache-v1', KEEP_MS = 7 * 24 * 3600_000, MIN_SCORE = 0.75

export const adFreeOn = () => { try { return localStorage.getItem(ON) !== '0' } catch { return true } }
export const setAdFree = (on: boolean) => { try { localStorage.setItem(ON, on ? '1' : '0') } catch { /* no storage */ } }

const NOISE = /\b(official|mv|m\/v|music video|video|audio|lyrics?|lyric video|hd|4k|hq|live|performance|visualizer|teaser|ver\.?|version|remaster(ed)?|feat\.?|ft\.?|prod\.?)\b|가사|뮤직비디오|공식|라이브|음원/gi
/** A title as words only: the brackets, "Official MV" and the like are dropped. */
export function words(title: string): string[] {
  return title.toLowerCase()
    .replace(/[\[(【「『].*?[\])】」』]/g, ' ')
    .replace(NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter(w => w.length > 0 && !/^\d{1,2}$/.test(w))
}
/** How alike two titles are (0–1): the share of their words they have in common; one-word titles only match when they are the same. */
export function similarity(a: string, b: string): number {
  const A = new Set(words(a)), B = new Set(words(b))
  if (!A.size || !B.size) return 0
  let hit = 0
  for (const w of A) if (B.has(w)) hit++
  if (A.size === B.size && hit === A.size) return 1
  if (Math.min(A.size, B.size) < 2) return 0
  return hit / (A.size + B.size - hit)
}

type Entry = { at: number; song: Song | null }
const mem = new Map<string, Entry>()
const load = (): Record<string, Entry> => { try { return JSON.parse(localStorage.getItem(CACHE) ?? '{}') } catch { return {} } }
const save = (vid: string, e: Entry) => {
  try { const all = load(); all[vid] = e; const keys = Object.keys(all); if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete all[k]; localStorage.setItem(CACHE, JSON.stringify(all)) } catch { /* no storage */ }
}

/** The ad-free version of a YouTube song, or null (none found, or it can't be asked). */
export async function adFreeOf(song: Song): Promise<Song | null> {
  const hit = mem.get(song.id) ?? load()[song.id]
  if (hit && Date.now() - hit.at < KEEP_MS) { mem.set(song.id, hit); return hit.song }
  const q = words(song.title).slice(0, 8).join(' ')
  if (q.length < 3) return null
  try {
    const found = await searchAudius(q, 10)
    let best: Song | null = null, bestScore = 0
    for (const f of found) {
      const sc = Math.max(similarity(song.title, f.title), similarity(song.title, `${f.artist ?? ''} ${f.title}`), similarity(song.title, `${f.title} ${f.artist ?? ''}`))
      if (sc > bestScore) { best = f; bestScore = sc }
    }
    const e: Entry = { at: Date.now(), song: best && bestScore >= MIN_SCORE ? best : null }
    mem.set(song.id, e); save(song.id, e)
    return e.song
  } catch {
    return null  // not remembered: asked again next time
  }
}
