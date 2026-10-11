// Block Blast's sounds: real recordings (the ion.sound package's samples, MIT). They are decoded once
// and played through Web Audio, so two quick taps can overlap. Played from a tap or drag, which is
// when browsers (and iPhone) allow sound to start.
import tapSrc from './assets/sounds/tap.mp3'
import snapSrc from './assets/sounds/snap.mp3'
import glassSrc from './assets/sounds/glass.mp3'
import overSrc from './assets/sounds/metal_plate.mp3'

const SOUNDS = { pick: tapSrc, place: snapSrc, clear: glassSrc, over: overSrc } as const
export type Sound = keyof typeof SOUNDS

let ctx: AudioContext | null = null
const decoded: Partial<Record<Sound, Promise<AudioBuffer | null>>> = {}

function context() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
    // iPhone (Safari 16.4+): play as media, so the ring/silent switch does not mute the game
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'playback'
  }
  return ctx
}

export function playSound(name: Sound, volume = 0.7) {
  try {
    const c = context()
    if (c.state !== 'running') void c.resume() // called from a tap, so the browser lets it run
    decoded[name] ??= fetch(SOUNDS[name])
      .then(r => r.arrayBuffer())
      .then(b => c.decodeAudioData(b))
      .catch(() => null)
    void decoded[name]!.then(buf => {
      if (!buf) return
      const src = c.createBufferSource()
      const gain = c.createGain()
      src.buffer = buf
      gain.gain.value = volume
      src.connect(gain).connect(c.destination)
      src.start()
    })
  } catch { /* no Web Audio: the game goes on silently */ }
}
