// 삼겹살 먹고싶다 — the 2500P 레전드 set (frame, 이름표, 막대 스킨): liquid chrome and silver
// stardust on pure black.
//  · frame: a thick chrome ring whose reflections flow like liquid metal, two tilted rings of
//    stardust orbiting it (behind the photo, then round in front of it), black smoke curling round
//    it with silver wisps, lens glints flashing on the metal, grains flung off into the air.
//  · 이름표: a silver particle film — a sheet of silk made of countless grains of light folding
//    into a bright crest, light running along it, a dark dune in front, bokeh and loose specks,
//    film grain and glints — in a polished chrome bezel, with the name in chrome.
//  · 막대: chrome rails round a black glass channel with the silk flowing up inside, a double
//    helix of stardust winding up round it, a lens flare on its tip.
//
// How: the first time an item of the set is shown, the surfaces are painted into canvases — tens of
// thousands of grains added up with 'lighter' blending over soft glows, smoke from fractal noise —
// and turned into image URLs in one stylesheet (classes sl-i*). The markup below only names those
// classes; its layers turn, sway, flow and flash with CSS transforms and opacity (the GPU runs all
// of it), so nothing is painted per frame, however many grains there are.

type Ctx = CanvasRenderingContext2D
const TAU = Math.PI * 2

/** mulberry32: small, fast and without the lattice a plain LCG leaves (it shows as woven lines). */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const angDiff = (a: number, b: number) => { const d = ((a - b) % TAU + TAU) % TAU; return d > Math.PI ? TAU - d : d }
/** ≈ normal(0, 1): four uniforms added up. */
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732
/** Smooth curve through key points (cosine easing between them). */
function keys(pts: [number, number][]) {
  return (x: number) => {
    if (x <= pts[0][0]) return pts[0][1]
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i]
      if (x <= x1) { const [x0, y0] = pts[i - 1]; const t = (x - x0) / (x1 - x0); return y0 + (y1 - y0) * (1 - Math.cos(t * Math.PI)) / 2 }
    }
    return pts[pts.length - 1][1]
  }
}

// ---- canvas toolkit --------------------------------------------------------------------------
function mk(w: number, h: number) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }
const ctx2 = (c: HTMLCanvasElement) => c.getContext('2d') as Ctx
/** A cheap blur that works everywhere: scale down in two steps, then back up with smoothing. */
function soften(src: HTMLCanvasElement, down: number) {
  let cur = src
  const f = Math.sqrt(down)
  for (let i = 0; i < 2; i++) {
    const n = mk(cur.width / f, cur.height / f), x = ctx2(n)
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, n.width, n.height); cur = n
  }
  const out = mk(src.width, src.height), o = ctx2(out)
  o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high'; o.drawImage(cur, 0, 0, out.width, out.height)
  return out
}
function dotAt(x: Ctx, X: number, Y: number, s: number) {
  if (s < 1.8) x.fillRect(X - s / 2, Y - s / 2, s, s)
  else { x.beginPath(); x.arc(X, Y, s / 2, 0, TAU); x.fill() }
}
/** A bright bead in a soft halo (a grain catching the light). */
function bead(x: Ctx, X: number, Y: number, rad: number, a = 1) {
  const g = x.createRadialGradient(X, Y, 0, X, Y, rad)
  g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); g.addColorStop(0.16, `rgba(242,246,255,${0.5 * a})`); g.addColorStop(1, 'rgba(220,228,250,0)')
  x.fillStyle = g; x.beginPath(); x.arc(X, Y, rad, 0, TAU); x.fill()
}
const tick = () => new Promise(r => setTimeout(r, 0))

// ---- sheets of silk (이름표, 막대) ----------------------------------------------------------------
type Pt = (t: number, v: number) => [number, number]
type Light = (t: number, v: number) => number
/**
 * A sheet of silk: a band along x (or y) with a centre line, a half-width and a light function
 * over (t, v) — t along the band, v across it from −1 to 1.
 */
type Band = { t0: number; t1: number; c: (t: number) => number; h: (t: number) => number; L: Light; vertical?: boolean }
const bandPt = (b: Band): Pt => (t, v) => { const a = b.c(t) + v * b.h(t); return b.vertical ? [a, t] : [t, a] }

/** Paints a sheet's light as soft quads (blurred afterwards: the seams vanish). */
function glowSheet(x: Ctx, pt: Pt, L: Light, t0: number, t1: number, K: number, oy: number, steps: number, strips: number) {
  x.save(); x.fillStyle = '#fff'
  const dt = (t1 - t0) / steps
  for (let i = 0; i < steps; i++) {
    const ta = t0 + i * dt, tb = ta + dt * 1.2
    for (let j = 0; j < strips; j++) {
      const va = -1 + (2 * j) / strips, vb = va + (2 / strips) * 1.15
      const l = L(ta + dt / 2, (va + vb) / 2)
      if (l <= 0.01) continue
      x.globalAlpha = Math.min(1, l)
      const p = [pt(ta, va), pt(tb, va), pt(tb, vb), pt(ta, vb)]
      x.beginPath(); x.moveTo(p[0][0] * K, (p[0][1] + oy) * K)
      for (let k = 1; k < 4; k++) x.lineTo(p[k][0] * K, (p[k][1] + oy) * K)
      x.closePath(); x.fill()
    }
  }
  x.restore()
}
/**
 * Grains on a sheet: sampled evenly over its area, kept more often where it's bright, and each
 * brighter where the light is — added up ('lighter'), they become the luminous, grainy surface.
 */
