// 삼겹살 먹고싶다 — a set (frame, 이름표, 막대 스킨) in liquid-metal silver on pure black:
// fields of silver particles drifting and flowing in waves, a turning liquid-metal ring,
// light sweeping across polished metal, and a four-point sparkle catching the light.
// Solid fills and CSS only (no SVG ids), so any number of copies can share a page.

const SILVER = ['#ffffff', '#e8e8e8', '#cfcfcf', '#a9a9a9', '#8a8a8a']
function seeded(seed: number) {
  let x = seed
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280)
}
const ring = (a: number, b: number) => `-webkit-mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b}%,transparent ${b + 1}%);mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b}%,transparent ${b + 1}%)`
/** A particle: a soft halo and a bright core. */
const dot = (x: number, y: number, r: number, c: string, op: number) =>
  `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 2.6).toFixed(2)}" fill="${c}" opacity="${(op * 0.18).toFixed(2)}"></circle><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${c}" opacity="${op.toFixed(2)}"></circle>`
/** The badge sparkle from the design, centred on 0,0 (size ≈ 20). */
export const SPARKLE_PATH = 'M0 -9.4C.55 -9.4 .88 -8.85 1.08 -7.3c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C-8.85 .88-9.4 .55-9.4 0s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C-.88 -8.85-.55 -9.4 0 -9.4Z'
const sparkle = (x: number, y: number, s: number, delay: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="${SPARKLE_PATH}" fill="#ffffff" class="sl-spark" style="transform-box:fill-box;transform-origin:center;animation:krTwinkle 2.6s ease-in-out ${delay}s infinite;opacity:0"></path></g>`
const METAL = 'conic-gradient(from 0deg,#0a0a0a,#5a5a5a 9%,#f5f5f5 15%,#8a8a8a 21%,#1a1a1a 33%,#3a3a3a 46%,#d8d8d8 54%,#ffffff 58%,#6a6a6a 64%,#0e0e0e 77%,#7a7a7a 89%,#0a0a0a)'

// ---- frame ----------------------------------------------------------------------------------
// viewBox 0–120: the photo is the circle r=50 at 60,60.
const FRAME_DUST = (() => {
  const r = seeded(7); let out = ''
  // bands of silver dust circling at different speeds and directions
  for (let band = 0; band < 4; band++) {
    let dots = ''
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, rad = 55 + band * 3.4 + r() * 5
      dots += dot(60 + Math.cos(a) * rad, 60 + Math.sin(a) * rad, 0.35 + r() * 0.75, SILVER[Math.floor(r() * SILVER.length)], 0.45 + r() * 0.55)
    }
    out += `<g class="sl-spin" style="transform-box:view-box;transform-origin:60px 60px;animation:avSpin ${(7 + band * 4.5).toFixed(1)}s linear infinite${band % 2 ? ' reverse' : ''}">${dots}</g>`
  }
  return out
})()
// particles drifting out from the ring and fading
const FRAME_EMIT = (() => {
  const r = seeded(19); let out = ''
  for (let i = 0; i < 16; i++) {
    const deg = r() * 360, dur = 2.2 + r() * 1.8
    out += `<g transform="translate(60 60) rotate(${deg.toFixed(1)}) translate(56 0)"><g class="sl-p" style="animation:krStream ${dur.toFixed(2)}s ease-out ${(-r() * dur).toFixed(2)}s infinite;--d:${(12 + r() * 12).toFixed(1)}px;opacity:0">${dot(0, 0, 0.5 + r() * 0.7, SILVER[i % SILVER.length], 1)}</g></g>`
  }
  return out
})()
export const SILVER_AVATAR: { before: string; after: string } = {
  before:
    // a dark halo so the silver reads on any background
    `<div style="position:absolute;inset:-22%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,0.85) 58%,rgba(0,0,0,0.35) 78%,transparent 100%)"></div>` +
    `<div class="sl-glow" style="position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(closest-side,transparent 62%,rgba(210,220,240,0.35) 76%,transparent 92%);animation:auraBreath 3.2s ease-in-out infinite"></div>`,
  after:
    // the liquid-metal ring, turning, with fine bright rims
    `<div class="sl-ring" style="position:absolute;inset:-12%;border-radius:50%;background:${METAL};${ring(84, 97)};animation:avSpin 6s linear infinite"></div>` +
    `<div style="position:absolute;inset:-12%;border-radius:50%;background:rgba(255,255,255,0.75);${ring(83.4, 84.4)}"></div>` +
    `<div style="position:absolute;inset:-12%;border-radius:50%;background:rgba(198,198,198,0.55);${ring(97, 98)}"></div>` +
    // light sweeping across the metal
    `<div class="sl-ring" style="position:absolute;inset:-12%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 70%,rgba(255,255,255,0.1) 80%,rgba(255,255,255,0.9) 94%,transparent 100%);${ring(84, 97)};animation:avSpin 2.4s linear infinite reverse"></div>` +
    `<svg viewBox="0 0 120 120" style="position:absolute;inset:-10%;width:120%;height:120%;overflow:visible">` +
    FRAME_DUST + FRAME_EMIT +
    sparkle(98, 14, 0.62, 0) + sparkle(14, 96, 0.46, 1.3) + sparkle(106, 100, 0.36, 0.7) +
    `</svg>`,
}

// ---- 이름표 ------------------------------------------------------------------------------------
// viewBox 320×56. Waves of silver particles flow across (each layer's pattern repeats every
// 320 units, and the layer slides 320 units, so the loop is seamless); dust twinkles over them.
function waveLayer(seed: number, cy: number, amp: number, len: number, phase: number, perX: number, spread: number, op: number, dur: number, rev: boolean) {
  const r = seeded(seed); let dots = ''
  for (let x = -320; x < 320; x += 7) {
    const t = (x / len) * Math.PI * 2 + phase, y = cy + Math.sin(t) * amp
    const depth = 0.55 + 0.45 * Math.cos(t) // nearer on the crests: bigger, brighter
    for (let k = 0; k < perX; k++) {
      dots += dot(x + (r() - 0.5) * 6, y + (r() - 0.5) * spread, (0.35 + r() * 0.7) * (0.6 + depth * 0.7), SILVER[Math.floor(r() * SILVER.length)], op * (0.4 + depth * 0.6) * (0.6 + r() * 0.4))
    }
  }
  return `<g class="sl-flow" style="animation:slFlow ${dur}s linear infinite${rev ? ' reverse' : ''}">${dots}</g>`
}
const PLATE_DUST = (() => {
  const r = seeded(41); let out = ''
  for (let i = 0; i < 26; i++) {
    const x = 60 + r() * 260, y = r() * 56
    out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="sl-p" style="transform-box:fill-box;transform-origin:center;animation:slTwinkle ${(1.6 + r() * 2.4).toFixed(2)}s ease-in-out ${(-r() * 4).toFixed(2)}s infinite">${dot(0, 0, 0.35 + r() * 0.6, SILVER[i % SILVER.length], 0.9)}</g></g>`
  }
  return out
})()
export const SILVER_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:#000">` +
  // a faint liquid-metal sheen under everything
  `<div style="position:absolute;inset:0;background:linear-gradient(105deg,#000 0%,#050505 30%,#1c1c1c 70%,#2e2e2e 100%)"></div>` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%;-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0.25) 0%,#000 45%);mask-image:linear-gradient(90deg,rgba(0,0,0,0.25) 0%,#000 45%)">` +
  waveLayer(3, 30, 13, 160, 0, 2, 5, 0.55, 14, false) +
  waveLayer(5, 27, 9, 106.67, 1.7, 1, 3, 0.9, 9, false) +
  waveLayer(9, 32, 16, 320, 3.1, 1, 8, 0.4, 22, true) +
  PLATE_DUST +
  `<text x="306" y="44" text-anchor="end" font-size="15" font-style="italic" fill="#9a9a9a" fill-opacity="0.6" style="font-family:'Instrument Serif','Times New Roman',Times,serif;letter-spacing:-0.3px">samgyeopsal.</text>` +
  sparkle(300, 15, 0.7, 0) + sparkle(252, 44, 0.42, 1.2) + sparkle(210, 12, 0.34, 2) +
  `</svg>` +
  // light sweeping across the polished metal
  `<div class="sl-sweep" style="position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(115deg,transparent 20%,rgba(255,255,255,0.28) 48%,transparent 76%);animation:krSweep 3.6s ease-in-out infinite"></div>` +
  `</div>` +
  // liquid-metal edge: a silver hairline with a light running round it
  `<div style="position:absolute;inset:0;border-radius:14px;padding:1px;overflow:hidden;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);z-index:3;pointer-events:none;background:rgba(198,198,198,0.55)">` +
  `<div class="sl-ring" style="position:absolute;left:-25%;top:50%;width:150%;padding-top:150%;margin-top:-75%;background:conic-gradient(from 0deg,transparent 0 32%,#8a8a8a 42%,#ffffff 50%,#8a8a8a 58%,transparent 68%);animation:avSpin 4s linear infinite"></div></div>`

