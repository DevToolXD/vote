import { useSyncExternalStore } from 'react'
import type { Firestore } from 'firebase/firestore'
import { countListen, thumbOf, type Song } from './backend/songs'

// The one player of the whole app (Spotify's songs play here, whatever screen is up): YouTube's player
// (IFrame API) in a hidden element that stays on the page, a queue, and the 1-minute listen count that
// makes the song's owner earn points. Screens read it with useMusic() and call the functions below.

type YTPlayer = {
  loadVideoById(id: string): void
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  destroy(): void
}
type YTApi = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer }
declare global { interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void } }

export type MusicState = {
  queue: Song[]
  index: number
  /** idle: nothing loaded · loading: asked for, not playing yet · playing · paused */
  status: 'idle' | 'loading' | 'playing' | 'paused'
  /** who added the playing song (shown under its title) */
  artist: string
}
const IDLE: MusicState = { queue: [], index: -1, status: 'idle', artist: '' }
let state = IDLE
const subs = new Set<() => void>()
const set = (p: Partial<MusicState>) => { state = { ...state, ...p }; subs.forEach(f => f()) }

type Setup = { db: Firestore | null; uid: string | null; nameOf: (uid: string) => string; toast: (msg: string) => void }
let setup: Setup = { db: null, uid: null, nameOf: () => '', toast: () => {} }
/** The app tells the player who is signed in (for the listen count) and how to show names and messages. */
export function configureMusic(s: Setup) {
  setup = s
  // someone else's song stays; a different person signing in doesn't continue the old person's queue
  if (!s.uid && state.status !== 'idle') stopMusic()
  if (state.status !== 'idle') set({ artist: s.nameOf(state.queue[state.index]?.uid ?? '') })
}

let player: YTPlayer | null = null
let apiLoading: Promise<void> | null = null
let listened = 0, listenTimer: ReturnType<typeof setInterval> | undefined, counted = false
let guard: ReturnType<typeof setTimeout> | undefined

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiLoading) return apiLoading
  apiLoading = new Promise<void>((ok, bad) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); ok() }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => { apiLoading = null; bad(new Error('youtube')) }
    document.head.appendChild(s)
    setTimeout(() => { if (!window.YT?.Player) { apiLoading = null; bad(new Error('youtube-timeout')) } }, 15000)
  })
  return apiLoading
}

const current = () => state.queue[state.index] as Song | undefined

function startListenClock() {
  clearInterval(listenTimer)
  listenTimer = setInterval(() => {
    const song = current()
    if (state.status !== 'playing' || !song) return
    listened++
    // a minute of listening to someone else's song counts (the worker pays its owner)
    if (listened >= 60 && !counted && setup.db && setup.uid && song.uid !== setup.uid) { counted = true; countListen(setup.db, song.id, setup.uid) }
  }, 1000)
}

function mediaSession() {
  const song = current()
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession
  if (!ms || !song) return
  try {
    ms.metadata = new MediaMetadata({ title: song.title, artist: state.artist || 'Spotify', artwork: [{ src: thumbOf(song.id), sizes: '480x360', type: 'image/jpeg' }] })
    ms.setActionHandler('play', () => resumeMusic())
    ms.setActionHandler('pause', () => pauseMusic())
    ms.setActionHandler('previoustrack', () => prevMusic())
    ms.setActionHandler('nexttrack', () => nextMusic())
    ms.setActionHandler('seekto', d => { if (d.seekTime != null) seekMusic(d.seekTime) })
  } catch { /* an older browser: no lock-screen controls */ }
}

function onState(code: number) {
  // -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering · 5 cued
  clearTimeout(guard)
  if (code === 1) set({ status: 'playing' })
  else if (code === 2) set({ status: 'paused' })
  else if (code === 3 || code === -1 || code === 5) { if (state.status !== 'paused') set({ status: 'loading' }) }
  else if (code === 0) {
    if (state.index < state.queue.length - 1) nextMusic()
    else set({ status: 'paused' })
  }
}
function onError() {
  setup.toast('이 곡은 재생할 수 없어요')
  if (state.index < state.queue.length - 1) nextMusic()
  else set({ status: 'paused' })
}

async function ensurePlayer(): Promise<YTPlayer> {
  if (player) return player
  await loadApi()
  if (player) return player
  // kept on the page (not display:none: a hidden player may stop), tiny and invisible
  const host = document.createElement('div')
  host.id = 'music-host'
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:-1'
  const inner = document.createElement('div')
  host.appendChild(inner)
  document.body.appendChild(host)
  return new Promise<YTPlayer>((ok) => {
    const p = new window.YT!.Player(inner, {
      width: '2', height: '2',
      playerVars: { playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, origin: location.origin },
      events: {
        onReady: () => { player = p; ok(p) },
        onStateChange: (e: { data: number }) => onState(e.data),
        onError: () => onError(),
      },
    })
  })
}

function load(index: number) {
  const song = state.queue[index]
  if (!song) return
  listened = 0; counted = false
  set({ index, status: 'loading', artist: setup.nameOf(song.uid) })
  mediaSession()
  ensurePlayer().then(p => {
    // the song may have been changed while the player was getting ready
    if (current()?.id !== song.id) return
    p.loadVideoById(song.id)
    startListenClock()
    // started from a tap, so it should play at once; if the phone refused (no tap behind it), the
    // button shows ▶ and the next tap starts it
    clearTimeout(guard)
    guard = setTimeout(() => { if (state.status === 'loading') set({ status: 'paused' }) }, 4000)
  }).catch(() => { setup.toast('유튜브를 불러오지 못했어요. 인터넷을 확인해 주세요'); set({ status: 'paused' }) })
}

/** Plays `queue[index]`, and the ones after it when it ends. */
export function playMusic(queue: Song[], index: number) {
  if (!queue[index]) return
  state = { ...state, queue: queue.slice() }
  load(index)
}
export function resumeMusic() {
  if (!player || !current()) return
  player.playVideo()
  set({ status: 'playing' })
}
export function pauseMusic() {
  if (!player) return
  player.pauseVideo()
  set({ status: 'paused' })
}
export function toggleMusic() {
  if (state.status === 'playing' || state.status === 'loading') pauseMusic()
  else if (player && state.status === 'paused') resumeMusic()
  else if (current()) load(state.index)
}
export function nextMusic() { if (state.index < state.queue.length - 1) load(state.index + 1) }
/** Back to the start of the song, or to the one before it when it has only just begun. */
export function prevMusic() {
  if (player && player.getCurrentTime() > 3) { player.seekTo(0, true); return }
  if (state.index > 0) load(state.index - 1)
  else player?.seekTo(0, true)
}
export function seekMusic(seconds: number) { player?.seekTo(Math.max(0, seconds), true) }
/** Turns the music off and takes the circle away. */
export function stopMusic() {
  clearInterval(listenTimer); clearTimeout(guard)
  try { player?.pauseVideo() } catch { /* the player is gone */ }
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession
  try { if (ms) ms.metadata = null } catch { /* no media session */ }
  state = IDLE
  subs.forEach(f => f())
}
export const musicTime = () => ({ t: player?.getCurrentTime?.() ?? 0, d: player?.getDuration?.() ?? 0 })

export function useMusic(): MusicState {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => state)
}