async function grainSheet(x: Ctx, pt: Pt, L: Light, h: (t: number) => number, hmax: number, t0: number, t1: number, n: number, K: number, oy: number, r: () => number, o: { size: [number, number]; gamma: number; alpha: number }) {
  x.save(); x.fillStyle = '#fff'; x.globalCompositeOperation = 'lighter'
  let drawn = 0, tries = 0
  while (drawn < n && tries < n * 14) {
    tries++
    const t = t0 + (t1 - t0) * r()
    if (r() * hmax > h(t)) continue
    const v = r() * 2 - 1, l = L(t, v)
    if (l <= 0 || r() > Math.pow(l, o.gamma)) continue
    const [px, py] = pt(t, v)
    x.globalAlpha = Math.min(1, o.alpha * (0.3 + 0.7 * l) * (0.35 + 0.65 * r()))
    dotAt(x, px * K, (py + oy) * K, (o.size[0] + (o.size[1] - o.size[0]) * Math.pow(r(), 3)) * K)
    // a break every couple of thousand grains, so a slow phone never stalls on it
    if (++drawn % 2000 === 0) { x.restore(); await tick(); x.save(); x.fillStyle = '#fff'; x.globalCompositeOperation = 'lighter' }
  }
  x.restore()
}
/** Loose specks; a few with a soft halo. `keep` (0..1) thins them out by place. */
function specks(x: Ctx, n: number, W: number, H: number, K: number, r: () => number, o: { size: [number, number]; alpha: [number, number]; halo: number; keep?: (px: number, py: number) => number }) {
  x.save(); x.fillStyle = '#fff'; x.globalCompositeOperation = 'lighter'
  for (let i = 0; i < n; i++) {
    const px = r() * W, py = r() * H
    if (o.keep && r() > o.keep(px, py)) continue
    const s = (o.size[0] + (o.size[1] - o.size[0]) * Math.pow(r(), 2.4)) * K
    const a = o.alpha[0] + (o.alpha[1] - o.alpha[0]) * r()
    if (r() < o.halo) { x.globalAlpha = a * 0.16; x.beginPath(); x.arc(px * K, py * K, s * 2.8, 0, TAU); x.fill() }
    x.globalAlpha = a
    dotAt(x, px * K, py * K, s)
  }
  x.restore()
}
/**
 * The soft light under the grains: a body (the sheet's light, contrast raised by `pow`) and a
 * wide bloom from only its brightest parts (the crest glows, overexposed).
 */
function sheetLight(dst: Ctx, pt: Pt, L: Light, t0: number, t1: number, K: number, oy: number, steps: number, strips: number, o: { body: number; bloom: number; down: [number, number]; pow: [number, number] }) {
  // it's blurred anyway: painted at a quarter of the size, then scaled up
  const q = 4, W = dst.canvas.width, H = dst.canvas.height
  const body = mk(W / q, H / q), bloom = mk(W / q, H / q)
  glowSheet(ctx2(body), pt, (t, v) => L(t, v) ** o.pow[0], t0, t1, K / q, oy, steps, strips)
  glowSheet(ctx2(bloom), pt, (t, v) => L(t, v) ** o.pow[1], t0, t1, K / q, oy, steps, strips)
  dst.save(); dst.globalCompositeOperation = 'lighter'; dst.imageSmoothingEnabled = true; dst.imageSmoothingQuality = 'high'
  dst.globalAlpha = o.bloom; dst.drawImage(soften(bloom, Math.max(1, o.down[1] / q)), 0, 0, W, H)
  dst.globalAlpha = o.body; dst.drawImage(soften(body, Math.max(1, o.down[0] / q)), 0, 0, W, H)
  dst.restore()
}
function toUrl(c: HTMLCanvasElement): Promise<string> {
  return new Promise(res => {
    try { c.toBlob(b => res(b ? URL.createObjectURL(b) : c.toDataURL()), 'image/webp', 0.9) } catch { res(c.toDataURL()) }
  })
}

// ---- 이름표 (canvas units 368×80: the plate plus a margin all round, so it can sway) --------------
const PW = 368, PH = 80, PK = 5
// A: the bright sheet — thin from the upper left, widening into a broad surface on the right,
// crossed by a diagonal fold of light (the brightest thing on the plate)
const aC = keys([[-6, 12], [110, 15], [190, 24], [245, 33], [300, 34], [374, 32]])
const aH = keys([[-6, 9], [110, 8], [190, 12], [245, 19], [300, 23], [374, 27]])
const A: Band = {
  t0: -6, t1: 374, c: aC, h: aH,
  L: (t, v) => {
    const y = aC(t) + v * aH(t)
    const d = t - (240 + 1.15 * (y - 34))                            // across the fold line
    const fold = 1 * Math.exp(-((d / 10) ** 2)) + 0.36 * Math.exp(-((d / 36) ** 2))
    const base = 0.09 + 0.09 * (1 - Math.abs(v))
    const rim = 0.24 * Math.exp(-(((v - 0.86) / 0.17) ** 2)) * smooth(270, 330, t) + 0.1 * Math.exp(-(((v + 0.9) / 0.15) ** 2))
    return Math.min(1, (base + fold + rim) * (1 - smooth(0.8, 1, Math.abs(v))))
  },
}
// C: a thin, sharp ribbon of light arcing up behind the sheet (depth: a second fold further back)
const cC = keys([[60, 70], [150, 58], [230, 44], [300, 22], [374, 6]])
const C: Band = {
  t0: 60, t1: 374, c: cC, h: () => 2.6,
  L: (t, v) => (0.3 + 0.7 * Math.exp(-(((t - 262) / 40) ** 2))) * smooth(60, 140, t) * (1 - smooth(0.6, 1, Math.abs(v))),
}
// B: the dark dune in front, low on the right, its top edge faintly lit
const duneTop = (t: number) => 52 + 30 * ((t - 300) / 100) ** 2
const B: Band = {
  t0: 190, t1: 374,
  c: t => (duneTop(t) + 86) / 2,
  h: t => (86 - duneTop(t)) / 2,
  L: (t, v) => (0.08 + 0.5 * Math.exp(-(((v + 1) / 0.14) ** 2)) + 0.07 * (1 - (v + 1) / 2)) * smooth(190, 230, t),
}
const FLOW_W = 92 // flow tile, units wide (× PH tall), repeats sideways