// ---- 막대 스킨 --------------------------------------------------------------------------------
/** A 48px-tall tile of silver particles (CSS dots) that rises up the bar. */
export const PARTICLE_TILE = (() => {
  const r = seeded(83); const g: string[] = []
  for (let i = 0; i < 9; i++) {
    const x = (8 + r() * 84).toFixed(0), y = (r() * 48).toFixed(1), s = (0.6 + r() * 1.3).toFixed(2), a = (0.5 + r() * 0.5).toFixed(2)
    g.push(`radial-gradient(circle at ${x}% ${y}px,rgba(255,255,255,${a}) 0,rgba(220,225,235,${(+a * 0.5).toFixed(2)}) ${s}px,transparent ${(+s * 2.4).toFixed(2)}px)`)
  }
  return g.join(',')
})()
export const BAR_SPARKLE_SVG =
  `<svg viewBox="-16 -16 32 32" width="32" height="32" style="overflow:visible;display:block;filter:drop-shadow(0 0 3px rgba(255,255,255,0.7))">` +
  `<circle r="9" fill="rgba(220,228,245,0.22)" class="sl-glow" style="transform-box:fill-box;transform-origin:center;animation:auraBreath 1.8s ease-in-out infinite"></circle>` +
  `<g class="sl-spin" style="transform-box:fill-box;transform-origin:center;animation:slStar 3.2s ease-in-out infinite"><path d="${SPARKLE_PATH}" fill="#ffffff"></path></g>` +
  `</svg>`
