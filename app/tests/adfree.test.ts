import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { adFreeOf, similarity, words } from '../src/backend/adfree'
import { archiveTracks, searchArchive } from '../src/backend/archive'
import { toSong } from '../src/backend/audius'
import type { Song } from '../src/backend/songs'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

test('titles are compared by their words, not by "Official MV" and brackets', () => {
  assert.deepEqual(words('IU - Love Poem (Official MV) [4K]'), ['iu', 'love', 'poem'])
  assert.equal(similarity('Lofi Girl - Snowman (Official Audio)', 'Snowman Lofi Girl'), 1)
  assert.ok(similarity('Artist - Midnight Rain [Lyrics]', 'Midnight Rain') === 0 || similarity('Artist - Midnight Rain [Lyrics]', 'Midnight Rain') >= 0.6)
  assert.equal(similarity('Dreaming', 'Dreaming'), 1)                 // one word, but the same
  assert.equal(similarity('Dreaming', 'Dreaming Again'), 0)           // one word is not enough to call it the same song
  assert.ok(similarity('Night Drive Chill Mix', 'Totally Different Song') < 0.3)
})

test('Audius: a locked or unlisted track is not a song to play; the rest becomes a song with its stream address', () => {
  assert.equal(toSong({ id: 'a', title: 'x', is_stream_gated: true }), null)
  assert.equal(toSong({ id: 'a', title: 'x', access: { stream: false } }), null)
  const s = toSong({ id: 'D7KyD', title: 'Song', user: { name: 'Maker' }, artwork: { '480x480': 'https://x/y.jpg' } })!
  assert.equal(s.id, 'au_D7KyD'); assert.equal(s.src, 'au'); assert.equal(s.artist, 'Maker')
  assert.match(s.url!, /^https:\/\/api\.audius\.co\/v1\/tracks\/D7KyD\/stream\?app_name=/)
})

test('a YouTube song with the same song on Audius is played from there; a different one is not; the answer is remembered', async () => {
  let calls = 0
  globalThis.fetch = (async (u: RequestInfo | URL) => {
    calls++
    assert.match(String(u), /tracks\/search\?query=/)
    return json({ data: [
      { id: 'zzz', title: 'Something Else Entirely', user: { name: 'Other' } },
      { id: 'abc', title: 'Snowman', user: { name: 'Lofi Girl' }, artwork: null },
    ] })
  }) as typeof fetch
  const yt: Song = { id: 'ytid0000001', title: 'Lofi Girl - Snowman (Official Audio)', uid: 'u', at: 0, plays: 0 }
  const m = await adFreeOf(yt)
  assert.equal(m?.id, 'au_abc')
  await adFreeOf(yt)
  assert.equal(calls, 1, 'asked once, then remembered')
  const none = await adFreeOf({ id: 'ytid0000002', title: '완전히 다른 노래 제목 입니다', uid: 'u', at: 0, plays: 0 })
  assert.equal(none, null)
})

test('Internet Archive: albums by name, and an album\'s mp3 files as tracks (originals only)', async () => {
  globalThis.fetch = (async (u: RequestInfo | URL) => {
    const url = String(u)
    if (url.includes('advancedsearch.php')) {
      assert.match(decodeURIComponent(url), /\(blues AND piano\) AND mediatype:\(audio\)/)
      return json({ response: { docs: [{ identifier: 'album-1', title: 'Blues Piano', creator: 'Someone' }, { identifier: 'bad id!', title: 'x' }] } })
    }
    assert.match(url, /\/metadata\/album-1$/)
    return json({ metadata: { title: 'Blues Piano' }, files: [
      { name: '01 First.mp3', source: 'original', title: 'First' }, { name: '01 First_64kb.mp3', source: 'derivative' }, { name: 'cover.jpg' }, { name: '02 Second.mp3', source: 'original' },
    ] })
  }) as typeof fetch
  const albums = await searchArchive('blues: "piano"!')
  assert.deepEqual(albums.map(a => a.id), ['album-1'])
  const tracks = await archiveTracks(albums[0])
  assert.deepEqual(tracks.map(t => t.title), ['First', '02 Second'])
  assert.equal(tracks[0].src, 'ia'); assert.equal(tracks[0].url, 'https://archive.org/download/album-1/01%20First.mp3')
})
