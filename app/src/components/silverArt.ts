// 삼겹살 먹고싶다 — a set (frame, 이름표, 막대 스킨) in the look of a silver particle film on pure
// black: sheets of silk made of countless grains of light, folding into a bright crest, a dark
// grainy dune in front, loose specks drifting in the dark, film grain over it all.
//
// How: the first time an item of the set is shown, the surfaces are painted into canvases —
// tens of thousands of grains added up with 'lighter' blending over a soft glow — and turned into
// image URLs in one stylesheet (classes sl-i*). The markup below only names those classes; its
// layers then sway, flow, turn and twinkle with CSS transforms and opacity, so nothing is painted
// per frame, however many grains there are.

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

type Pt = (t: number, v: number) => [number, number]
type Light = (t: number, v: number) => number
/**
 * A sheet of silk: a band along x (or y) with a centre line, a half-width and a light function
 * over (t, v) — t along the band, v across it from −1 to 1.
 */
type Band = { t0: number; t1: number; c: (t: number) => number; h: (t: number) => number; L: Light; vertical?: boolean }
const bandPt = (b: Band): Pt => (t, v) => { const a = b.c(t) + v * b.h(t); return b.vertical ? [a, t] : [t, a] }
/** A polar band round (cx, cy): t is the angle. */
type Ring = { cx: number; cy: number; rc: (t: number) => number; h: (t: number) => number; L: Light }
const ringPt = (g: Ring): Pt => (t, v) => { const r = g.rc(t) + v * g.h(t); return [g.cx + Math.cos(t) * r, g.cy + Math.sin(t) * r] }

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
const tick = () => new Promise(r => setTimeout(r, 0))

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
  const aPt = bandPt(A), bPt = bandPt(B)
  // A: the bright sheet
  const a = mk(PW * PK, PH * PK), ax = ctx2(a)
  sheetLight(ax, aPt, A.L, A.t0, A.t1, PK, 0, 300, 12, { body: 0.55, bloom: 1, down: [12, 100], pow: [1.5, 2.6] })
  await grainSheet(ax, aPt, A.L, A.h, 26, A.t0, A.t1, 15000, PK, 0, seeded(3), { size: [0.26, 0.85], gamma: 0.7, alpha: 1 })
  await tick()
  // its soft silhouette, to mask the flowing grains
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
  await grainSheet(bx, bPt, B.L, B.h, 18, B.t0, B.t1, 5200, PK, 0, seeded(5), { size: [0.24, 0.7], gamma: 0.75, alpha: 0.75 })
  await tick()
  // loose specks, two sets (they take turns to twinkle)
  const keep = (px: number) => 0.3 + 0.7 * smooth(80, 230, px)
  const s1 = mk(PW * PK, PH * PK), s2 = mk(PW * PK, PH * PK)
  specks(ctx2(s1), 700, PW, PH, PK, seeded(7), { size: [0.22, 1.0], alpha: [0.4, 1], halo: 0.15, keep })
  specks(ctx2(s2), 700, PW, PH, PK, seeded(11), { size: [0.22, 1.0], alpha: [0.4, 1], halo: 0.15, keep })
  // flowing grains: a tile that repeats sideways (grains and faint motion streaks)
  const f = mk(FLOW_W * PK, PH * PK), fx = ctx2(f), r = seeded(13)
  fx.fillStyle = '#fff'; fx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 2600; i++) {
    const px = r() * FLOW_W, py = r() * PH, s = (0.25 + 0.55 * Math.pow(r(), 3)) * PK
    fx.globalAlpha = 0.25 + 0.7 * r()
    dotAt(fx, px * PK, py * PK, s)
    if (px < 2) dotAt(fx, (px + FLOW_W) * PK, py * PK, s)
    if (px > FLOW_W - 2) dotAt(fx, (px - FLOW_W) * PK, py * PK, s)
  }
  for (let i = 0; i < 120; i++) {
    const px = r() * FLOW_W, py = r() * PH, len = (1.5 + r() * 4.5) * PK
    fx.globalAlpha = 0.06 + 0.16 * r()
    fx.fillRect(px * PK, py * PK, len, 0.2 * PK); fx.fillRect((px - FLOW_W) * PK, py * PK, len, 0.2 * PK)
  }
  return { a, am, b, s1, s2, f }
}