async function paintPlate() {
  const aPt = bandPt(A), bPt = bandPt(B), cPt = bandPt(C)
  // A: the bright sheet (and the ribbon behind it)
  const a = mk(PW * PK, PH * PK), ax = ctx2(a)
  sheetLight(ax, cPt, C.L, C.t0, C.t1, PK, 0, 200, 4, { body: 0.35, bloom: 0.5, down: [6, 60], pow: [1.2, 2.2] })
  await grainSheet(ax, cPt, C.L, C.h, 2.6, C.t0, C.t1, 2600, PK, 0, seeded(2), { size: [0.22, 0.6], gamma: 0.6, alpha: 0.8 })
  sheetLight(ax, aPt, A.L, A.t0, A.t1, PK, 0, 300, 12, { body: 0.55, bloom: 1, down: [12, 100], pow: [1.5, 2.6] })
  await grainSheet(ax, aPt, A.L, A.h, 26, A.t0, A.t1, 17000, PK, 0, seeded(3), { size: [0.24, 0.85], gamma: 0.7, alpha: 1 })
  // beads catching the light along the crest
  ax.save(); ax.globalCompositeOperation = 'lighter'
  const rb = seeded(4)
  for (let i = 0; i < 22; i++) {
    const t = 200 + rb() * 150, v = rb() * 1.6 - 0.8
    if (rb() > A.L(t, v) + 0.15) continue
    const [px, py] = aPt(t, v)
    bead(ax, px * PK, py * PK, (0.9 + 1.6 * rb()) * PK, 0.7 + 0.3 * rb())
  }
  ax.restore()
  await tick()
  // its soft silhouette, to mask the flowing grains and the light running along it
  const am = mk(PW, PH)
  glowSheet(ctx2(am), aPt, (t, v) => Math.min(1, A.L(t, v) * 1.6), A.t0, A.t1, 1, 0, 180, 8)
  // B: the dark dune in front (a soft black body hides A behind it; grains and a lit rim on top)
  const b = mk(PW * PK, PH * PK), bx = ctx2(b)
  const occ = mk(PW * PK, PH * PK), ox = ctx2(occ)
  ox.fillStyle = '#030303'; ox.beginPath()
  for (let t = B.t0; t <= B.t1; t += 2) { const [px, py] = bPt(t, -0.96); if (t === B.t0) ox.moveTo(px * PK, py * PK); else ox.lineTo(px * PK, py * PK) }
  ox.lineTo(B.t1 * PK, PH * PK + 40); ox.lineTo(B.t0 * PK, PH * PK + 40); ox.closePath(); ox.fill()
  bx.drawImage(soften(occ, 9), 0, 0)
  sheetLight(bx, bPt, B.L, B.t0, B.t1, PK, 0, 200, 12, { body: 0.35, bloom: 0.25, down: [12, 64], pow: [1.3, 2.4] })
  await grainSheet(bx, bPt, B.L, B.h, 18, B.t0, B.t1, 5600, PK, 0, seeded(5), { size: [0.24, 0.7], gamma: 0.75, alpha: 0.78 })
  await tick()
  // loose specks, two sets (they take turns to twinkle)
  const keep = (px: number) => 0.3 + 0.7 * smooth(80, 230, px)
  const s1 = mk(PW * PK, PH * PK), s2 = mk(PW * PK, PH * PK)
  specks(ctx2(s1), 760, PW, PH, PK, seeded(7), { size: [0.22, 1.0], alpha: [0.4, 1], halo: 0.16, keep })
  specks(ctx2(s2), 760, PW, PH, PK, seeded(11), { size: [0.22, 1.0], alpha: [0.4, 1], halo: 0.16, keep })
  // flowing grains: a tile that repeats sideways (grains and faint motion streaks)
  const f = mk(FLOW_W * PK, PH * PK), fx = ctx2(f), r = seeded(13)
  fx.fillStyle = '#fff'; fx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 2800; i++) {
    const px = r() * FLOW_W, py = r() * PH, s = (0.25 + 0.55 * Math.pow(r(), 3)) * PK
    fx.globalAlpha = 0.25 + 0.7 * r()
    dotAt(fx, px * PK, py * PK, s)
    if (px < 2) dotAt(fx, (px + FLOW_W) * PK, py * PK, s)
    if (px > FLOW_W - 2) dotAt(fx, (px - FLOW_W) * PK, py * PK, s)
  }
  for (let i = 0; i < 130; i++) {
    const px = r() * FLOW_W, py = r() * PH, len = (1.5 + r() * 4.5) * PK
    fx.globalAlpha = 0.06 + 0.16 * r()
    fx.fillRect(px * PK, py * PK, len, 0.2 * PK); fx.fillRect((px - FLOW_W) * PK, py * PK, len, 0.2 * PK)
  }
  return { a, am, b, s1, s2, f }
}

