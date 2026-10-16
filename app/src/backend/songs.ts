import { collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, type Firestore, type Timestamp, type Unsubscribe } from 'firebase/firestore'

// Spotify: songs come from YouTube links. songs/{videoId} is the song (the doc id IS the 11-character
// video id, so a song can only be added once); songPlays/{videoId}_{listener} records that someone
// listened for a minute, and the background worker pays the song's owner 10 points for each new one.
export type Song = { id: string; title: string; uid: string; at: number; plays: number }

const ms = (t: unknown) => (t as Timestamp | null)?.toMillis?.() ?? Date.now()

/** The video id in a YouTube link (watch, youtu.be, shorts, embed, music.youtube.com, live), or null. */
export function youtubeId(input: string): string | null {
  const text = input.trim()
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

export const thumbOf = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

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
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000)
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`, { signal: ctl.signal })
    if (r.status === 400 || r.status === 401 || r.status === 403 || r.status === 404) return 'gone'
    if (!r.ok) return null
    const j = await r.json()
    return typeof j.title === 'string' && j.title.trim() ? j.title.trim().slice(0, 120) : null
  } catch { return null } finally { clearTimeout(t) }
}

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
 * Listened for a minute: records it (the rules allow one per song and person every 10 minutes and none for
 * your own songs; the worker pays the owner). A refusal just means it doesn't count, nothing to tell anyone.
 */
// (merge: the worker's own paidAt on the doc stays, so the rules see only `at` change)
export const countListen = (db: Firestore, vid: string, uid: string) =>
  setDoc(doc(db, 'songPlays', `${vid}_${uid}`), { vid, uid, at: serverTimestamp() }, { merge: true }).catch(() => {})
