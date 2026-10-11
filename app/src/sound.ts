// Block Blast's sounds: real recordings (the ion.sound package's samples, MIT). A few players per
// sound, so two quick taps can overlap. Played from a tap or drag, so iPhone allows them.
import tapSrc from './assets/sounds/tap.mp3'
import snapSrc from './assets/sounds/snap.mp3'
import glassSrc from './assets/sounds/glass.mp3'
import overSrc from './assets/sounds/metal_plate.mp3'

const SOUNDS = { pick: tapSrc, place: snapSrc, clear: glassSrc, over: overSrc } as const
export type Sound = keyof typeof SOUNDS

const pools: Partial<Record<Sound, HTMLAudioElement[]>> = {}

export function playSound(name: Sound, volume = 0.7) {
  try {
    const list = pools[name] ?? (pools[name] = Array.from({ length: 3 }, () => new Audio(SOUNDS[name])))
    const a = list.find(x => x.paused || x.ended) ?? list[0]
    a.volume = volume
    a.currentTime = 0
    void a.play().catch(() => { /* blocked or no audio: the game goes on silently */ })
  } catch { /* no audio support */ }
}