// ---- frame (units: the photo is 100 across, centred) ------------------------------------------
// A black disc of space behind the photo (soft-edged, so it reads on white as well as on black)
// with a galaxy of silver dust round it: spiral arms of grains, trailing as it turns, and stars.
const GAL_U = 160, GAL_K = 3.2 // the layer is the frame box at inset −30%
async function paintGalaxy(o: { seed: number; disc: boolean; arms: number; n: number; wind: number; phase: number; alpha: number }) {
  const S = GAL_U * GAL_K, Cc = GAL_U / 2, r = seeded(o.seed)
  const c = mk(S, S), x = ctx2(c)
  if (o.disc) {
    const g = x.createRadialGradient(Cc * GAL_K, Cc * GAL_K, 0, Cc * GAL_K, Cc * GAL_K, Cc * GAL_K)
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.64, 'rgba(0,0,0,1)'); g.addColorStop(0.76, 'rgba(2,2,3,0.78)')
    g.addColorStop(0.88, 'rgba(4,4,6,0.28)'); g.addColorStop(0.97, 'rgba(6,6,8,0)')
    x.fillStyle = g; x.fillRect(0, 0, S, S)
  }
  // arm k at radius rr: angle = phase + k·τ/arms + wind·ln(rr / 52) (wind < 0: arms trail a clockwise turn)
  const armAt = (k: number, rr: number) => o.phase + (k * TAU) / o.arms + o.wind * Math.log(rr / 52)
  const light = (rr: number) => Math.exp(-(rr - 53) / 11) * (1 - smooth(66, 75, rr))
  // their glow (small, blurred)
  const q = mk(S / 4, S / 4), qx = ctx2(q), qk = GAL_K / 4
  for (let k = 0; k < o.arms; k++) for (let rr = 51; rr < 74; rr += 0.5) {
    const a = armAt(k, rr), w = 1.2 + (rr - 50) * 0.12
    qx.fillStyle = `rgba(228,234,248,${(0.5 * light(rr) * o.alpha).toFixed(3)})`
    qx.beginPath(); qx.arc((Cc + Math.cos(a) * rr) * qk, (Cc + Math.sin(a) * rr) * qk, w * qk * 1.6, 0, TAU); qx.fill()
  }
  x.save(); x.globalCompositeOperation = 'lighter'; x.drawImage(soften(q, 4), 0, 0, S, S); x.restore()
  // the grains
  const begin = () => { x.save(); x.fillStyle = '#fff'; x.globalCompositeOperation = 'lighter' }
  begin()
  for (let i = 0; i < o.n; i++) {
    const rr = 51 + 24 * r() ** 1.5, k = Math.floor(r() * o.arms)
    const spread = 0.05 + 0.2 * ((rr - 50) / 30)
    const a = armAt(k, rr) + gauss(r) * spread * (r() < 0.2 ? 2.5 : 1)
    const l = light(rr)
    x.globalAlpha = Math.min(1, (0.25 + 0.75 * r()) * (0.35 + 0.65 * l) * o.alpha)
    dotAt(x, (Cc + Math.cos(a) * rr) * GAL_K, (Cc + Math.sin(a) * rr) * GAL_K, (0.28 + 0.6 * r() ** 3.5 + 0.35 * l * r()) * GAL_K)
    if (i % 2500 === 2499) { x.restore(); await tick(); begin() }
  }
  // stars scattered through the dark, a few catching the light
  for (let i = 0; i < 220; i++) {
    const a = r() * TAU, rr = 52 + 22 * Math.sqrt(r())
    x.globalAlpha = (0.2 + 0.6 * r()) * o.alpha
    dotAt(x, (Cc + Math.cos(a) * rr) * GAL_K, (Cc + Math.sin(a) * rr) * GAL_K, (0.25 + 0.4 * r() ** 3) * GAL_K)
  }
  x.restore()
  x.save(); x.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 9; i++) { const a = r() * TAU, rr = 54 + 17 * r(); bead(x, (Cc + Math.cos(a) * rr) * GAL_K, (Cc + Math.sin(a) * rr) * GAL_K, (1.2 + 1.6 * r()) * GAL_K, o.alpha) }
  x.restore()
  return c
}
// Stardust rings (seen flat here; the markup tilts them): grains in a thin band round a circle,
// clumped, with a comet — a bright, dense head and a long tail — so the turning shows.
const ORB_U = 192, ORB_K = 3, ORB_R = 70
async function paintOrbit(o: { seed: number; n: number; head: number; tail: number; w: number; clumps: [number, number, number][] }) {
  const S = ORB_U * ORB_K, Cc = ORB_U / 2, r = seeded(o.seed)
  const c = mk(S, S), x = ctx2(c)
  const wrap = (t: number) => ((t % TAU) + TAU) % TAU
  // it turns clockwise: brightest at the head, a long tail behind it, a quick fade ahead
  const comet = (t: number) => { const p = wrap(t - o.head + o.tail); return p <= o.tail ? (p / o.tail) ** 2.4 : Math.exp(-(((p - o.tail) / 0.09) ** 2)) }
  const clump = (t: number) => o.clumps.reduce((s, [ang, w, h]) => s + h * Math.exp(-((angDiff(t, ang) / w) ** 2)), 0)
  const dens = (t: number) => 0.2 + clump(t) + 1.2 * comet(t)
  // soft light along it (painted small, blurred), brighter along the comet
  const g = mk(S / 4, S / 4), gx = ctx2(g), gk = ORB_K / 4
  gx.lineCap = 'round'
  for (let i = 0; i < 240; i++) {
    const t0 = (i / 240) * TAU, l = Math.min(1, 0.07 + 0.3 * clump(t0) + comet(t0))
    gx.strokeStyle = `rgba(232,238,250,${l.toFixed(3)})`; gx.lineWidth = (2 + 3.5 * comet(t0)) * gk
    gx.beginPath(); gx.arc(Cc * gk, Cc * gk, ORB_R * gk, t0, t0 + (1.4 / 240) * TAU); gx.stroke()
  }
  x.save(); x.globalCompositeOperation = 'lighter'
  x.globalAlpha = 0.85; x.drawImage(soften(g, 9), 0, 0, S, S)
  x.globalAlpha = 0.6; x.drawImage(soften(g, 2), 0, 0, S, S)
  x.restore()
  // the grains
  const begin = () => { x.save(); x.fillStyle = '#fff'; x.globalCompositeOperation = 'lighter' }
  begin()
  let drawn = 0, tries = 0
  while (drawn < o.n && tries < o.n * 20) {
    tries++
    const t = r() * TAU
    if (r() * 2.6 > dens(t)) continue
    const wide = r() < 0.28, off = gauss(r) * o.w * (wide ? 3.4 : 1), cm = comet(t)
    x.globalAlpha = Math.min(1, (0.22 + 0.55 * r() + 0.45 * cm) * (wide ? 0.6 : 1))
    const s = (0.32 + 0.9 * r() ** 3.4 + 0.5 * cm * r()) * ORB_K
    dotAt(x, (Cc + Math.cos(t) * (ORB_R + off)) * ORB_K, (Cc + Math.sin(t) * (ORB_R + off)) * ORB_K, s)
    if (++drawn % 2500 === 0) { x.restore(); await tick(); begin() }
  }
  x.restore()
  // beads that catch the light, most of them on the comet
  x.save(); x.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 16; i++) {
    const t = i < 6 ? o.head - r() * o.tail * 0.6 : r() * TAU, rr = ORB_R + gauss(r) * o.w
    bead(x, (Cc + Math.cos(t) * rr) * ORB_K, (Cc + Math.sin(t) * rr) * ORB_K, (1.5 + 2.3 * r()) * ORB_K)
  }
  x.restore()
  return c
}
/** A lens glint: a hot core in a bloom, long thin rays (the horizontal pair longest), faint diagonals. */
function paintGlint() {
  const S = 160, Cc = S / 2, c = mk(S, S), x = ctx2(c)
  x.globalCompositeOperation = 'lighter'
  const bloom = (rad: number, a: number) => {
    const g = x.createRadialGradient(Cc, Cc, 0, Cc, Cc, rad)
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.25, `rgba(236,241,255,${a * 0.4})`); g.addColorStop(1, 'rgba(210,220,245,0)')
    x.fillStyle = g; x.beginPath(); x.arc(Cc, Cc, rad, 0, TAU); x.fill()
  }
  const ray = (ang: number, len: number, w: number, a: number) => {
    x.save(); x.translate(Cc, Cc); x.rotate(ang)
    const g = x.createLinearGradient(0, 0, len, 0)
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.3, `rgba(240,244,255,${a * 0.5})`); g.addColorStop(1, 'rgba(230,236,255,0)')
    x.fillStyle = g; x.beginPath(); x.moveTo(0, -w); x.quadraticCurveTo(len * 0.2, -w * 0.2, len, 0); x.quadraticCurveTo(len * 0.2, w * 0.2, 0, w); x.closePath(); x.fill()
    x.restore()
  }
  bloom(Cc * 0.55, 0.5)
  ray(0, Cc, 2.6, 1); ray(Math.PI, Cc, 2.6, 1); ray(Math.PI / 2, Cc * 0.66, 2.1, 0.9); ray(-Math.PI / 2, Cc * 0.66, 2.1, 0.9)
  for (const q of [1, 3, 5, 7]) ray((q * Math.PI) / 4, Cc * 0.3, 1.2, 0.45)
  bloom(Cc * 0.14, 1)
  // a faint halo ring, as a lens leaves
  x.strokeStyle = 'rgba(190,212,255,0.13)'; x.lineWidth = 1.6; x.beginPath(); x.arc(Cc, Cc, Cc * 0.42, 0, TAU); x.stroke()
  return c
}
async function paintFrame() {
  const gA = await paintGalaxy({ seed: 71, disc: true, arms: 3, n: 7000, wind: -1.9, phase: 0.4, alpha: 1 })
  const gB = await paintGalaxy({ seed: 73, disc: false, arms: 2, n: 3200, wind: -1.2, phase: 2.1, alpha: 0.55 })
  const o1 = await paintOrbit({ seed: 79, n: 3600, head: 5.2, tail: 2.3, w: 1.1, clumps: [[1.2, 0.35, 0.4], [2.6, 0.25, 0.3], [3.9, 0.5, 0.2]] })
  const o2 = await paintOrbit({ seed: 83, n: 2600, head: 2.1, tail: 1.7, w: 1.4, clumps: [[4.4, 0.4, 0.35], [0.2, 0.3, 0.25]] })
  return { gA, gB, o1, o2, g: paintGlint() }
}