// ---- frame (canvas units 160×160 round the photo, which is the circle r=50 at the centre) ------
const FK = 4
const RA: Ring = {
  cx: 80, cy: 80,
  rc: t => 63.5 + 3.6 * Math.sin(2 * t + 0.6),
  h: t => 2.4 + 7.2 * (0.5 + 0.5 * Math.sin(t + 0.9)) ** 2,
  L: (t, v) => Math.min(1, (0.1 + 0.07 * (1 - Math.abs(v)) + 1 * Math.exp(-((angDiff(t, 3.81) / 0.45) ** 2)) + 0.34 * Math.exp(-((angDiff(t, 3.81) / 1.2) ** 2)) + 0.55 * Math.exp(-((angDiff(t, 0.7) / 0.35) ** 2)) + 0.2 * Math.exp(-(((v - 0.8) / 0.2) ** 2))) * (1 - smooth(0.78, 1, Math.abs(v)))),
}
const RB: Ring = {
  cx: 80, cy: 80,
  rc: t => 70 + 4.5 * Math.sin(3 * t + 2.1),
  h: t => 3.4 + 5.2 * (0.5 + 0.5 * Math.cos(2 * t + 0.4)) ** 1.5,
  L: (t, v) => (0.08 + 0.45 * Math.exp(-((angDiff(t, 1.1) / 0.5) ** 2)) + 0.1 * Math.exp(-(((v + 0.85) / 0.2) ** 2))) * (1 - smooth(0.72, 1, Math.abs(v))),
}
async function paintFrame() {
  const S = 160 * FK
  const aPt = ringPt(RA), bPt = ringPt(RB)
  const ra = mk(S, S), rax = ctx2(ra)
  sheetLight(rax, aPt, RA.L, 0, TAU, FK, 0, 400, 10, { body: 0.7, bloom: 1, down: [9, 81], pow: [1.4, 2.6] })
  await grainSheet(rax, aPt, RA.L, RA.h, 9.6, 0, TAU, 9000, FK, 0, seeded(17), { size: [0.28, 0.85], gamma: 0.7, alpha: 1 })
  const ram = mk(160, 160)
  glowSheet(ctx2(ram), aPt, (t, v) => Math.min(1, RA.L(t, v) * 1.7), 0, TAU, 1, 0, 240, 6)
  await tick()
  const rb = mk(S, S), rbx = ctx2(rb)
  sheetLight(rbx, bPt, RB.L, 0, TAU, FK, 0, 300, 8, { body: 0.35, bloom: 0.3, down: [9, 64], pow: [1.5, 2.8] })
  await grainSheet(rbx, bPt, RB.L, RB.h, 8.6, 0, TAU, 4200, FK, 0, seeded(19), { size: [0.26, 0.7], gamma: 0.75, alpha: 0.8 })
  await tick()
  // grains streaming round (turned faster inside A's silhouette)
  const rf = mk(S, S), rfx = ctx2(rf), r = seeded(23)
  rfx.fillStyle = '#fff'; rfx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 3600; i++) {
    const t = r() * TAU, rad = 52 + r() * 28
    rfx.globalAlpha = 0.25 + 0.7 * r()
    dotAt(rfx, (80 + Math.cos(t) * rad) * FK, (80 + Math.sin(t) * rad) * FK, (0.26 + 0.5 * Math.pow(r(), 3)) * FK)
  }
  rfx.lineCap = 'round'; rfx.strokeStyle = '#fff'; rfx.lineWidth = 0.22 * FK
  for (let i = 0; i < 280; i++) {
    const t = r() * TAU, rad = 54 + r() * 24, len = 0.03 + r() * 0.07
    rfx.globalAlpha = 0.1 + 0.25 * r()
    rfx.beginPath(); rfx.arc(80 * FK, 80 * FK, rad * FK, t, t + len); rfx.stroke()
  }
  const rs = mk(S, S)
  specks(ctx2(rs), 460, 160, 160, FK, seeded(29), { size: [0.24, 0.95], alpha: [0.35, 1], halo: 0.16, keep: (px, py) => { const d = Math.hypot(px - 80, py - 80); return d < 52 ? 0 : d > 80 ? 0.15 : 1 } })
  return { ra, ram, rb, rf, rs }
}

