import { SILVER_AVATAR, SILVER_PLATE } from './silverArt'

// 크로마틱 삼겹살: the 삼겹살 먹고싶다 art (silverArt.ts, same classes, so the same pictures) with
// white particles and a rainbow that sways over it. The rainbow is a colour wheel turning under a
// mask (transform and opacity only, so the GPU does it), and the particles are dots on turning rings.

const rnd = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647
/** An annulus mask (percent of the box's half size), as in silverArt.ts. */
const ring = (a: number, b: number) => `-webkit-mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 0.5}%,#000 ${b - 0.5}%,transparent ${b}%);mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 0.5}%,#000 ${b - 0.5}%,transparent ${b}%)`
const RAINBOW = 'conic-gradient(from 0deg,#ff5fa2,#ffd45f,#7dff9a,#5fd4ff,#9d7bff,#ff5fa2)'
const SIZE = 'max(1.4px,calc(var(--av,52px) * 0.042))'

/** A dot of light: white, glowing, twinkling (scaled by --av on the frame). */
const dot = (x: number, y: number, dur: number, delay: number, size: string) =>
  `<span class="ch-dot" style="position:absolute;left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${size};height:${size};margin:calc(${size} / -2) 0 0 calc(${size} / -2);border-radius:50%;background:#ffffff;box-shadow:0 0 3px #ffffff,0 0 6px rgba(255,255,255,0.8);animation:chTw ${dur.toFixed(2)}s ease-in-out ${delay.toFixed(2)}s infinite"></span>`

// The rainbow over the chrome band (the silver frame's ring at 83–96% of its box, inset −10%).
const RAINBOW_RING =
  `<div class="ch-glow" style="position:absolute;inset:-10%;border-radius:50%;${ring(83, 96.4)};animation:chGlow 3.2s ease-in-out infinite alternate">` +
  `<div style="position:absolute;inset:0;border-radius:50%;background:${RAINBOW};animation:avSpin 9s linear infinite"></div>` +
  `</div>`

// Particles on two rings just outside the chrome (the box is inset −20%: its half size is 70% of the frame).
const orbit = (seed: number, n: number, dur: number, reverse: boolean) => {
  const r = rnd(seed); let out = ''
  for (let i = 0; i < n; i++) {
    const a = (r() * 360) * Math.PI / 180, rr = 0.8 + r() * 0.16
    out += dot(50 + rr * 50 * Math.cos(a), 50 + rr * 50 * Math.sin(a), 1.4 + r() * 1.8, -r() * 3, SIZE)
  }
  return `<div style="position:absolute;inset:-20%;animation:avSpin ${dur}s linear infinite${reverse ? ' reverse' : ''}">${out}</div>`
}

export const CHROMA_AVATAR: { before: string; after: string } = {
  before: SILVER_AVATAR.before,
  after: SILVER_AVATAR.after + RAINBOW_RING + orbit(71, 9, 16, false) + orbit(83, 7, 26, true),
}

// Over the 이름표: a rainbow band swaying across it (below the text), then the white specks.
const PLATE_WAVE =
  `<div class="ch-sway" style="position:absolute;inset:-10% -40%;background:linear-gradient(100deg,rgba(255,95,162,0) 0%,rgba(255,95,162,0.3) 14%,rgba(255,212,95,0.34) 28%,rgba(125,255,154,0.3) 42%,rgba(95,212,255,0.34) 56%,rgba(157,123,255,0.3) 70%,rgba(255,95,162,0) 86%);mix-blend-mode:screen;animation:chSway 6s ease-in-out infinite alternate;pointer-events:none"></div>`
const PLATE_DOTS = (() => {
  const r = rnd(97); let out = ''
  for (let i = 0; i < 16; i++) out += dot(r() * 100, r() * 100, 1.6 + r() * 2, -r() * 3, '2px')
  return `<div style="position:absolute;inset:0;pointer-events:none">${out}</div>`
})()

export const CHROMA_PLATE = SILVER_PLATE + PLATE_WAVE + PLATE_DOTS