// ---- 막대 스킨 ------------------------------------------------------------------------------------
// The silk inside: a 32×120 tile that repeats up the channel.
const BK = 4, BT = 120
const BAR: Band = {
  vertical: true, t0: -BT, t1: 2 * BT,
  c: t => 16 + 6 * Math.sin((TAU * t) / BT),
  h: t => 2.6 + 6.4 * (0.5 + 0.5 * Math.cos((TAU * t) / BT + 0.9)) ** 1.6,
  L: (t, v) => {
    const d = Math.abs((((t - 42.8) % BT) + BT * 1.5) % BT - BT / 2)
    return Math.min(1, (0.12 + 0.1 * (1 - Math.abs(v)) + 0.9 * Math.exp(-((d / 9) ** 2)) + 0.3 * Math.exp(-((d / 28) ** 2))) * (1 - smooth(0.78, 1, Math.abs(v))))
  },
}
async function paintBar() {
  // painted three tiles tall (so the blur wraps smoothly), then the middle one is kept
  const W = 32 * BK, H3 = 3 * BT * BK
  const pt = bandPt(BAR)
  const full = mk(W, H3), fx = ctx2(full)
  sheetLight(fx, pt, BAR.L, BAR.t0, BAR.t1, BK, BT, 600, 8, { body: 0.5, bloom: 0.75, down: [9, 49], pow: [1.5, 3] })
  await grainSheet(fx, pt, BAR.L, BAR.h, 9, BAR.t0, BAR.t1, 6500, BK, BT, seeded(31), { size: [0.28, 0.85], gamma: 0.7, alpha: 1 })
  const s = mk(W, BT * BK)
  ctx2(s).drawImage(full, 0, BT * BK, W, BT * BK, 0, 0, W, BT * BK)
  await tick()
  // fine grains rising faster, 32×48
  const q = mk(32 * BK, 48 * BK), qx = ctx2(q), r = seeded(37)
  qx.fillStyle = '#fff'; qx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 520; i++) {
    const px = 1 + r() * 30, py = r() * 48, sz = (0.26 + 0.5 * Math.pow(r(), 3)) * BK
    qx.globalAlpha = 0.25 + 0.7 * r()
    dotAt(qx, px * BK, py * BK, sz)
    if (py < 2) dotAt(qx, px * BK, (py + 48) * BK, sz)
    if (py > 46) dotAt(qx, px * BK, (py - 48) * BK, sz)
  }
  return { s, q }
}
// The double helix of stardust round the pillar: a tile HX_T tall (px on screen) and 1.9 × the
// pillar wide, in two layers — the strands' near side (drawn over the pillar) and far side
// (behind it, showing past its edges). Rising, it seems to turn.
const HX_T = 60, HX_W = 48, HX_K = 4, HX_A = 15.5
async function paintHelix() {
  const W = HX_W * HX_K, H = HX_T * HX_K, r = seeded(67)
  const front = mk(W, H), back = mk(W, H), fx = ctx2(front), bx = ctx2(back)
  for (const x of [fx, bx]) { x.fillStyle = '#fff'; x.globalCompositeOperation = 'lighter' }
  // fine glitter along two strands, split near/far with a soft crossover at the sides; thinned out
  // in places so it sparkles as a trail of dust rather than a stripe
  for (let i = 0; i < 1150; i++) {
    const t = r() * HX_T, ang = (TAU * t) / HX_T + (i & 1) * Math.PI, z = Math.cos(ang), near = (z + 1) / 2
    if (r() > 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ang * 3 + (i & 1) * 2))) continue
    const px = HX_W / 2 + HX_A * Math.sin(ang) + gauss(r) * (r() < 0.25 ? 2.2 : 0.6), py = t + gauss(r) * 0.7
    const sz = (0.24 + 0.34 * near + 0.5 * r() ** 5) * HX_K, al = (0.14 + 0.5 * near) * (0.3 + 0.7 * r())
    const wf = smooth(-0.2, 0.2, z)
    for (const [x, w] of [[fx, wf], [bx, (1 - wf) * 0.75]] as [Ctx, number][]) {
      if (w < 0.01) continue
      x.globalAlpha = al * w
      for (const dy of py < 3 ? [0, HX_T] : py > HX_T - 3 ? [0, -HX_T] : [0]) dotAt(x, px * HX_K, (py + dy) * HX_K, sz)
    }
  }
  await tick()
  // a few beads on the near side, catching the light
  fx.globalAlpha = 1
  for (let i = 0, n = 0; n < 3 && i < 40; i++) {
    const t = r() * HX_T, ang = (TAU * t) / HX_T + (i & 1) * Math.PI
    if (Math.cos(ang) < 0.5) continue
    n++
    bead(fx, (HX_W / 2 + HX_A * Math.sin(ang)) * HX_K, t * HX_K, (1.1 + 0.9 * r()) * HX_K)
  }
  return { front, back }
}

/** Film grain: sparse light specks, tiled over the art and jittered a few times a second. */
function paintNoise() {
  const n = 128, c = mk(n, n), x = ctx2(c), img = x.createImageData(n, n), r = seeded(41)
  for (let i = 0; i < n * n; i++) {
    const on = r() < 0.2, g = 190 + r() * 65
    img.data[i * 4] = g; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = g; img.data[i * 4 + 3] = on ? 30 + r() * 150 : 0
  }
  x.putImageData(img, 0, 0)
  return c
}