// ---- 막대 스킨 (a 32×120 tile that repeats up the bar) ---------------------------------------------
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
  const p = await paintPlate(); await tick()
  const f = await paintFrame(); await tick()
  const b = await paintBar(); await tick()
  const n = paintNoise()
  const bg = (cls: string, c: HTMLCanvasElement) => toUrl(c).then(u => `.${cls}{background-image:url(${u})}`)
  const mask = (cls: string, c: HTMLCanvasElement) => toUrl(c).then(u => `.${cls}{-webkit-mask-image:url(${u});mask-image:url(${u})}`)
  const rules = await Promise.all([
    bg('sl-iA', p.a), mask('sl-iAm', p.am), bg('sl-iB', p.b), bg('sl-iS1', p.s1), bg('sl-iS2', p.s2), bg('sl-iF', p.f),
    bg('sl-iRA', f.ra), mask('sl-iRAm', f.ram), bg('sl-iRB', f.rb), bg('sl-iRF', f.rf), bg('sl-iRS', f.rs),
    bg('sl-iBS', b.s), bg('sl-iBG', b.q), bg('sl-iN', n),
  ])
  const style = document.createElement('style')
  style.id = 'silver-art'
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}

// ---- markup ------------------------------------------------------------------------------------
const ring = (a: number, b: number) => `-webkit-mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b}%,transparent ${b + 1}%);mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b}%,transparent ${b + 1}%)`
/** The badge sparkle from the design, centred on 0,0 (size ≈ 20). */
export const SPARKLE_PATH = 'M0 -9.4C.55 -9.4 .88 -8.85 1.08 -7.3c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C-8.85 .88-9.4 .55-9.4 0s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C-.88 -8.85-.55 -9.4 0 -9.4Z'
const sparkle = (x: number, y: number, s: number, delay: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="${SPARKLE_PATH}" fill="#ffffff" class="sl-spark" style="transform-box:fill-box;transform-origin:center;animation:krTwinkle 2.8s ease-in-out ${delay}s infinite;opacity:0"></path></g>`
const METAL = 'conic-gradient(from 0deg,#0a0a0a,#5a5a5a 9%,#f5f5f5 15%,#8a8a8a 21%,#1a1a1a 33%,#3a3a3a 46%,#d8d8d8 54%,#ffffff 58%,#6a6a6a 64%,#0e0e0e 77%,#7a7a7a 89%,#0a0a0a)'
const IMG = 'background-repeat:no-repeat;background-position:center;background-size:100% 100%'
const MASK = '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:100% 100%;mask-size:100% 100%'

export const SILVER_AVATAR: { before: string; after: string } = {
  before:
    // a dark halo so the silver reads on any background
    `<div style="position:absolute;inset:-30%;border-radius:50%;background:radial-gradient(closest-side,#000 90%,rgba(0,0,0,0.7) 95%,transparent 100%)"></div>`,
  after:
    // the dim sheet behind, turning one way
    `<div class="sl-rot" style="position:absolute;inset:-30%;animation:avSpin 28s linear infinite reverse"><div class="sl-iRB" style="position:absolute;inset:0;${IMG}"></div></div>` +
    // the bright sheet, turning the other way, with grains streaming round inside it
    `<div class="sl-rot" style="position:absolute;inset:-30%;animation:avSpin 16s linear infinite">` +
    `<div class="sl-iRA" style="position:absolute;inset:0;${IMG}"></div>` +
    `<div class="sl-iRAm" style="position:absolute;inset:0;${MASK}"><div class="sl-rot sl-iRF" style="position:absolute;inset:0;${IMG};animation:avSpin 5s linear infinite"></div></div>` +
    `</div>` +
    // loose specks, breathing
    `<div class="sl-tw sl-iRS" style="position:absolute;inset:-30%;${IMG};animation:slTw 3s ease-in-out infinite alternate"></div>` +
    // a fine liquid-metal edge on the photo
    `<div class="sl-ring" style="position:absolute;inset:-12%;border-radius:50%;background:${METAL};${ring(80.6, 83.4)};animation:avSpin 6s linear infinite"></div>` +
    `<div class="sl-ring" style="position:absolute;inset:-12%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 72%,rgba(255,255,255,0.9) 94%,transparent 100%);${ring(80.6, 83.4)};animation:avSpin 2.4s linear infinite reverse"></div>` +
    `<svg viewBox="0 0 120 120" style="position:absolute;inset:-10%;width:120%;height:120%;overflow:visible">` +
    sparkle(100, 16, 0.55, 0) + sparkle(16, 98, 0.4, 1.4) +
    `</svg>`,
}

// The 이름표's layers are the plate plus a margin (so they can sway), cover-fitted. On a plate the
// whole width shows; on the tall profile banner the middle does (50%), which puts the fold of
// light to the right of the name. The flowing grain tile is (layer height) × 92/80 wide.
const LAYER = 'position:absolute;inset:-20% -8%'
const FIT = 'background-repeat:no-repeat;background-size:cover;background-position:50% center'
const FIT_MASK = '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:cover;mask-size:cover;-webkit-mask-position:50% center;mask-position:50% center'
export const SILVER_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:#000">` +
  // everything dims toward the name on the left
  `<div style="position:absolute;inset:0;-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0.4) 0%,#000 44%);mask-image:linear-gradient(90deg,rgba(0,0,0,0.4) 0%,#000 44%)">` +
  // the bright sheet, swaying, grains flowing along it
  `<div class="sl-sway" style="${LAYER};animation:slSwayA 9s ease-in-out infinite alternate">` +
  `<div class="sl-iA" style="position:absolute;inset:0;${FIT}"></div>` +
  `<div class="sl-iAm" style="position:absolute;inset:0;${FIT_MASK};container-type:size"><div class="sl-flow sl-iF" style="--tw:calc(100cqh * ${(FLOW_W / PH).toFixed(4)});position:absolute;top:0;bottom:0;left:calc(-1 * var(--tw));width:calc(100% + var(--tw));background-repeat:repeat-x;background-size:auto 100%;will-change:transform;animation:slFlowT 6s linear infinite"></div></div>` +
  `</div>` +
  // the dark dune in front, swaying against it
  `<div class="sl-sway" style="${LAYER};animation:slSwayB 12s ease-in-out infinite alternate"><div class="sl-iB" style="position:absolute;inset:0;${FIT}"></div></div>` +
  // loose specks taking turns to twinkle
  `<div class="sl-tw sl-iS1" style="${LAYER};${FIT};animation:slTw 2.6s ease-in-out infinite alternate"></div>` +
  `<div class="sl-tw sl-iS2" style="${LAYER};${FIT};animation:slTw 2.6s ease-in-out -1.3s infinite alternate"></div>` +
  `</div>` +
  // film grain
  `<div class="sl-grain sl-iN" style="position:absolute;inset:-50%;background-repeat:repeat;background-size:128px 128px;opacity:0.32;animation:slGrain 0.9s steps(1) infinite"></div>` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%">${sparkle(302, 12, 0.5, 0.4)}</svg>` +
  `</div>` +
  // liquid-metal edge: a silver hairline with a light running round it
  `<div style="position:absolute;inset:0;border-radius:14px;padding:1px;overflow:hidden;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);z-index:3;pointer-events:none;background:rgba(198,198,198,0.5)">` +
  `<div class="sl-ring" style="position:absolute;left:-25%;top:50%;width:150%;padding-top:150%;margin-top:-75%;background:conic-gradient(from 0deg,transparent 0 32%,#8a8a8a 42%,#ffffff 50%,#8a8a8a 58%,transparent 68%);animation:avSpin 4s linear infinite"></div></div>`

/** The 막대's silk tile height (px on screen). */
export const BAR_TILE = BT
export const BAR_SPARKLE_SVG =
  `<svg viewBox="-16 -16 32 32" width="32" height="32" style="overflow:visible;display:block;filter:drop-shadow(0 0 3px rgba(255,255,255,0.7))">` +
  `<circle r="9" fill="rgba(220,228,245,0.22)" class="sl-glow" style="transform-box:fill-box;transform-origin:center;animation:auraBreath 1.8s ease-in-out infinite"></circle>` +
  `<g class="sl-spin" style="transform-box:fill-box;transform-origin:center;animation:slStar 3.2s ease-in-out infinite"><path d="${SPARKLE_PATH}" fill="#ffffff"></path></g>` +
  `</svg>`

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
/** Around the frame: flung outward from the silk rings, past the dark disc (sizes follow --av). */
const FRAME_SPILL = (() => {
  const r = seeded(53); let out = ''
  for (let i = 0; i < 28; i++) {
    const a = r() * 360, r0 = 0.62 + r() * 0.1, r1 = 0.92 + r() * 0.3, dur = 1.8 + r() * 2
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
