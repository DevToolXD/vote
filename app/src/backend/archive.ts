import type { Song } from './songs'

// Internet Archive (archive.org): a huge free library of music that is in the public domain or shared by its makers (netlabels,
// live recordings, old records). It needs no key and no account, and a track is a plain mp3 file, so there is no player
// and no ad. A search finds albums (items); one album's mp3 files are its tracks.
const SITE = 'https://archive.org'

type Hit = { identifier?: string; title?: string | string[]; creator?: string | string[] }
export type Album = { id: string; title: string; artist: string }
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

async function getJson<T>(url: string): Promise<T> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok) throw new Error('archive ' + r.status)
    return await r.json() as T
  } finally { clearTimeout(timer) }
}

/** Albums that match `q` (the most downloaded first). */
export async function searchArchive(q: string, rows = 12): Promise<Album[]> {
  // plain words only: a query operator typed in would change what is asked
  const words = q.replace(/["()\[\]{}:\\^~*?!+\-|&]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 6)
  if (!words.length) return []
  const query = `(${words.join(' AND ')}) AND mediatype:(audio)`
  const u = `${SITE}/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&sort[]=downloads+desc&rows=${rows}&page=1&output=json`
  const j = await getJson<{ response?: { docs?: Hit[] } }>(u)
  return (j.response?.docs ?? []).filter(d => d.identifier && /^[A-Za-z0-9._-]+$/.test(d.identifier)).map(d => ({ id: d.identifier!, title: one(d.title).slice(0, 120) || d.identifier!, artist: one(d.creator).slice(0, 80) }))
}

type File = { name?: string; format?: string; title?: string; length?: string; creator?: string; source?: string }
/** An album's tracks: its mp3 files, in the album's own order (up to 60). */
export async function archiveTracks(album: Album): Promise<Song[]> {
  const j = await getJson<{ files?: File[]; metadata?: { title?: string | string[]; creator?: string | string[] } }>(`${SITE}/metadata/${encodeURIComponent(album.id)}`)
  const mp3 = (j.files ?? []).filter(f => f.name && /\.mp3$/i.test(f.name) && !/^_/.test(f.name) && f.source !== 'derivative-sample')
  // a "VBR MP3" copy made from another file would play the same song twice: only the original mp3s, or the derived ones when there are none
  const originals = mp3.filter(f => f.source === 'original')
  const files = (originals.length ? originals : mp3).slice(0, 60)
  const artist = album.artist || one(j.metadata?.creator)
  return files.map((f, i) => ({
    id: `ia_${album.id}_${i}`.slice(0, 80), title: (f.title || f.name!.replace(/\.mp3$/i, '').replace(/[_]+/g, ' ')).slice(0, 120), uid: '', at: 0, plays: 0, src: 'ia' as const,
    url: `${SITE}/download/${encodeURIComponent(album.id)}/${f.name!.split('/').map(encodeURIComponent).join('/')}`,
    art: `${SITE}/services/img/${encodeURIComponent(album.id)}`, artist: f.creator || artist || '인터넷 아카이브',
  }))
}