let started = false
/** Paints the set's images once (on first use) and puts them in a stylesheet. */
export function ensureSilverArt() {
  if (started || typeof document === 'undefined') return
  started = true
  setTimeout(() => { paintAll().catch(() => { /* no canvas: the layers stay empty */ }) }, 0)
}
async function paintAll() {
  const bg = (cls: string, c: HTMLCanvasElement) => toUrl(c).then(u => `.${cls}{background-image:url(${u})}`)
  const mask = (cls: string, c: HTMLCanvasElement) => toUrl(c).then(u => `.${cls}{-webkit-mask-image:url(${u});mask-image:url(${u})}`)
  // each piece gets its stylesheet as soon as it's painted (the frame first: it's on the most screens)
  const add = async (id: string, rules: Promise<string>[]) => {
    const style = document.createElement('style')
    style.id = id
    style.textContent = (await Promise.all(rules)).join('\n')
    document.head.appendChild(style)
  }
  const f = await paintFrame()
  await add('silver-art-frame', [bg('sl-iGA', f.gA), bg('sl-iGB', f.gB), bg('sl-iO1', f.o1), bg('sl-iO2', f.o2), bg('sl-iG', f.g)])
  await tick()
  const b = await paintBar()
  const h = await paintHelix()
  await add('silver-art-bar', [bg('sl-iBS', b.s), bg('sl-iBG', b.q), bg('sl-iHF', h.front), bg('sl-iHB', h.back)])
  await tick()
  const p = await paintPlate()
  await add('silver-art', [
    bg('sl-iA', p.a), mask('sl-iAm', p.am), bg('sl-iB', p.b), bg('sl-iS1', p.s1), bg('sl-iS2', p.s2), bg('sl-iF', p.f),
    bg('sl-iN', paintNoise()),
  ])
}

// ---- markup ------------------------------------------------------------------------------------
const IMG = 'background-repeat:no-repeat;background-position:center;background-size:100% 100%'
/** An annulus mask (percent of the box's half size). */
const ring = (a: number, b: number) => `-webkit-mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 0.5}%,#000 ${b - 0.5}%,transparent ${b}%);mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 0.5}%,#000 ${b - 0.5}%,transparent ${b}%)`
/** A lens glint flashing now and then (left/top in %, size in `unit`). */
const glint = (left: number, top: number, size: number, delay: number, dur: number, unit = '%') =>
  `<div class="sl-glint sl-iG" style="position:absolute;left:${left}%;top:${top}%;width:${size}${unit};height:${size}${unit};margin:calc(${size}${unit} / -2) 0 0 calc(${size}${unit} / -2);${IMG};opacity:0;pointer-events:none;animation:slGlint ${dur}s ease-out ${delay}s infinite"></div>`

// Chrome: a polished tube seen from above — its cross-section is the pattern of light across the
// ring (a crisp highlight on the inner lip, a black horizon band, a bright lower band, dark edges),
// with soft reflections turning round it both ways (so it seems to flow like liquid metal), a key
// light from the top left and two hot spots. Ring box = the photo box at inset −10% (the photo's
// edge at 83.3% of its half size); the chrome runs to 96.2%.
const CHROME_BASE = 'radial-gradient(closest-side,#141414 83.3%,#f7f7f7 84.4%,#cfcfcf 85.8%,#5e5e5e 87.6%,#0a0a0a 89.3%,#1f1f1f 90.7%,#c4c4c4 92.3%,#fcfcfc 93.8%,#8d8d8d 95.1%,#161616 96.2%)'
const CHROME_A = 'conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,0.55) 26deg,rgba(255,255,255,0) 52deg,rgba(0,0,0,0.55) 96deg,rgba(0,0,0,0) 140deg,rgba(255,255,255,0.4) 176deg,rgba(255,255,255,0) 206deg,rgba(0,0,0,0.6) 252deg,rgba(0,0,0,0) 296deg,rgba(255,255,255,0.5) 330deg,rgba(255,255,255,0) 360deg)'
const CHROME_B = 'conic-gradient(from 60deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,0.7) 10deg,rgba(255,255,255,0) 22deg,rgba(255,255,255,0) 150deg,rgba(255,255,255,0.6) 158deg,rgba(255,255,255,0) 168deg,rgba(0,0,0,0) 220deg,rgba(0,0,0,0.5) 250deg,rgba(0,0,0,0) 280deg)'
// sky above, warm ground below: the faint colour casts real chrome picks up
const TINT = 'linear-gradient(180deg,rgba(150,182,255,0.16) 0%,rgba(150,182,255,0) 44%,rgba(255,206,160,0) 60%,rgba(255,206,160,0.13) 100%)'
const KEY = 'radial-gradient(circle at 22% 19%,rgba(255,255,255,1) 0,rgba(255,255,255,0.5) 2.4%,rgba(255,255,255,0) 7%),radial-gradient(circle at 81% 84%,rgba(255,255,255,0.8) 0,rgba(255,255,255,0.25) 2%,rgba(255,255,255,0) 5.5%),linear-gradient(135deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0) 40%,rgba(0,0,0,0) 60%,rgba(0,0,0,0.4) 100%)'
// Every layer carries its own annulus mask: the mask is round, so a turning layer looks the same
// with it baked in (drawn once), and the GPU only has to turn it — a still mask over turning
// layers would have to be applied again every frame.
const R = ring(82.9, 96.4)
const CHROME =
  // the photo's edge sinks into the metal
  `<div style="position:absolute;inset:-10%;border-radius:50%;${ring(72, 83.6)};background:radial-gradient(closest-side,rgba(0,0,0,0) 72%,rgba(0,0,0,0.5) 83.6%)"></div>` +
  `<div style="position:absolute;inset:-10%;border-radius:50%;${R};background:${CHROME_BASE}"></div>` +
  `<div class="sl-ring" style="position:absolute;inset:-10%;border-radius:50%;${R};background:${CHROME_A};animation:avSpin 11s linear infinite"></div>` +
  `<div class="sl-ring" style="position:absolute;inset:-10%;border-radius:50%;${R};background:${CHROME_B};animation:avSpin 6.5s linear infinite reverse"></div>` +
  `<div style="position:absolute;inset:-10%;border-radius:50%;${R};background:${KEY},${TINT}"></div>` +
  // now and then a streak of light races once round the metal
  `<div class="sl-zip" style="position:absolute;inset:-10%;border-radius:50%;${R};background:conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,0) 318deg,rgba(255,255,255,0.35) 340deg,#ffffff 356deg,rgba(255,255,255,0) 360deg);opacity:0;animation:slZip 4.8s cubic-bezier(.5,0,.3,1) 1.2s infinite"></div>` +
  // a dark line round the outside, so it stays crisp on white
  `<div style="position:absolute;inset:-10%;border-radius:50%;${ring(96, 97.8)};background:rgba(0,0,0,0.75)"></div>`

