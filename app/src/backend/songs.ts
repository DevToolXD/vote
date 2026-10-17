import { collection, deleteDoc, doc, getDoc, increment, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, type Firestore, type Timestamp, type Unsubscribe } from 'firebase/firestore'

// Spotify: songs come from YouTube links. songs/{videoId} is the song (the doc id IS the 11-character
// video id, so a song can only be added once); songPlays/{videoId}_{listener} adds up the seconds someone
// has listened (every play, however short), and the background worker pays the song's owner 6 points for
// each full minute.
export type Song = {
  id: string; title: string; uid: string; at: number; plays: number
  /** 'au' (Audius) or 'ia' (Internet Archive): a track from an open catalogue (no YouTube, no ads, nobody earns points): played from `url`, with its own picture and artist */
  src?: 'au' | 'ia'; url?: string; art?: string; artist?: string
}
/** From an open catalogue (played in an audio element, no ads)? */
export const isOpen = (s?: Pick<Song, 'src'>) => s?.src === 'au' || s?.src === 'ia'

const ms = (t: unknown) => (t as Timestamp | null)?.toMillis?.() ?? Date.now()

/** The video id in a YouTube link (watch, youtu.be, shorts, embed, music.youtube.com, live), or null. */
export function youtubeId(input: string): string | null {
  // a shared link often comes with words around it ("제목 https://youtu.be/…"): the link is what counts
  const text = (/(?:https?:\/\/|(?:www\.|m\.|music\.)?youtu(?:\.be|be\.com))\S+/i.exec(input)?.[0] ?? input).trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text
  let u: URL
  try { u = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text) } catch { return null }
  const host = u.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, rest] = u.pathname.split('/')
    if (kind === 'watch') id = u.searchParams.get('v')
    else if (kind === 'shorts' || kind === 'embed' || kind === 'live' || kind === 'v') id = rest ?? null
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

/** The picture of a video: the small 16:9 one (about 8 KB) for lists, the big one (about 25 KB) for the lock screen. */
export const songArt = (s: Pick<Song, 'id' | 'art'>, big = false) => s.art ?? thumbOf(s.id, big)
export const thumbOf = (id: string, big = false) => `https://i.ytimg.com/vi/${id}/${big ? 'hqdefault' : 'mqdefault'}.jpg`

export function watchSongs(db: Firestore, cb: (songs: Song[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'songs'), orderBy('at', 'desc'), limit(300)), snap => {
    cb(snap.docs.map(d => {
      const v = d.data()
      return { id: d.id, title: v.title ?? d.id, uid: v.uid ?? '', at: ms(v.at), plays: v.plays ?? 0 }
    }))
  }, () => cb([]))
}

export type Adding = { ok: true; song: Song } | { ok: false; why: 'link' | 'dup' | 'gone' | 'fail'; by?: string }

/** The video's title from YouTube (null: couldn't ask; 'gone': it can't be played in a page). */
async function titleFromYoutube(id: string): Promise<string | null | 'gone'> {
  const watch = encodeURIComponent('https://www.youtube.com/watch?v=' + id)
  // YouTube's own answer first; a browser that can't read it (no CORS) gets it from noembed.com instead
  for (const url of [`https://www.youtube.com/oembed?format=json&url=${watch}`, `https://noembed.com/embed?url=${watch}`]) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000)
    try {
      const r = await fetch(url, { signal: ctl.signal })
      if (!r.ok) { if (url.includes('youtube.com') && [400, 401, 403, 404].includes(r.status)) return 'gone'; continue }
      const j = await r.json()
      if (typeof j.title === 'string' && j.title.trim()) return j.title.trim().slice(0, 120)
    } catch { /* try the next one */ } finally { clearTimeout(t) }
  }
  return null
}
export const FALLBACK_TITLE = /^YouTube 영상 /
/** A song saved without its real title gets it from the player (the rules let anyone fix such a title once). */
export const fixSongTitle = (db: Firestore, id: string, title: string) => updateDoc(doc(db, 'songs', id), { title: title.slice(0, 120) }).catch(() => {})

/** Adds a song from a YouTube link: once per video (the doc id is the video id). */
export async function addSong(db: Firestore, uid: string, link: string): Promise<Adding> {
  const id = youtubeId(link)
  if (!id) return { ok: false, why: 'link' }
  const ref = doc(db, 'songs', id)
  const old = await getDoc(ref).catch(() => null)
  if (old?.exists()) return { ok: false, why: 'dup', by: old.data().uid }
  const title = await titleFromYoutube(id)
  if (title === 'gone') return { ok: false, why: 'gone' }
  try {
    await setDoc(ref, { vid: id, title: title ?? `YouTube 영상 ${id}`, uid, plays: 0, at: serverTimestamp() })
  } catch (e) {
    // someone added it between the check and now
    if ((e as { code?: string }).code === 'permission-denied') return { ok: false, why: (await getDoc(ref).catch(() => null))?.exists() ? 'dup' : 'fail' }
    return { ok: false, why: 'fail' }
  }
  return { ok: true, song: { id, title: title ?? `YouTube 영상 ${id}`, uid, at: Date.now(), plays: 0 } }
}

export const removeSong = (db: Firestore, id: string) => deleteDoc(doc(db, 'songs', id))

/**
 * Listened for `secs` more seconds (at most 40 at a time, and the rules allow no more than real time passed and none
 * for your own songs; the worker pays the owner per full minute). True when it was saved: a refusal just means those
 * seconds don't count.
 */
// (merge: the worker's own paidMin on the doc stays, so the rules see only `at` and `secs` change)
export const countListen = (db: Firestore, vid: string, uid: string, secs: number) =>
  setDoc(doc(db, 'songPlays', `${vid}_${uid}`), { vid, uid, secs: increment(secs), at: serverTimestamp() }, { merge: true }).then(() => true, () => false)
