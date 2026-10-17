import type { Song } from './songs'

// Audius (audius.co): independent artists' music through their open API. It streams from its own servers, so there is no
// YouTube player and no ad before a song, for anyone, without a subscription. The catalogue is what artists put on Audius
// (not the big labels' charts). A track is played by an audio element straight from `${API}/tracks/{id}/stream`
// (that address answers with a redirect to the audio file).
const API = 'https://api.audius.co/v1'
const APP = 'popular_vote'

type Raw = {
  id?: string; title?: string; duration?: number; is_streamable?: boolean; is_stream_gated?: boolean; is_delete?: boolean; is_unlisted?: boolean
  access?: { stream?: boolean }; user?: { name?: string; handle?: string }; artwork?: Record<string, string> | null
}

/** One track of the API's answer as a Song the player can queue (null: it can't be streamed freely). */
export function toSong(t: Raw): Song | null {
  if (!t.id || !t.title) return null
  if (t.is_streamable === false || t.is_stream_gated || t.is_delete || t.is_unlisted || t.access?.stream === false) return null
  const art = t.artwork?.['480x480'] ?? t.artwork?.['150x150'] ?? t.artwork?.['1000x1000']
  return {
    id: 'au_' + t.id, title: t.title.slice(0, 120), uid: '', at: 0, plays: 0, src: 'au',
    url: `${API}/tracks/${encodeURIComponent(t.id)}/stream?app_name=${APP}`, art, artist: t.user?.name ?? t.user?.handle ?? 'Audius',
  }
}

async function list(path: string): Promise<Song[]> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000)
  try {
    const r = await fetch(`${API}${path}${path.includes('?') ? '&' : '?'}app_name=${APP}`, { signal: ctl.signal })
    if (!r.ok) throw new Error('audius ' + r.status)
    const j = await r.json() as { data?: Raw[] }
    return (j.data ?? []).map(toSong).filter((s): s is Song => !!s)
  } finally { clearTimeout(timer) }
}

export const searchAudius = (q: string, limit = 20) => list(`/tracks/search?query=${encodeURIComponent(q)}&limit=${limit}`)
export const trendingAudius = (limit = 20) => list(`/tracks/trending?limit=${limit}`)