// Stardust rings: flat texture → squashed (tilted away) → tilted sideways, turning in their own
// plane. The far half (upper) goes behind the photo, the near half (lower) in front of it.
const ORB_INSET = 46 // % — the texture box (192 units: ring radius 70)
const ORBITS = [
  { cls: 'sl-iO1', tilt: -14, squash: 0.3, dur: 12, flip: false },
  { cls: 'sl-iO2', tilt: 26, squash: 0.2, dur: 18, flip: true },
]
// (a rectangular clip, not a mask: the GPU clips for free)
const halfClip = (near: boolean) => `clip-path:inset(${near ? '50% 0 0 0' : '0 0 50% 0'})`
const orbitHalf = (o: typeof ORBITS[number], near: boolean) =>
  `<div style="position:absolute;inset:-${ORB_INSET}%;transform:rotate(${o.tilt}deg)"><div style="position:absolute;inset:0;${halfClip(near)}">` +
  `<div style="position:absolute;inset:0;transform:scale(${o.flip ? -1 : 1},${o.squash})">` +
  `<div class="sl-orbit ${o.cls}" style="position:absolute;inset:0;${IMG};animation:avSpin ${o.dur}s linear infinite"></div>` +
  `</div></div></div>`

export const SILVER_AVATAR: { before: string; after: string } = {
  before:
    // the disc of space and its galaxy, turning; a fainter, faster layer of dust over it
    `<div class="sl-rot sl-iGA" style="position:absolute;inset:-30%;${IMG};animation:avSpin 34s linear infinite"></div>` +
    `<div class="sl-rot sl-iGB" style="position:absolute;inset:-30%;${IMG};animation:avSpin 19s linear infinite"></div>` +
    ORBITS.map(o => orbitHalf(o, false)).join(''),
  after:
    // a ring of light pulsing out of the chrome, over the dark
    `<div class="sl-wave" style="position:absolute;inset:-10%;border-radius:50%;background:radial-gradient(closest-side,rgba(235,240,255,0) 90%,rgba(235,240,255,0.6) 95%,rgba(235,240,255,0) 98.5%);opacity:0;animation:slWave 3.6s cubic-bezier(.2,.6,.3,1) infinite"></div>` +
    CHROME +
    ORBITS.map(o => orbitHalf(o, true)).join('') +
    glint(14, 14, 50, 0.3, 3.8) + glint(88, 86, 34, 2.1, 4.6) + glint(88, 16, 22, 3.3, 5.3),
}

// The 이름표's layers are the plate plus a margin (so they can sway), cover-fitted. On a plate the
// whole width shows; on the tall profile banner the middle does (50%), which puts the fold of
// light to the right of the name. The flowing grain tile is (layer height) × 92/80 wide.
const LAYER = 'position:absolute;inset:-20% -8%'
const FIT = 'background-repeat:no-repeat;background-size:cover;background-position:50% center'
const FIT_MASK = '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:cover;mask-size:cover;-webkit-mask-position:50% center;mask-position:50% center'
// polished chrome bezel: reflection bands, with two highlights running round it
const BEZEL = 'conic-gradient(from 200deg,#3a3a3a,#f2f2f2 8%,#6a6a6a 16%,#1a1a1a 28%,#9a9a9a 40%,#ffffff 46%,#5a5a5a 54%,#141414 66%,#b0b0b0 78%,#2a2a2a 90%,#3a3a3a)'
export const SILVER_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:#000">` +
  // everything dims toward the name on the left
  `<div style="position:absolute;inset:0;-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0.4) 0%,#000 44%);mask-image:linear-gradient(90deg,rgba(0,0,0,0.4) 0%,#000 44%)">` +
  // the bright sheet, swaying, grains flowing along it and a sheen of light running down it
  `<div class="sl-sway" style="${LAYER};animation:slSwayA 5.5s ease-in-out infinite alternate">` +
  `<div class="sl-iA" style="position:absolute;inset:0;${FIT}"></div>` +
  `<div class="sl-iAm" style="position:absolute;inset:0;${FIT_MASK};container-type:size">` +
  `<div class="sl-flow sl-iF" style="--tw:calc(100cqh * ${(FLOW_W / PH).toFixed(4)});position:absolute;top:0;bottom:0;left:calc(-1 * var(--tw));width:calc(100% + var(--tw));background-repeat:repeat-x;background-size:auto 100%;will-change:transform;animation:slFlowT 3.6s linear infinite"></div>` +
  `<div class="sl-sheen" style="position:absolute;top:0;bottom:0;left:0;width:30%;transform:translateX(-110%);background:linear-gradient(100deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.1) 30%,rgba(255,255,255,0.8) 50%,rgba(255,255,255,0.1) 70%,rgba(255,255,255,0) 100%);animation:slSheen 3.2s cubic-bezier(.45,0,.3,1) infinite"></div>` +
  `</div>` +
  `</div>` +
  // the dark dune in front, swaying against it
  `<div class="sl-sway" style="${LAYER};animation:slSwayB 7s ease-in-out infinite alternate"><div class="sl-iB" style="position:absolute;inset:0;${FIT}"></div></div>` +
  // loose specks taking turns to twinkle
  `<div class="sl-tw sl-iS1" style="${LAYER};${FIT};animation:slTw 2.6s ease-in-out infinite alternate"></div>` +
  `<div class="sl-tw sl-iS2" style="${LAYER};${FIT};animation:slTw 2.6s ease-in-out -1.3s infinite alternate"></div>` +
  `</div>` +
  // loose dust streaming across the whole plate, faster in front (parallax)
  `<div style="position:absolute;inset:0;container-type:size;pointer-events:none"><div class="sl-flow sl-iF" style="--tw:calc(100cqh * ${(FLOW_W / PH).toFixed(4)});position:absolute;top:-10%;bottom:-10%;left:calc(-1 * var(--tw));width:calc(100% + var(--tw));background-repeat:repeat-x;background-size:auto 100%;opacity:0.55;will-change:transform;animation:slFlowT 2.2s linear infinite"></div></div>` +
  // film grain
  `<div class="sl-grain sl-iN" style="position:absolute;inset:-50%;background-repeat:repeat;background-size:128px 128px;opacity:0.3;animation:slGrain 0.9s steps(1) infinite"></div>` +
  // glints flashing on the crest
  `<div style="position:absolute;inset:0;container-type:size;pointer-events:none">${glint(67, 33, 74, 0.6, 4.4, 'cqh')}${glint(80, 60, 52, 2.5, 4.4, 'cqh')}${glint(92, 22, 44, 3.7, 5.2, 'cqh')}</div>` +
  `</div>` +
  // the chrome bezel
  `<div style="position:absolute;inset:0;border-radius:14px;padding:1.6px;overflow:hidden;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);z-index:3;pointer-events:none;background:#6a6a6a">` +
  `<div style="position:absolute;left:-25%;top:50%;width:150%;padding-top:150%;margin-top:-75%;background:${BEZEL}"></div>` +
  `<div class="sl-ring" style="position:absolute;left:-25%;top:50%;width:150%;padding-top:150%;margin-top:-75%;background:conic-gradient(from 0deg,rgba(255,255,255,0) 0 34%,rgba(255,255,255,0.9) 42%,#ffffff 45%,rgba(255,255,255,0) 52%,rgba(255,255,255,0) 84%,rgba(255,255,255,0.8) 92%,rgba(255,255,255,0) 99%);animation:avSpin 5s linear infinite"></div></div>` +
  // and a dark line just inside it
  `<div style="position:absolute;inset:1.6px;border-radius:12.6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.85),inset 0 0 10px rgba(0,0,0,0.6);z-index:3;pointer-events:none"></div>`

