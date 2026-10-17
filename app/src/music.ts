import { useSyncExternalStore } from 'react'
import type { Firestore } from 'firebase/firestore'
import { FALLBACK_TITLE, countListen, fixSongTitle, songArt, type Song } from './backend/songs'

// The one player of the whole app (Spotify's songs play here, whatever screen is up): YouTube's player
// (IFrame API) in a hidden element that stays on the page, a queue, and the listen count that
// makes the song's owner earn points (6 for every minute heard). Screens read it with useMusic() and call the functions below.

type YTPlayer = {
  loadVideoById(id: string): void
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState?(): number
  mute?(): void
  unMute?(): void
  /** (not in the documented API, but YouTube's player has it: 1 while an ad plays) */
  getAdState?(): number
  getVideoData?(): { title?: string; video_id?: string }
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
  /** YouTube is playing an ad: the sound is off, nothing is counted, and the circle shows it is loading */
  ad: boolean
}
const IDLE: MusicState = { queue: [], index: -1, status: 'idle', artist: '', ad: false }
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
let listenTimer: ReturnType<typeof setInterval> | undefined, lastTick = 0
// Listening time not yet sent, per song (every second of someone else's song counts, replays too, so ten
// seconds here and a minute there add up): sent every ~15 s, and when the music stops, pauses or changes.
const owed = new Map<string, number>()
let flushing = false
let guard: ReturnType<typeof setTimeout> | undefined
// Ads YouTube puts before a song: muted and shown as loading, and their time doesn't count towards anyone's points
let mutedByUs = false, adSince = 0, adGaveUp = false
function adPlaying(): boolean {
  const song = current()
  if (!player || !song) return false
  try {
    if (player.getAdState?.() === 1) return true
    const id = player.getVideoData?.().video_id
    return !!id && id !== song.id
  } catch { return false }
}
function checkAd() {
  if (isAu() || !player || state.status === 'idle' || state.status === 'paused' || adGaveUp) return
  let ad = adPlaying()
  // never stay silent for good because of a wrong guess: after 90 s it is treated as the song
  if (ad && adSince && Date.now() - adSince > 90_000) { ad = false; adGaveUp = true }
  if (ad && !state.ad) {
    adSince = Date.now()
    try { player.mute?.(); mutedByUs = true } catch { /* no mute */ }
    set({ ad: true, status: 'loading' })
  } else if (!ad && state.ad) {
    adSince = 0
    if (mutedByUs) { try { player.unMute?.() } catch { /* */ } mutedByUs = false }
    set({ ad: false, status: player.getPlayerState?.() === 1 ? 'playing' : 'loading' })
  }
}

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

// Songs from Audius play in a plain audio element (no YouTube, so no ads): the same queue, controls and lock-screen buttons.
let audio: HTMLAudioElement | null = null
const isAu = () => current()?.src === 'au'
function ensureAudio(): HTMLAudioElement {
  if (audio) return audio
  const a = new Audio()
  a.preload = 'auto'
  a.setAttribute('playsinline', '')
  a.addEventListener('playing', () => { if (isAu()) set({ status: 'playing' }) })
  a.addEventListener('pause', () => { if (isAu() && !a.ended && state.status === 'playing') set({ status: 'paused' }) })
  a.addEventListener('waiting', () => { if (isAu() && state.status === 'playing') set({ status: 'loading' }) })
  a.addEventListener('ended', () => {
    if (!isAu()) return
    if (state.index < state.queue.length - 1) nextMusic()
    else set({ status: 'paused' })
  })
  a.addEventListener('error', () => { if (isAu() && a.src) onError() })
  audio = a
  return a
}

const FLUSH_EVERY = 15, MAX_OWED = 150
async function flushListen(all = false) {
  if (flushing || !setup.db || !setup.uid) return
  flushing = true
  try {
    for (const [id, ms] of [...owed]) {
      const secs = Math.min(Math.floor(ms / 1000), 40)
      if (secs < (all ? 1 : FLUSH_EVERY)) continue
      owed.set(id, ms - secs * 1000)
      const ok = await countListen(setup.db, id, setup.uid, secs)
      // too soon after the last one (the rules want 5 s between): try again with the next flush
      if (!ok) owed.set(id, Math.min((owed.get(id) ?? 0) + secs * 1000, MAX_OWED * 1000))
    }
  } finally { flushing = false }
}
function startListenClock() {
  clearInterval(listenTimer)
  lastTick = Date.now()
  listenTimer = setInterval(() => {
    const now = Date.now(), dt = Math.min(now - lastTick, 2500)
    lastTick = now
    const song = current()
    if (state.status !== 'playing' || !song || !song.uid || song.src === 'au' || !setup.uid || song.uid === setup.uid) return
    owed.set(song.id, (owed.get(song.id) ?? 0) + dt)
    if ((owed.get(song.id) ?? 0) >= FLUSH_EVERY * 1000) flushListen()
  }, 1000)
}
// what is owed also goes out when the page is left
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushListen(true) })
  window.addEventListener('pagehide', () => { flushListen(true) })
}

