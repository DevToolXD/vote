// Web Audio snare roll and low reveal "boom", synthesised (no audio files).

let ac: AudioContext | null = null
let noiseBuf: AudioBuffer | null = null

function audio(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ac = ac || new Ctx()
    if (ac.state === 'suspended') ac.resume()
    return ac
  } catch {
    return null
  }
}

function noise(ctx: AudioContext) {
  if (!noiseBuf) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate), d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseBuf = b
  }
  return noiseBuf
}

/** Snare roll that swells over `ms`. */
export function roll(ms: number) {
  const ctx = audio()
  if (!ctx) return
  const t0 = ctx.currentTime + 0.02, n = Math.floor(ms / 52)
  for (let i = 0; i < n; i++) {
    const t = t0 + i * 0.052, v = 0.04 + 0.4 * Math.pow(i / n, 1.6)
    const s = ctx.createBufferSource()
    s.buffer = noise(ctx)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(v, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075)
    s.connect(f); f.connect(g); g.connect(ctx.destination)
    s.start(t, Math.random() * 0.5, 0.1)
    const o = ctx.createOscillator(), og = ctx.createGain()
    o.frequency.setValueAtTime(190, t)
    o.frequency.exponentialRampToValueAtTime(120, t + 0.06)
    og.gain.setValueAtTime(v * 0.5, t)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    o.connect(og); og.connect(ctx.destination)
    o.start(t); o.stop(t + 0.08)
  }
}

/** Single low "boom" for each reveal; louder for higher ranks. */
export function boom(v = 1) {
  const ctx = audio()
  if (!ctx) return
  const t = ctx.currentTime + 0.01
  const o = ctx.createOscillator(), og = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(95, t)
  o.frequency.exponentialRampToValueAtTime(48, t + 0.35)
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(0.7 * v, t + 0.008)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  o.connect(og); og.connect(ctx.destination)
  o.start(t); o.stop(t + 0.55)
}