/** The 막대's silk tile height and helix tile height (px on screen). */
export const BAR_TILE = BT
export const HELIX_TILE = HX_T
/** The 막대's tip: a mercury bead (a chrome sphere) with a lens flare turning slowly and breathing on its highlight. */
export const BAR_TIP =
  `<div style="position:absolute;left:0;top:-3px;width:0;height:0">` +
  `<div class="sl-glow" style="position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;background:radial-gradient(closest-side,rgba(235,240,252,0.6),rgba(200,210,235,0.2) 55%,rgba(200,210,235,0));animation:auraBreath 2.2s ease-in-out infinite"></div>` +
  `<div style="position:absolute;left:-6px;top:-6px;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 28%,#ffffff 0,#ffffff 10%,#dedede 22%,#7a7a7a 44%,#0d0d0d 60%,#2e2e2e 74%,#cfcfcf 90%,#7e7e7e 100%);box-shadow:0 0 0 1px rgba(0,0,0,0.85),0 0 10px rgba(230,236,250,0.75)"></div>` +
  `<div class="sl-flare sl-iG" style="position:absolute;left:-35px;top:-37px;width:66px;height:66px;${IMG};animation:slFlare 7s ease-in-out infinite"></div>` +
  `<div class="sl-flare sl-iG" style="position:absolute;left:-23px;top:-25px;width:42px;height:42px;${IMG};opacity:0.7;transform:rotate(45deg);animation:slFlare2 5s ease-in-out -1.5s infinite"></div>` +
  `</div>`

// ---- grains breaking out past the edges and scattering (a few HTML dots, CSS-animated) --------
const SPILL_DOT = 'position:absolute;border-radius:50%;background:#eef1f6;box-shadow:0 0 0 0.7px rgba(20,22,28,0.55),0 0 4px rgba(235,240,255,0.95),0 0 9px rgba(190,200,225,0.6);opacity:0;pointer-events:none'
/** Around the 이름표 (outside its clipped box): out of the top, bottom and right edge of the art side. */
export const SILVER_PLATE_SPILL = (() => {
  const r = seeded(51); let out = ''
  for (let i = 0; i < 34; i++) {
    const e = r(); let left: string, top: string, dx: number, dy: number
    if (e < 0.42) { left = `${(32 + r() * 66).toFixed(1)}%`; top = '0%'; dx = (r() - 0.35) * 22; dy = -(5 + r() * 16) }
    else if (e < 0.84) { left = `${(32 + r() * 66).toFixed(1)}%`; top = '100%'; dx = (r() - 0.35) * 22; dy = 5 + r() * 14 }
    else { left = '100%'; top = `${(10 + r() * 80).toFixed(1)}%`; dx = 6 + r() * 18; dy = (r() - 0.5) * 14 }
    const s = 1.5 + r() * 2, dur = 1.6 + r() * 2
    out += `<span class="sl-spill" style="${SPILL_DOT};left:${left};top:${top};width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;margin:${(-s / 2).toFixed(2)}px 0 0 ${(-s / 2).toFixed(2)}px;--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;animation:slSpill ${dur.toFixed(2)}s ease-out ${(-r() * dur).toFixed(2)}s infinite"></span>`
  }
  return `<div style="position:absolute;inset:0;pointer-events:none;z-index:4">${out}</div>`
})()
/** Around the frame: flung outward off the chrome, past the smoke (sizes follow --av). */
const FRAME_SPILL = (() => {
  const r = seeded(53); let out = ''
  for (let i = 0; i < 28; i++) {
    const a = r() * 360, r0 = 0.6 + r() * 0.08, r1 = 0.95 + r() * 0.35, dur = 1.8 + r() * 2
    out += `<span class="sl-spill" style="${SPILL_DOT};left:0;top:0;width:max(1.2px,calc(var(--av,52px) * 0.03));height:max(1.2px,calc(var(--av,52px) * 0.03));margin:calc(max(1.2px,calc(var(--av,52px) * 0.03)) / -2) 0 0 calc(max(1.2px,calc(var(--av,52px) * 0.03)) / -2);--a:${a.toFixed(0)}deg;--r0:calc(var(--av,52px) * ${r0.toFixed(2)});--r1:calc(var(--av,52px) * ${r1.toFixed(2)});animation:slSpillR ${dur.toFixed(2)}s ease-out ${(-r() * dur).toFixed(2)}s infinite"></span>`
  }
  return `<div style="position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none">${out}</div>`
})()
SILVER_AVATAR.after += FRAME_SPILL
/** Around the 막대: off both sides, drifting up and out. */
export const SILVER_BAR_SPILL = (() => {
  const r = seeded(57); let out = ''
  for (let i = 0; i < 22; i++) {
    const right = r() < 0.5, s = 1.5 + r() * 1.8, dur = 1.6 + r() * 1.8
    out += `<span class="sl-spill" style="${SPILL_DOT};left:${right ? '100%' : '0%'};top:${(4 + r() * 92).toFixed(1)}%;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;--dx:${((right ? 1 : -1) * (5 + r() * 14)).toFixed(1)}px;--dy:${(-(3 + r() * 14)).toFixed(1)}px;animation:slSpill ${dur.toFixed(2)}s ease-out ${(-r() * dur).toFixed(2)}s infinite"></span>`
  }
  return out
})()