function mediaSession() {
  const song = current()
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession
  if (!ms || !song) return
  try {
    ms.metadata = new MediaMetadata({ title: song.title, artist: state.artist || 'Spotify', artwork: [{ src: songArt(song, true), sizes: '480x360', type: 'image/jpeg' }] })
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
  if (code === 1 || code === 3) checkAd()
  if (state.ad && code !== 0 && code !== 2) return   // an ad: stays 'loading' until the song itself starts
  if (code === 1) {
    set({ status: 'playing' })
    // a song added while YouTube couldn't tell its title: now the player knows it
    const song = current(), title = player?.getVideoData?.().title?.trim()
    if (song && title && FALLBACK_TITLE.test(song.title) && setup.db) {
      fixSongTitle(setup.db, song.id, title)
      state = { ...state, queue: state.queue.map(q => (q.id === song.id ? { ...q, title } : q)) }
      subs.forEach(f => f())
    }
  }
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
      // youtube.com itself (not the no-cookie address): the person's own YouTube login is used, so Premium (no ads) counts
      playerVars: { playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, origin: location.origin },
      events: {
        onReady: () => { player = p; setInterval(checkAd, 500); ok(p) },
        onStateChange: (e: { data: number }) => onState(e.data),
        onError: () => onError(),
      },
    })
  })
}

function load(index: number) {
  const song = state.queue[index]
  if (!song) return
  flushListen(true)
  if (mutedByUs) { try { player?.unMute?.() } catch { /* */ } mutedByUs = false }
  adSince = 0; adGaveUp = false
  set({ index, status: 'loading', artist: song.src === 'au' ? (song.artist ?? 'Audius') : setup.nameOf(song.uid), ad: false })
  mediaSession()
  if (song.src === 'au') {
    // from Audius: stop the YouTube player, play the audio file
    try { player?.pauseVideo() } catch { /* the player is gone */ }
    clearTimeout(guard)
    const a = ensureAudio()
    a.src = song.url ?? ''
    a.play().catch(() => { if (current()?.id === song.id) set({ status: 'paused' }) })
    return
  }
  audio?.pause()
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
  if (isAu()) { audio?.play().catch(() => {}); set({ status: 'playing' }); return }
  if (!player || !current()) return
  player.playVideo()
  set({ status: state.ad ? 'loading' : 'playing' })
}
export function pauseMusic() {
  if (isAu()) { audio?.pause(); set({ status: 'paused' }); return }
  if (!player) return
  player.pauseVideo()
  set({ status: 'paused' })
  flushListen(true)
}
export function toggleMusic() {
  if (state.status === 'playing' || state.status === 'loading') pauseMusic()
  else if ((isAu() ? audio : player) && state.status === 'paused') resumeMusic()
  else if (current()) load(state.index)
}
export function nextMusic() { if (state.index < state.queue.length - 1) load(state.index + 1) }
/** Back to the start of the song, or to the one before it when it has only just begun. */
export function prevMusic() {
  if (isAu() && audio && audio.currentTime > 3) { audio.currentTime = 0; return }
  if (!isAu() && player && player.getCurrentTime() > 3) { player.seekTo(0, true); return }
  if (state.index > 0) load(state.index - 1)
  else if (isAu() && audio) audio.currentTime = 0
  else player?.seekTo(0, true)
}
export function seekMusic(seconds: number) {
  if (isAu()) { if (audio) audio.currentTime = Math.max(0, seconds); return }
  player?.seekTo(Math.max(0, seconds), true)
}
/** Turns the music off and takes the circle away. */
export function stopMusic() {
  flushListen(true)
  clearInterval(listenTimer); clearTimeout(guard)
  try { player?.pauseVideo() } catch { /* the player is gone */ }
  audio?.pause()
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession
  try { if (ms) ms.metadata = null } catch { /* no media session */ }
  if (mutedByUs) { try { player?.unMute?.() } catch { /* */ } mutedByUs = false }
  state = IDLE
  subs.forEach(f => f())
}
export const musicTime = () => {
  if (isAu()) return { t: audio?.currentTime ?? 0, d: Number.isFinite(audio?.duration) ? audio!.duration : 0 }
  return { t: player?.getCurrentTime?.() ?? 0, d: player?.getDuration?.() ?? 0 }
}

export function useMusic(): MusicState {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => state)
}
