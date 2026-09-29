// 삼겹살 먹고싶다 — a set (frame, 이름표, 막대 스킨) in liquid-metal silver on pure black:
// dense, fine silver particles flowing in waves and circling in bands, a turning liquid-metal
// ring, light sweeping across polished metal, and a four-point sparkle catching the light.
//
// The particle fields are drawn once into SVG images (data URIs — ids are safe inside those)
// and only those images move (CSS transforms), so there can be thousands of particles and the
// phone still only moves a few layers per frame. Everything else: solid fills and CSS only.

function seeded(seed: number) {
  let x = seed
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280)
}
/** A particle: x, y, diameter, opacity. */
type P = [number, number, number, number]
/**
 * Particles as an SVG image: each particle is a zero-length round-capped stroke (tiny, crisp);
 * they're grouped by size and opacity into a few paths; the brightest get a soft glow.
 */
function particleImage(w: number, h: number, ps: P[]) {
  const buckets = new Map<string, string[]>()
  for (const [x, y, s, a] of ps) {
    const k = `${(Math.round(s * 10) / 10).toFixed(1)}|${(Math.round(a * 10) / 10).toFixed(1)}`
    const list = buckets.get(k) ?? []
    list.push(`M${x.toFixed(1)} ${y.toFixed(1)}h0`)
    buckets.set(k, list)
  }
  let body = ''
  for (const [k, ds] of buckets) {
    const [s, a] = k.split('|')
    if (+a <= 0) continue
    body += `<path d='${ds.join('')}' stroke='#fff' stroke-opacity='${a}' stroke-width='${s}' stroke-linecap='round' fill='none'${+a >= 0.7 ? " filter='url(#g)'" : ''}/>`
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'><defs><filter id='g' x='-100%' y='-100%' width='300%' height='300%'><feGaussianBlur stdDeviation='0.7' result='b'/><feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge></filter></defs>${body}</svg>`
  // single-quoted (it also goes inside HTML style="…" attributes), so escape the SVG's own quotes
  return `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}')`
}
const gauss = (r: () => number) => r() + r() + r() - 1.5
/** Keeps a particle that crosses a tile's edge showing on the other side too (seamless tiles). */
function wrapX(ps: P[], w: number): P[] {
  const out: P[] = []
  for (const p of ps) {
    const x = ((p[0] % w) + w) % w
    out.push([x, p[1], p[2], p[3]])
    if (x < 3) out.push([x + w, p[1], p[2], p[3]])
    if (x > w - 3) out.push([x - w, p[1], p[2], p[3]])
  }
  return out
}

const ring = (a: number, b: number) => `-webkit-mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b}%,transparent ${b + 1}%);mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b}%,transparent ${b + 1}%)`
/** The badge sparkle from the design, centred on 0,0 (size ≈ 20). */
export const SPARKLE_PATH = 'M0 -9.4C.55 -9.4 .88 -8.85 1.08 -7.3c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C-8.85 .88-9.4 .55-9.4 0s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C-.88 -8.85-.55 -9.4 0 -9.4Z'
const sparkle = (x: number, y: number, s: number, delay: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="${SPARKLE_PATH}" fill="#ffffff" class="sl-spark" style="transform-box:fill-box;transform-origin:center;animation:krTwinkle 2.6s ease-in-out ${delay}s infinite;opacity:0"></path></g>`
const METAL = 'conic-gradient(from 0deg,#0a0a0a,#5a5a5a 9%,#f5f5f5 15%,#8a8a8a 21%,#1a1a1a 33%,#3a3a3a 46%,#d8d8d8 54%,#ffffff 58%,#6a6a6a 64%,#0e0e0e 77%,#7a7a7a 89%,#0a0a0a)'

// ---- frame ----------------------------------------------------------------------------------
// Particle bands: 160×160 images centred on the photo (radius 50 of those units), each turning.
function bandImage(seed: number, n: number, r0: number, r1: number, s0: number, s1: number, a0: number, a1: number) {
  const r = seeded(seed), ps: P[] = []
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rad = r0 + (r1 - r0) * Math.abs(gauss(r)) / 1.5
    // brighter on one side, like light catching a stream
    const lit = 0.55 + 0.45 * Math.cos(a - 0.8)
    ps.push([80 + Math.cos(a) * rad, 80 + Math.sin(a) * rad, s0 + (s1 - s0) * r(), (a0 + (a1 - a0) * r()) * lit])
  }
  return particleImage(160, 160, ps)
}
const BANDS: [string, number, boolean][] = [
  [bandImage(7, 420, 52, 60, 0.35, 1.0, 0.45, 1), 9, false],
  [bandImage(13, 320, 56, 68, 0.3, 0.9, 0.3, 0.9), 14, true],
  [bandImage(17, 220, 62, 78, 0.25, 0.8, 0.15, 0.65), 23, false],
]
// sparks drifting out from the ring and fading (a few, individually)
const FRAME_EMIT = (() => {
  const r = seeded(19); let out = ''
  for (let i = 0; i < 22; i++) {
    const deg = r() * 360, dur = 2 + r() * 2, s = 0.45 + r() * 0.6
    out += `<g transform="translate(60 60) rotate(${deg.toFixed(1)}) translate(55 0)"><g class="sl-p" style="animation:krStream ${dur.toFixed(2)}s ease-out ${(-r() * dur).toFixed(2)}s infinite;--d:${(10 + r() * 14).toFixed(1)}px;opacity:0"><circle r="${(s * 2.4).toFixed(2)}" fill="#e8ecf5" opacity="0.16"></circle><circle r="${s.toFixed(2)}" fill="#ffffff"></circle></g></g>`
  }
  return out
})()
export const SILVER_AVATAR: { before: string; after: string } = {
  before:
    // a dark halo so the silver reads on any background
    `<div style="position:absolute;inset:-24%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,0.88) 56%,rgba(0,0,0,0.4) 78%,transparent 100%)"></div>` +
    `<div class="sl-glow" style="position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(closest-side,transparent 60%,rgba(215,224,242,0.32) 76%,transparent 92%);animation:auraBreath 3.2s ease-in-out infinite"></div>`,
  after:
    // particle bands circling (behind the metal ring, spilling past it)
    BANDS.map(([img, dur, rev]) => `<div class="sl-spin" style="position:absolute;inset:-30%;background:${img} center/100% 100% no-repeat;animation:avSpin ${dur}s linear infinite${rev ? ' reverse' : ''}"></div>`).join('') +
    // the liquid-metal ring, turning, with fine bright rims
    `<div class="sl-ring" style="position:absolute;inset:-12%;border-radius:50%;background:${METAL};${ring(85, 96)};animation:avSpin 6s linear infinite"></div>` +
    `<div style="position:absolute;inset:-12%;border-radius:50%;background:rgba(255,255,255,0.8);${ring(84.4, 85.2)}"></div>` +
    `<div style="position:absolute;inset:-12%;border-radius:50%;background:rgba(198,198,198,0.6);${ring(96, 96.8)}"></div>` +
    // light sweeping across the metal
    `<div class="sl-ring" style="position:absolute;inset:-12%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 70%,rgba(255,255,255,0.1) 80%,rgba(255,255,255,0.95) 94%,transparent 100%);${ring(85, 96)};animation:avSpin 2.4s linear infinite reverse"></div>` +
    `<svg viewBox="0 0 120 120" style="position:absolute;inset:-10%;width:120%;height:120%;overflow:visible">` +
    FRAME_EMIT +
    sparkle(98, 14, 0.62, 0) + sparkle(14, 96, 0.46, 1.3) + sparkle(106, 100, 0.36, 0.7) + sparkle(20, 16, 0.3, 1.9) +
    `</svg>`,
}

// ---- 이름표 ------------------------------------------------------------------------------------
// Wave tiles are 320×56 and repeat sideways; each layer slides exactly one tile, so the loop is
// seamless. The tile's width on screen is (plate height) × 320/56 — container units work it out.
function waveImage(seed: number, o: { cy: number; amp: number; len: number; phase: number; step: number; per: number; spread: number; s: [number, number]; a: number }) {
  const r = seeded(seed), ps: P[] = []
  for (let x = 0; x < 320; x += o.step) {
    const t = (x / o.len) * Math.PI * 2 + o.phase, y = o.cy + Math.sin(t) * o.amp
    const depth = 0.5 + 0.5 * Math.cos(t) // nearer on the crests: bigger, brighter
    for (let k = 0; k < o.per; k++) {
      const g = gauss(r)
      ps.push([x + (r() - 0.5) * o.step * 2, y + g * o.spread, (o.s[0] + (o.s[1] - o.s[0]) * r()) * (0.65 + depth * 0.6), o.a * (0.35 + depth * 0.65) * (1 - Math.min(0.7, Math.abs(g) * 0.45)) * (0.6 + r() * 0.4)])
    }
  }
  return particleImage(320, 56, wrapX(ps, 320))
}
function dustImage(seed: number, n: number) {
  const r = seeded(seed), ps: P[] = []
  for (let i = 0; i < n; i++) ps.push([r() * 320, r() * 56, 0.25 + r() * 0.45, 0.15 + r() * 0.5])
  return particleImage(320, 56, wrapX(ps, 320))
}
const WAVES: [string, number, boolean, number][] = [
  // image, seconds per tile, reversed, opacity
  [dustImage(61, 320), 40, false, 0.9],
  [waveImage(3, { cy: 30, amp: 13, len: 160, phase: 0, step: 1.4, per: 3, spread: 5.5, s: [0.35, 1.05], a: 1 }), 14, false, 1],
  [waveImage(5, { cy: 26, amp: 8, len: 106.67, phase: 1.7, step: 1.8, per: 2, spread: 3, s: [0.3, 0.9], a: 0.95 }), 9, false, 1],
  [waveImage(9, { cy: 32, amp: 17, len: 320, phase: 3.1, step: 2, per: 2, spread: 10, s: [0.25, 0.8], a: 0.6 }), 24, true, 1],
]
const PLATE_DUST = (() => {
  const r = seeded(41); let out = ''
  for (let i = 0; i < 30; i++) {
    const x = 70 + r() * 250, y = r() * 56, s = 0.35 + r() * 0.5
    out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="sl-p" style="transform-box:fill-box;transform-origin:center;animation:slTwinkle ${(1.6 + r() * 2.4).toFixed(2)}s ease-in-out ${(-r() * 4).toFixed(2)}s infinite"><circle r="${(s * 2.6).toFixed(2)}" fill="#e8ecf5" opacity="0.14"></circle><circle r="${s.toFixed(2)}" fill="#ffffff"></circle></g></g>`
  }
  return out
})()
export const SILVER_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:#000">` +
  // a faint liquid-metal sheen under everything
  `<div style="position:absolute;inset:0;background:linear-gradient(105deg,#000 0%,#040404 30%,#181818 70%,#2a2a2a 100%)"></div>` +
  // the particle waves (dimmer toward the name on the left)
  `<div style="position:absolute;inset:0;container-type:size;-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0.3) 0%,#000 45%);mask-image:linear-gradient(90deg,rgba(0,0,0,0.3) 0%,#000 45%)">` +
  WAVES.map(([img, dur, rev, op]) => `<div class="sl-flow" style="--tw:calc(100cqh * 5.7143);position:absolute;top:0;bottom:0;left:calc(-1 * var(--tw));width:calc(100% + var(--tw));background:${img} left top/auto 100% repeat-x;opacity:${op};will-change:transform;animation:slFlowT ${dur}s linear infinite${rev ? ' reverse' : ''}"></div>`).join('') +
  `</div>` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%">` +
  PLATE_DUST +
  `<text x="308" y="50" text-anchor="end" font-size="10.5" font-style="italic" fill="#9a9a9a" fill-opacity="0.6" style="font-family:'Instrument Serif','Times New Roman',Times,serif;letter-spacing:-0.3px">samgyeopsal.</text>` +
  sparkle(300, 15, 0.7, 0) + sparkle(252, 44, 0.42, 1.2) + sparkle(210, 12, 0.34, 2) + sparkle(170, 40, 0.28, 0.6) +
  `</svg>` +
  // light sweeping across the polished metal
  `<div class="sl-sweep" style="position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(115deg,transparent 20%,rgba(255,255,255,0.26) 48%,transparent 76%);animation:krSweep 3.6s ease-in-out infinite"></div>` +
  `</div>` +
  // liquid-metal edge: a silver hairline with a light running round it
  `<div style="position:absolute;inset:0;border-radius:14px;padding:1px;overflow:hidden;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);z-index:3;pointer-events:none;background:rgba(198,198,198,0.55)">` +
  `<div class="sl-ring" style="position:absolute;left:-25%;top:50%;width:150%;padding-top:150%;margin-top:-75%;background:conic-gradient(from 0deg,transparent 0 32%,#8a8a8a 42%,#ffffff 50%,#8a8a8a 58%,transparent 68%);animation:avSpin 4s linear infinite"></div></div>`

// ---- 막대 스킨 --------------------------------------------------------------------------------
/** 32×48 tiles of fine silver particles that rise up the bar (dense and fine; sparse and larger). */
function riseImage(seed: number, n: number, s: [number, number], a: [number, number]) {
  const r = seeded(seed), ps: P[] = []
  for (let i = 0; i < n; i++) ps.push([2 + r() * 28, r() * 48, s[0] + (s[1] - s[0]) * r(), a[0] + (a[1] - a[0]) * r()])
  // seamless top/bottom
  const out: P[] = []
  for (const p of ps) { out.push(p); if (p[1] < 3) out.push([p[0], p[1] + 48, p[2], p[3]]); if (p[1] > 45) out.push([p[0], p[1] - 48, p[2], p[3]]) }
  return particleImage(32, 48, out)
}
export const RISE_FINE = riseImage(83, 70, [0.3, 0.85], [0.35, 1])
export const RISE_BIG = riseImage(89, 14, [0.8, 1.6], [0.5, 1])
export const BAR_SPARKLE_SVG =
  `<svg viewBox="-16 -16 32 32" width="32" height="32" style="overflow:visible;display:block;filter:drop-shadow(0 0 3px rgba(255,255,255,0.7))">` +
  `<circle r="9" fill="rgba(220,228,245,0.22)" class="sl-glow" style="transform-box:fill-box;transform-origin:center;animation:auraBreath 1.8s ease-in-out infinite"></circle>` +
  `<g class="sl-spin" style="transform-box:fill-box;transform-origin:center;animation:slStar 3.2s ease-in-out infinite"><path d="${SPARKLE_PATH}" fill="#ffffff"></path></g>` +
  `</svg>`
