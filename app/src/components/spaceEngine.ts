// 인터스텔라's world: a free 3D flight. The ship has a heading (yaw, pitch) and flies along it; a camera follows behind and
// above it, turning after it a moment later. Stars fill the space round the camera (they wrap, so there is no end), and
// planets, suns and black holes are placed in sectors of space by a seeded random, so one that was passed is still there when
// the ship comes back. Each kind of body has its own event (a black hole pulls the ship in, a sun burns, a volcano erupts ...).
// The ship is drawn in the front canvas, stars and bodies in the back one, and the black holes (the film's animated picture)
// are DOM images between them so the picture keeps its animation and full quality.

export type Input = { sx: number; sy: number; boost: boolean }
export type Hud = { dist: number; c: number; found: number; near: { name: string; kind: string; d: number } | null; warn: string; ts: number }
export type Toast = { icon: string; text: string }
export type Engine = {
  attach(back: HTMLCanvasElement, front: HTMLCanvasElement, layer: HTMLElement): void
  detach(): void
  resize(w: number, h: number, dpr: number): void
  frame(now: number, inp: Input): void
  debug(): unknown
  spawn(kind: Kind, dist: number): number
}

export type Kind = 'earth' | 'lava' | 'ice' | 'gas' | 'sun' | 'hole'
type Ring = { nx: number; ny: number; nz: number; a: number; b: number; hue: string }
type Body = {
  id: string; kind: Kind; name: string; x: number; y: number; z: number; r: number; seed: number
  sprite: HTMLCanvasElement | null; ring: Ring | null; found: boolean; cool: Record<string, number>; side: number
}
type Bas = { rx: number; ry: number; rz: number; ux: number; uy: number; uz: number; fx: number; fy: number; fz: number }
type Face = { p: Float32Array; n: Float32Array; k: number; ring: boolean; gain: number; win: boolean }
type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; c: string; on: boolean }

const TAU = Math.PI * 2
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3)
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const angDiff = (a: number, b: number) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d }

const KIND_NAME: Record<Kind, string> = { earth: '지구형 행성', lava: '용암 행성', ice: '얼음 행성', gas: '가스 행성', sun: '항성', hole: '블랙홀' }

const SECTOR = 40000 // the world is cut into cubes this wide; each is filled by its own seeded random
const STAR_BOX = 3000 // the stars fill a box this wide round the camera (it wraps)
const STARS = 1100
const SHIP_R = 60 // the ring's radius (ship units = world units)
const MODULES = 12
const CRUISE = 420 // world units a second; the boost is five times that
const BOOST = 2200
const CAM_BACK = 360 // the camera's distance behind the ship
const MAXN = 8
const HOLE_IMG = { w: 600, h: 360, cx: 300, cy: 180, shadow: 62 } // the film's picture: its size and the hole's shadow in it

// ---- seeded random and noise ----

function rngOf(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
function hash3(a: number, b: number, c: number) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = smooth(0, 1, x - xi), yf = smooth(0, 1, y - yi), zf = smooth(0, 1, z - zi)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf), yf),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf), yf), zf)
}
function fbm(x: number, y: number, z: number, oct = 4) {
  let a = 0, f = 1, s = 0.5, tot = 0
  for (let i = 0; i < oct; i++) { a += s * vnoise(x * f, y * f, z * f); tot += s; f *= 2; s *= 0.5 }
  return a / tot
}

// ---- camera basis: right, up, forward for a heading and a bank (positive = right wing down) ----

function basis(yaw: number, pitch: number, bank: number): Bas {
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch)
  const r0x = cy, r0z = -sy, u0x = -sy * sp, u0y = cp, u0z = -cy * sp
  const sb = Math.sin(bank), cb = Math.cos(bank)
  return { rx: r0x * cb - u0x * sb, ry: -u0y * sb, rz: r0z * cb - u0z * sb, ux: r0x * sb + u0x * cb, uy: u0y * cb, uz: r0z * sb + u0z * cb, fx: sy * cp, fy: sp, fz: cy * cp }
}

// ---- the ship's model (built once) ----

type V3 = { x: number; y: number; z: number }
const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z })
const addv = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
const mulv = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k)

function addPoly(out: Face[], pts: V3[], n: V3, ring: boolean, gain: number, win = false) {
  const p = new Float32Array(pts.length * 3)
  pts.forEach((q, i) => { p[i * 3] = q.x; p[i * 3 + 1] = q.y; p[i * 3 + 2] = q.z })
  out.push({ p, n: Float32Array.of(n.x, n.y, n.z), k: pts.length, ring, gain, win })
}
function addBox(out: Face[], c: V3, axes: [V3, V3, V3], half: [number, number, number], ring: boolean, gain: number, winAxis = -1) {
  for (let k = 0; k < 3; k++) {
    const o1 = (k + 1) % 3, o2 = (k + 2) % 3
    for (const s of [-1, 1]) {
      const mid = addv(c, mulv(axes[k], s * half[k]))
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => addv(mid, addv(mulv(axes[o1], p * half[o1]), mulv(axes[o2], q * half[o2]))))
      addPoly(out, pts, mulv(axes[k], s), ring, gain, k === winAxis)
    }
  }
}
function addPrism(out: Face[], rad: number, z0: number, z1: number, gain: number) {
  const n = MAXN, ang = (i: number) => (i / n) * TAU
  for (let i = 0; i < n; i++) {
    const a0 = ang(i), a1 = ang(i + 1), am = (a0 + a1) / 2
    addPoly(out, [v3(rad * Math.cos(a0), rad * Math.sin(a0), z0), v3(rad * Math.cos(a1), rad * Math.sin(a1), z0), v3(rad * Math.cos(a1), rad * Math.sin(a1), z1), v3(rad * Math.cos(a0), rad * Math.sin(a0), z1)], v3(Math.cos(am), Math.sin(am), 0), false, gain)
  }
  const cap = (z: number) => Array.from({ length: n }, (_, i) => v3(rad * Math.cos(ang(i)), rad * Math.sin(ang(i)), z))
  addPoly(out, cap(z0), v3(0, 0, -1), false, gain)
  addPoly(out, cap(z1).reverse(), v3(0, 0, 1), false, gain)
}
let MODEL: Face[] | null = null
function model(): Face[] {
  if (MODEL) return MODEL
  const out: Face[] = [], Z = v3(0, 0, 1)
  for (let i = 0; i < MODULES; i++) {
    const a = (i / MODULES) * TAU
    const r = v3(Math.cos(a), Math.sin(a), 0), t = v3(-Math.sin(a), Math.cos(a), 0)
    addBox(out, mulv(r, SHIP_R), [t, r, Z], [11, 13, 10], true, 1, 2)
    addBox(out, mulv(r, SHIP_R + 16), [t, r, Z], [6, 3, 6], true, 0.55)
    addBox(out, mulv(r, SHIP_R - 15), [t, r, Z], [4, 2, 4], true, 0.55)
    const am = a + Math.PI / MODULES
    const rm = v3(Math.cos(am), Math.sin(am), 0), tm = v3(-Math.sin(am), Math.cos(am), 0)
    addBox(out, mulv(rm, SHIP_R * Math.cos(Math.PI / MODULES)), [tm, rm, Z], [7, 2, 2], true, 0.6)
  }
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    const r = v3(Math.cos(a), Math.sin(a), 0), t = v3(-Math.sin(a), Math.cos(a), 0)
    addBox(out, mulv(r, 26.5), [t, r, Z], [1.6, 16.5, 1.6], true, 0.6)
  }
  addPrism(out, 9, -34, 34, 0.85)
  addPrism(out, 12, -4, 4, 0.55)
  addPrism(out, 6, -41, -34, 0.5)
  MODEL = out
  return out
}

// ---- planets: a picture of each, made once from noise on a sphere ----

type Pal = [number, number, number][]
const GAS_PALS: Pal[] = [[[214, 170, 120], [168, 118, 78], [236, 208, 166]], [[120, 160, 190], [70, 110, 150], [190, 215, 230]], [[200, 140, 160], [140, 90, 130], [235, 200, 205]]]
const mix3 = (a: number[], b: number[], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

function planetSprite(b: Body): HTMLCanvasElement {
  const N = 200, cv = document.createElement('canvas')
  cv.width = cv.height = N
  const cx = cv.getContext('2d')
  if (!cx) return cv
  const img = cx.createImageData(N, N), d = img.data
  const rnd = rngOf(b.seed)
  const off = (b.seed % 977) * 1.37
  const pal = GAS_PALS[Math.floor(rnd() * 3)], bands = 8 + rnd() * 8
  const spot = { x: (rnd() - 0.5) * 0.9, y: 0.12 + rnd() * 0.4 }
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const nx = ((px + 0.5) / N) * 2 - 1, ny = ((py + 0.5) / N) * 2 - 1, rr = nx * nx + ny * ny
      if (rr > 1) continue
      const nz = Math.sqrt(1 - rr), X = nx, Y = -ny, Z = nz
      let c: number[]
      if (b.kind === 'earth') {
        const h = fbm(X * 2.2 + off, Y * 2.2, Z * 2.2, 5)
        if (h < 0.5) c = mix3([8, 52, 120], [40, 120, 200], h * 2)
        else c = mix3([44, 122, 58], [150, 126, 76], clamp((h - 0.5) * 3.2, 0, 1))
        if (Math.abs(Y) + fbm(X * 4, Y * 4, Z * 4 + off, 2) * 0.12 > 0.9) c = [236, 242, 250]
        const cl = fbm(X * 3.1 + off * 2, Y * 3.1, Z * 3.1, 4)
        if (cl > 0.56) c = mix3(c, [255, 255, 255], clamp((cl - 0.56) * 3.2, 0, 0.92))
      } else if (b.kind === 'lava') {
        const base = fbm(X * 5 + off, Y * 5, Z * 5, 4)
        const ridge = 1 - Math.abs(2 * fbm(X * 3 + off, Y * 3, Z * 3, 4) - 1)
        const crack = smooth(0.8, 0.96, ridge)
        c = mix3([34, 24, 22], [78, 52, 44], base)
        c = mix3(c, [255, 128, 30], crack)
      } else if (b.kind === 'ice') {
        const frost = fbm(X * 4 + off, Y * 4, Z * 4, 4)
        const ridge = 1 - Math.abs(2 * fbm(X * 5 + off, Y * 5, Z * 5, 3) - 1)
        c = mix3([196, 224, 242], [236, 246, 252], frost)
        c = mix3(c, [96, 150, 204], smooth(0.84, 0.97, ridge) * 0.85)
      } else {
        const warp = fbm(X * 1.6 + off, Y * 0.8, Z * 1.6, 3) * 5
        const band = Math.sin(Y * bands + warp) * 0.5 + 0.5
        c = mix3(mix3(pal[0], pal[1], band), pal[2], fbm(X * 2.4 + off, Y * 6, Z * 2.4, 3) * 0.7)
        const sx = (X - spot.x) / 0.22, sy = (Y - spot.y) / 0.1
        const sp = 1 - Math.sqrt(sx * sx + sy * sy)
        if (sp > 0 && Z > 0.2) c = mix3(c, [186, 70, 52], smooth(0, 0.5, sp) * 0.8)
      }
      const limb = 0.6 + 0.4 * Math.pow(nz, 0.6)
      const a = clamp((1 - Math.sqrt(rr)) * N * 0.5, 0, 1)
      const i = (py * N + px) * 4
      d[i] = c[0] * limb; d[i + 1] = c[1] * limb; d[i + 2] = c[2] * limb; d[i + 3] = a * 255
    }
  }
  cx.putImageData(img, 0, 0)
  return cv
}

const NAME_HEAD = ['케플러', '글리제', '프록시마', '트라피스트', '카이퍼', 'HD', 'TOI', '라그랑주', '알데바란', '베가']
function nameOf(rnd: () => number, kind: Kind) {
  const head = NAME_HEAD[Math.floor(rnd() * NAME_HEAD.length)], num = 100 + Math.floor(rnd() * 900), letter = 'bcdef'[Math.floor(rnd() * 5)]
  if (kind === 'sun') return `${head}-${num}`
  if (kind === 'hole') return `${head} 블랙홀 ${num}`
  return `${head}-${num}${letter}`
}

function makeBody(id: string, kind: Kind, x: number, y: number, z: number, r: number, seed: number, name?: string): Body {
  const rnd = rngOf(seed ^ 0x9e3779b1)
  let ring: Ring | null = null
  if (kind === 'gas' && rnd() < 0.55) {
    const tx = (rnd() - 0.5) * 0.9, tz = (rnd() - 0.5) * 0.9, l = Math.hypot(tx, 1, tz)
    ring = { nx: tx / l, ny: 1 / l, nz: tz / l, a: 1.4, b: 2.3, hue: rnd() < 0.5 ? '226,208,170' : '190,200,222' }
  }
  return { id, kind, name: name ?? nameOf(rnd, kind), x, y, z, r, seed, sprite: null, ring, found: false, cool: {}, side: 0 }
}

const RADIUS: Record<Kind, [number, number]> = { earth: [600, 1000], lava: [500, 900], ice: [600, 1100], gas: [1200, 2200], sun: [2500, 4000], hole: [700, 900] }
const WEIGHTS: [Kind, number][] = [['earth', 0.17], ['lava', 0.14], ['ice', 0.15], ['gas', 0.28], ['sun', 0.17], ['hole', 0.09]]
function pickKind(r: number): Kind {
  let acc = 0
  for (const [k, w] of WEIGHTS) { acc += w; if (r < acc) return k }
  return 'gas'
}

export function createEngine(base: string, cb: { hud: (h: Hud) => void; toast: (t: Toast) => void }): Engine {
  const salt = Math.floor(Math.random() * 1e9)
  let back: HTMLCanvasElement | null = null, front: HTMLCanvasElement | null = null, layer: HTMLElement | null = null
  // the two canvases' pens; they are only used while the canvases are attached (frame checks that)
  let bx = null as unknown as CanvasRenderingContext2D, fx = null as unknown as CanvasRenderingContext2D
  let W = 1, H = 1, dpr = 1
  const holeNodes: HTMLDivElement[] = []

  // the ship, the camera behind it
  const ship = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, bank: 0, spin: 0, speed: CRUISE, gx: 0, gy: 0, gz: 0, boost: 0, heat: 0, shake: 0, flash: 0, dist: 0 }
  const cam = { x: 0, y: 0, z: -CAM_BACK, yaw: 0, pitch: 0, roll: 0, dist: 1500, bas: basis(0, 0, 0) }
  const prev = { x: 0, y: 0, z: 0, bas: basis(0, 0, 0), F: 1 }
  let elapsed = 0, hudAt = 0, found = 0, warn = '', lastTs = 1, flashWhite = false, lastFoundToast = -9
  let mode: 'fly' | 'swallow' = 'fly'
  const sw = { t: 0, rx: 0, ry: 0, rz: 0, kx: 0, ky: 1, kz: 0, hole: null as Body | null, p: 0 }
  const trailAcc = { v: 0 }

  // the stars
  const stars = new Float32Array(STARS * 3), starCol: string[] = []
  {
    const r = rngOf(salt)
    for (let i = 0; i < STARS * 3; i++) stars[i] = (r() * 2 - 1) * STAR_BOX
    for (let i = 0; i < STARS; i++) { const q = r(); starCol.push(q < 0.2 ? '190,210,255' : q < 0.32 ? '255,226,190' : '255,255,255') }
  }

  // bodies: a first few placed by hand so there is something to fly to, the rest by sector
  const sectors = new Map<string, Body[]>()
  const extras: Body[] = []
  const start: Body[] = [
    makeBody('s-earth', 'earth', 1500, 350, 7600, 900, salt + 1, '프록시마-b'),
    makeBody('s-sun', 'sun', -11000, 2600, 17000, 3000, salt + 2, '알데바란-402'),
    makeBody('s-hole', 'hole', 11500, -1600, 21000, 800, salt + 3, '가르강튀아'),
    makeBody('s-gas', 'gas', -3200, -900, 12500, 1700, salt + 4, '카이퍼-731c'),
  ]
  start[3].ring = { nx: 0.22, ny: 0.95, nz: 0.2, a: 1.4, b: 2.3, hue: '226,208,170' }
  let list: Body[] = []
  let secKey = ''
  const sectorOf = (v: number) => Math.round(v / SECTOR)
  function ensureSectors() {
    const ix = sectorOf(ship.x), iy = sectorOf(ship.y), iz = sectorOf(ship.z)
    const key = `${ix},${iy},${iz}`
    if (key === secKey) return
    secKey = key
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
      const sx = ix + a, sy = iy + b, sz = iz + c, k = `${sx},${sy},${sz}`
      if (sectors.has(k)) continue
      const rnd = rngOf(hash3(sx, sy, sz) * 4294967296 + salt)
      const out: Body[] = [], q = rnd(), n = q < 0.5 ? 0 : q < 0.92 ? 1 : 2
      for (let i = 0; i < n; i++) {
        const kind = pickKind(rnd()), r = lerp(RADIUS[kind][0], RADIUS[kind][1], rnd())
        const x = (sx + (rnd() - 0.5) * 0.8) * SECTOR, y = (sy + (rnd() - 0.5) * 0.8) * SECTOR, z = (sz + (rnd() - 0.5) * 0.8) * SECTOR
        if (Math.hypot(x, y, z) < 6000) continue
        out.push(makeBody(`${k}#${i}`, kind, x, y, z, r, Math.floor(rnd() * 1e9)))
      }
      sectors.set(k, out)
    }
    for (const k of [...sectors.keys()]) {
      const [a, b, c] = k.split(',').map(Number)
      if (Math.abs(a - ix) > 3 || Math.abs(b - iy) > 3 || Math.abs(c - iz) > 3) sectors.delete(k)
    }
    for (let i = extras.length - 1; i >= 0; i--) if (Math.hypot(extras[i].x - ship.x, extras[i].y - ship.y, extras[i].z - ship.z) > 120000) extras.splice(i, 1)
    list = [...start, ...extras, ...[...sectors.values()].flat()]
  }

  // particles
  const parts: Particle[] = Array.from({ length: 700 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, c: '255,255,255', on: false }))
  let pi = 0
  function emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, c: string) {
    const p = parts[pi]; pi = (pi + 1) % parts.length
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life; p.size = size; p.c = c; p.on = true
  }
  const rnd = Math.random
  const randDir = () => { const a = rnd() * TAU, z = rnd() * 2 - 1, s = Math.sqrt(1 - z * z); return v3(s * Math.cos(a), z, s * Math.sin(a)) }

  const toast = (icon: string, text: string) => cb.toast({ icon, text })
  /** Runs `f` at most once every `every` seconds for this body and event. */
  const once = (b: Body, key: string, every: number, f: () => void) => { if (elapsed - (b.cool[key] ?? -1e9) >= every) { b.cool[key] = elapsed; f() } }

  // the radio pulses of a planet with life, drawn as rings round it
  const pulses: { t: number; id: string }[] = []

  function exitHole(h: Body) {
    const dir = randDir(), dist = 56000 + rnd() * 20000
    ship.x = h.x + dir.x * dist; ship.y = h.y + dir.y * dist * 0.4; ship.z = h.z + dir.z * dist
    ship.yaw = rnd() * TAU; ship.pitch = 0; ship.bank = 0
    cam.yaw = ship.yaw; cam.pitch = 0; cam.roll = 0; cam.dist = 380
    ship.gx = ship.gy = ship.gz = 0; ship.speed = CRUISE; ship.shake = 0; ship.heat = 0
    ship.flash = 1.4; flashWhite = true
    h.cool.swallow = elapsed
    secKey = ''
    // somewhere to go: a planet or a star ahead
    const kind = pickKind(rnd() * 0.91), r = lerp(RADIUS[kind][0], RADIUS[kind][1], rnd())
    const fz = basis(ship.yaw, 0, 0), dd = 9000
    extras.push(makeBody(`x${elapsed}`, kind, ship.x + fz.fx * dd + (rnd() - 0.5) * 1500, ship.y + (rnd() - 0.5) * 1500, ship.z + fz.fz * dd, r, Math.floor(rnd() * 1e9)))
    ensureSectors()
    mode = 'fly'
    sw.hole = null
    toast('🌌', '블랙홀을 지나 새로운 별빛 속으로 나왔어요')
  }

  function frame(now: number, inp: Input) {
    if (!back || !front) return
    const t = now / 1000
    const rawDt = lastTs < 0 ? 0 : Math.min(0.05, t - lastTs)
    if (lastTs === 1) { lastTs = t; return }
    lastTs = t
    // time slows near a black hole
    let ts = 1
    for (const b of list) {
      if (b.kind !== 'hole') continue
      const d = Math.hypot(b.x - ship.x, b.y - ship.y, b.z - ship.z)
      ts = Math.min(ts, 0.5 + 0.5 * smooth(b.r * 1.5, b.r * 6, d))
    }
    const dt = rawDt * ts
    elapsed += dt
    ensureSectors()

    // ---- the ship ----
    if (mode === 'fly') {
      const sx = clamp(inp.sx, -1, 1), sy = clamp(inp.sy, -1, 1)
      ship.yaw += sx * 1.1 * dt // tilt right: turn right
      const kp = 1 - Math.exp(-dt * 2.2)
      ship.pitch += (-sy * 0.95 - ship.pitch) * kp // phone raised: the nose goes up; lowered: down
      ship.pitch = clamp(ship.pitch, -1.2, 1.2)
      ship.bank += (sx * 0.8 - ship.bank) * (1 - Math.exp(-dt * 4))
      ship.boost += ((inp.boost ? 1 : 0) - ship.boost) * (1 - Math.exp(-dt * 2.5))
      const target = lerp(CRUISE, BOOST, ship.boost)
      ship.speed += (target - ship.speed) * (1 - Math.exp(-dt * 2))
    }
    ship.spin += dt * (0.45 + ship.speed / 1400)
    const f = basis(ship.yaw, ship.pitch, 0)

    let nearHole: Body | null = null
    warn = ''
    let heatTarget = 0, shakeT = 0, slow = 1
    if (mode === 'fly') {
      for (const b of list) {
        const dx = b.x - ship.x, dy = b.y - ship.y, dz = b.z - ship.z, d = Math.hypot(dx, dy, dz)
        const nx = dx / d, ny = dy / d, nz = dz / d
        if (!b.found && d < 32000) {
          b.found = true; found++
          if (elapsed - lastFoundToast > 2.5) { lastFoundToast = elapsed; toast('🔭', `발견: ${b.name} · ${KIND_NAME[b.kind]}`) }
        }
        const R = b.r
        if (b.kind === 'hole') {
          if (d < R * 9) once(b, 'warn', 25, () => toast('⚠️', '강한 중력이 느껴져요 · 시간이 느려져요'))
          if (d < R * 7) {
            const a = 900 * Math.pow(R / d, 2)
            ship.gx += nx * a * dt; ship.gy += ny * a * dt; ship.gz += nz * a * dt
            warn = `중력 경고 · 블랙홀까지 ${Math.round(d).toLocaleString('ko-KR')} 만km`
            shakeT = Math.max(shakeT, smooth(R * 7, R * 1.6, d) * 5)
            nearHole = b
          }
          if (d < R * 1.35 && elapsed - (b.cool.swallow ?? -1e9) > 25) {
            mode = 'swallow'
            sw.t = 0; sw.hole = b; sw.rx = -dx; sw.ry = -dy; sw.rz = -dz
            // the way round: about the axis across the line to the hole and "up"
            let kx = sw.ry * 0 - sw.rz * 1, ky = 0, kz = sw.rx * 1 - sw.ry * 0
            const kl = Math.hypot(kx, ky, kz)
            if (kl < 1e-3) { kx = 1; ky = 0; kz = 0 } else { kx /= kl; ky /= kl; kz /= kl }
            sw.kx = kx; sw.ky = ky; sw.kz = kz
            toast('🕳️', '블랙홀에 빨려 들어가요!'); flashWhite = true
          }
        } else if (b.kind === 'sun') {
          if (d < R * 4) { heatTarget = Math.max(heatTarget, smooth(R * 4, R * 1.5, d)); warn = '🔥 항성 복사열 · 선체 온도 상승' ; once(b, 'near', 40, () => toast('☀️', '항성에 가까워요 · 복사열 경고')) }
          if (d < R * 1.12) {
            // pushed back by the storm of light
            ship.gx -= nx * 3000 * dt; ship.gy -= ny * 3000 * dt; ship.gz -= nz * 3000 * dt
            shakeT = Math.max(shakeT, 6)
            once(b, 'push', 6, () => toast('🔥', '복사열 폭풍에 밀려났어요'))
          }
          if (d < R * 10) once(b, 'flare', 9 + (b.seed % 7), () => {
            toast('🌞', '태양 플레어 발생!')
            ship.flash = Math.max(ship.flash, 0.35); flashWhite = false
            for (let i = 0; i < 70; i++) {
              const u = randDir()
              emit(b.x + u.x * R, b.y + u.y * R, b.z + u.z * R, u.x * (500 + rnd() * 1500), u.y * (500 + rnd() * 1500), u.z * (500 + rnd() * 1500), 2.5 + rnd() * 2, 40 + rnd() * 60, '255,170,60')
            }
          })
        } else if (b.kind === 'earth') {
          if (d < R * 3.4) once(b, 'signal', 60, () => { toast('📡', '생명 신호를 수신했어요'); pulses.push({ t: 0, id: b.id }) })
          if (d < R * 5 && Math.floor(elapsed / 1.4) !== Math.floor((elapsed - dt) / 1.4)) pulses.push({ t: 0, id: b.id })
        } else if (b.kind === 'lava') {
          if (d < R * 3.2) {
            once(b, 'erupt', 50, () => toast('🌋', '화산이 폭발해요! 선체 온도를 조심하세요'))
            heatTarget = Math.max(heatTarget, 0.55 * smooth(R * 3.2, R * 1.3, d))
            const n = Math.floor(dt * 40 + rnd())
            for (let i = 0; i < n; i++) {
              const u = randDir()
              if (u.x * -nx + u.y * -ny + u.z * -nz < 0) { u.x = -u.x; u.y = -u.y; u.z = -u.z }
              emit(b.x + u.x * R, b.y + u.y * R, b.z + u.z * R, u.x * (350 + rnd() * 700), u.y * (350 + rnd() * 700), u.z * (350 + rnd() * 700), 2 + rnd() * 2, 16 + rnd() * 24, rnd() < 0.5 ? '255,120,30' : '255,200,80')
            }
          }
        } else if (b.kind === 'ice') {
          if (d < R * 3) {
            once(b, 'ice', 50, () => toast('❄️', '얼음 결정 구름을 지나요 · 속도가 줄어요'))
            if (d < R * 2.2) slow = Math.min(slow, 0.82)
            const n = Math.floor(dt * 50 + rnd())
            for (let i = 0; i < n; i++) emit(ship.x + (rnd() - 0.5) * 900 + f.fx * 500, ship.y + (rnd() - 0.5) * 900 + f.fy * 500, ship.z + (rnd() - 0.5) * 900 + f.fz * 500, 0, 0, 0, 1.6, 6 + rnd() * 6, '200,235,255')
          }
        } else if (b.kind === 'gas') {
          if (d < R * 1.7) {
            once(b, 'atmo', 40, () => toast('🌪️', '대기권 상층에 들어왔어요 · 난기류'))
            shakeT = Math.max(shakeT, 3 * smooth(R * 1.7, R * 1.1, d))
            heatTarget = Math.max(heatTarget, 0.3 * smooth(R * 1.7, R * 1.1, d))
          }
          if (b.ring) {
            const rg = b.ring, rx = ship.x - b.x, ry = ship.y - b.y, rz = ship.z - b.z
            const sd = rx * rg.nx + ry * rg.ny + rz * rg.nz, rho = Math.hypot(rx - sd * rg.nx, ry - sd * rg.ny, rz - sd * rg.nz)
            if (b.side !== 0 && Math.sign(sd) !== b.side && rho > R * rg.a && rho < R * rg.b) {
              once(b, 'ring', 8, () => {
                toast('💎', '고리를 통과해요')
                for (let i = 0; i < 80; i++) emit(ship.x + (rnd() - 0.5) * 300, ship.y + (rnd() - 0.5) * 300, ship.z + (rnd() - 0.5) * 300, (rnd() - 0.5) * 400, (rnd() - 0.5) * 400, (rnd() - 0.5) * 400, 1.8, 7 + rnd() * 7, rg.hue)
              })
              shakeT = Math.max(shakeT, 2)
            }
            b.side = Math.sign(sd) || 1
          }
        }
        // solid: planets and suns push the ship out
        if (b.kind !== 'hole' && d < R * 1.04 + 70) {
          const push = R * 1.04 + 70 - d
          ship.x -= nx * push; ship.y -= ny * push; ship.z -= nz * push
          ship.speed *= 0.6
          shakeT = Math.max(shakeT, 6)
          once(b, 'hit', 3, () => toast('💥', '부딪혔어요! 선체가 흔들려요'))
        }
      }
      // the hole's pull stays a while; away from every hole it fades
      if (!nearHole) { const k = Math.exp(-dt * 1.1); ship.gx *= k; ship.gy *= k; ship.gz *= k }
      ship.x += (f.fx * ship.speed * slow + ship.gx) * dt
      ship.y += (f.fy * ship.speed * slow + ship.gy) * dt
      ship.z += (f.fz * ship.speed * slow + ship.gz) * dt
      ship.dist += ship.speed * slow * dt
    } else if (sw.hole) {
      // falling in: a spiral that tightens, the ship turned to face the hole and stretched along its fall
      const h = sw.hole
      sw.t += rawDt
      const p = clamp(sw.t / 4.6, 0, 1)
      sw.p = p
      const rf = Math.max(0.02, 1 - Math.pow(p, 1.25)), ang = p * p * 11
      const c = Math.cos(ang), s = Math.sin(ang)
      const kd = sw.kx * sw.rx + sw.ky * sw.ry + sw.kz * sw.rz
      const cxp = sw.ky * sw.rz - sw.kz * sw.ry, cyp = sw.kz * sw.rx - sw.kx * sw.rz, czp = sw.kx * sw.ry - sw.ky * sw.rx
      const px = sw.rx * c + cxp * s + sw.kx * kd * (1 - c), py = sw.ry * c + cyp * s + sw.ky * kd * (1 - c), pz = sw.rz * c + czp * s + sw.kz * kd * (1 - c)
      ship.x = h.x + px * rf; ship.y = h.y + py * rf; ship.z = h.z + pz * rf
      const fl = Math.hypot(px, py, pz) || 1
      const wantYaw = Math.atan2(-px / fl, -pz / fl), wantPitch = Math.asin(clamp(-py / fl, -1, 1))
      ship.yaw += angDiff(ship.yaw, wantYaw) * (1 - Math.exp(-rawDt * 6))
      ship.pitch += (wantPitch - ship.pitch) * (1 - Math.exp(-rawDt * 6))
      ship.bank += (0.6 - ship.bank) * (1 - Math.exp(-rawDt * 3))
      shakeT = p * 8
      cam.roll += rawDt * (0.4 + p * 7)
      ship.flash = Math.max(ship.flash, smooth(0.84, 1, p))
      if (sw.t > 4.8) exitHole(h)
    }
    ship.heat += (heatTarget - ship.heat) * (1 - Math.exp(-rawDt * 2))
    ship.shake += (shakeT - ship.shake) * (1 - Math.exp(-rawDt * 8))
    if (ship.flash > 0 && mode === 'fly') ship.flash = Math.max(0, ship.flash - rawDt * 0.9)

    // ---- the camera follows ----
    const kc = 1 - Math.exp(-rawDt * 3.4)
    cam.yaw += angDiff(cam.yaw, ship.yaw) * kc
    cam.pitch += (ship.pitch * 0.8 - cam.pitch) * (1 - Math.exp(-rawDt * 3))
    if (mode === 'fly') { cam.roll += (ship.bank * 0.4 - cam.roll) * (1 - Math.exp(-rawDt * 3)); cam.roll = clamp(cam.roll, -1, 1) }
    const intro = ease(elapsed / 2.2)
    cam.dist = mode === 'fly' ? lerp(1700, CAM_BACK, intro) * (1 + ship.boost * 0.12) : CAM_BACK
    const cb0 = basis(cam.yaw, cam.pitch, 0)
    cam.x = ship.x - cb0.fx * cam.dist + cb0.ux * 50
    cam.y = ship.y - cb0.fy * cam.dist + cb0.uy * 50
    cam.z = ship.z - cb0.fz * cam.dist + cb0.uz * 50
    cam.bas = basis(cam.yaw, cam.pitch, cam.roll)
    const shx = (rnd() - 0.5) * ship.shake, shy = (rnd() - 0.5) * ship.shake
    const F = (Math.min(W, H) * 0.95) / (1 + ship.boost * 0.2)
    const cx = W / 2 + shx, cy = H / 2 + shy
    const cbs = cam.bas

    // helpers on this frame's camera
    const proj = (x: number, y: number, z: number, o: number[]) => {
      const vx = x - cam.x, vy = y - cam.y, vz = z - cam.z
      const zc = vx * cbs.fx + vy * cbs.fy + vz * cbs.fz
      o[0] = cx + ((vx * cbs.rx + vy * cbs.ry + vz * cbs.rz) * F) / zc
      o[1] = cy - ((vx * cbs.ux + vy * cbs.uy + vz * cbs.uz) * F) / zc
      o[2] = zc
    }
    const pa = prev.bas, pF = prev.F
    const projPrev = (x: number, y: number, z: number, o: number[]) => {
      const vx = x - prev.x, vy = y - prev.y, vz = z - prev.z
      const zc = vx * pa.fx + vy * pa.fy + vz * pa.fz
      o[0] = cx + ((vx * pa.rx + vy * pa.ry + vz * pa.rz) * pF) / zc
      o[1] = cy - ((vx * pa.ux + vy * pa.uy + vz * pa.uz) * pF) / zc
      o[2] = zc
    }
    const sp = [0, 0, 0], sq = [0, 0, 0]
    // the sun's light as the camera sees it (a fixed direction in the world)
    const Lw = { x: -0.5, y: 0.65, z: -0.55 }
    const Ll = Math.hypot(Lw.x, Lw.y, Lw.z)
    const Lc = { x: (Lw.x * cbs.rx + Lw.y * cbs.ry + Lw.z * cbs.rz) / Ll, y: (Lw.x * cbs.ux + Lw.y * cbs.uy + Lw.z * cbs.uz) / Ll, z: (Lw.x * cbs.fx + Lw.y * cbs.fy + Lw.z * cbs.fz) / Ll }

    // ---- bodies as the camera sees them ----
    type Seen = { b: Body; x: number; y: number; zc: number; rpx: number; d: number }
    const seen: Seen[] = []
    for (const b of list) {
      proj(b.x, b.y, b.z, sp)
      const d = Math.hypot(b.x - cam.x, b.y - cam.y, b.z - cam.z)
      if (sp[2] < 5 && d > b.r * 1.3) { seen.push({ b, x: sp[0], y: sp[1], zc: sp[2], rpx: 0, d }); continue }
      seen.push({ b, x: sp[0], y: sp[1], zc: sp[2], rpx: (b.r * F) / Math.max(sp[2], 1), d })
    }
    seen.sort((p, q) => q.d - p.d)
    let lens: { x: number; y: number; r: number } | null = null
    for (const s of seen) if (s.b.kind === 'hole' && s.zc > 5 && s.rpx > 4 && (!lens || s.rpx > lens.r)) lens = { x: s.x, y: s.y, r: s.rpx }

    // ================= back canvas =================
    bx.setTransform(dpr, 0, 0, dpr, 0, 0)
    bx.fillStyle = '#000'
    bx.fillRect(0, 0, W, H)
    const bst = ship.boost
    for (let i = 0; i < STARS; i++) {
      const wx = ((((stars[i * 3] - cam.x + STAR_BOX) % (2 * STAR_BOX)) + 2 * STAR_BOX) % (2 * STAR_BOX)) - STAR_BOX
      const wy = ((((stars[i * 3 + 1] - cam.y + STAR_BOX) % (2 * STAR_BOX)) + 2 * STAR_BOX) % (2 * STAR_BOX)) - STAR_BOX
      const wz = ((((stars[i * 3 + 2] - cam.z + STAR_BOX) % (2 * STAR_BOX)) + 2 * STAR_BOX) % (2 * STAR_BOX)) - STAR_BOX
      const zc = wx * cbs.fx + wy * cbs.fy + wz * cbs.fz
      if (zc < 20) continue
      let x = cx + ((wx * cbs.rx + wy * cbs.ry + wz * cbs.rz) * F) / zc, y = cy - ((wx * cbs.ux + wy * cbs.uy + wz * cbs.uz) * F) / zc
      if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue
      if (lens) { // light bends round a black hole: stars near it are pushed outward
        const dx = x - lens.x, dy = y - lens.y, rho = Math.hypot(dx, dy)
        if (rho > lens.r * 0.95 && rho < lens.r * 5) { const k = 1 + (lens.r * lens.r * 1.3) / (rho * rho); x = lens.x + dx * k; y = lens.y + dy * k }
      }
      const near = clamp(1 - zc / 2900, 0, 1)
      const r = 0.4 + near * 1.3
      const alpha = (0.25 + 0.75 * near) * (0.85 + 0.15 * Math.sin(t * 2 + i))
      if (near > 0.25 && rawDt > 0) {
        projPrev(cam.x + wx, cam.y + wy, cam.z + wz, sq)
        if (sq[2] > 5 && Math.hypot(sq[0] - x, sq[1] - y) > 0.8) {
          bx.strokeStyle = `rgba(${starCol[i]},${alpha * (0.45 + 0.4 * bst)})`
          bx.lineWidth = r
          bx.beginPath(); bx.moveTo(sq[0], sq[1]); bx.lineTo(x, y); bx.stroke()
        }
      }
      bx.fillStyle = `rgba(${starCol[i]},${alpha})`
      bx.beginPath(); bx.arc(x, y, r, 0, TAU); bx.fill()
    }

    let spritesMade = 0
    for (const s of seen) {
      const b = s.b
      if (b.kind === 'hole') continue // a DOM image
      if (s.zc < 5) continue
      const rpx = s.rpx, X = s.x, Y = s.y
      const ext = rpx * (b.kind === 'sun' ? 3.4 : b.ring ? 2.4 : 1.3)
      if (X < -ext || X > W + ext || Y < -ext || Y > H + ext) continue
      if (b.kind === 'sun') {
        const gr = Math.max(rpx * 3.4, 12)
        const g = bx.createRadialGradient(X, Y, rpx * 0.3, X, Y, gr)
        g.addColorStop(0, 'rgba(255,238,190,0.85)'); g.addColorStop(0.25, 'rgba(255,170,60,0.4)'); g.addColorStop(1, 'rgba(255,120,20,0)')
        bx.globalCompositeOperation = 'lighter'
        bx.fillStyle = g
        bx.beginPath(); bx.arc(X, Y, gr, 0, TAU); bx.fill()
        bx.globalCompositeOperation = 'source-over'
        const dg = bx.createRadialGradient(X - rpx * 0.2, Y - rpx * 0.2, 0, X, Y, Math.max(rpx, 2))
        dg.addColorStop(0, '#fffbe8'); dg.addColorStop(0.55, '#ffd060'); dg.addColorStop(1, '#ff8a1a')
        bx.fillStyle = dg
        bx.beginPath(); bx.arc(X, Y, Math.max(rpx, 2), 0, TAU); bx.fill()
        if (rpx > 14) { // prominences: slow arcs that rise from the edge
          bx.lineWidth = Math.max(1.5, rpx * 0.04)
          for (let i = 0; i < 5; i++) {
            const a = ((i * 1.3 + t * 0.07 + b.seed) % TAU), L = rpx * (0.05 + 0.07 * Math.sin(t * 0.8 + i * 2))
            bx.strokeStyle = `rgba(255,170,70,${0.3 + 0.2 * Math.sin(t + i)})`
            bx.beginPath()
            bx.moveTo(X + Math.cos(a) * rpx * 0.98, Y + Math.sin(a) * rpx * 0.98)
            bx.quadraticCurveTo(X + Math.cos(a + 0.12) * (rpx + L * 2), Y + Math.sin(a + 0.12) * (rpx + L * 2), X + Math.cos(a + 0.28) * rpx * 0.98, Y + Math.sin(a + 0.28) * rpx * 0.98)
            bx.stroke()
          }
        }
        continue
      }
      if (rpx < 1.8) { bx.fillStyle = 'rgba(210,220,240,0.9)'; bx.beginPath(); bx.arc(X, Y, 1.6, 0, TAU); bx.fill(); continue }
      if (!b.sprite) { if (spritesMade < 1) { b.sprite = planetSprite(b); spritesMade++ } else { bx.fillStyle = '#556'; bx.beginPath(); bx.arc(X, Y, rpx, 0, TAU); bx.fill(); continue } }
      // the ring's far half, the planet, the ring's near half
      const ringSide = (front: boolean) => {
        if (!b.ring) return
        const rg = b.ring
        // two axes in the ring's plane
        let ax = -rg.nz, ay = 0, az = rg.nx
        const al = Math.hypot(ax, az) || 1
        ax /= al; az /= al
        const bx2 = rg.ny * az - rg.nz * ay, by2 = rg.nz * ax - rg.nx * az, bz2 = rg.nx * ay - rg.ny * ax
        for (const [rr, w, al2] of [[1.45, 0.14, 0.5], [1.7, 0.12, 0.68], [1.95, 0.1, 0.5], [2.2, 0.07, 0.34]] as const) {
          bx.strokeStyle = `rgba(${rg.hue},${al2})`
          bx.lineWidth = Math.max(1, b.r * w * F / s.zc)
          let open = false
          for (let i = 0; i <= 72; i++) {
            const a = (i / 72) * TAU, c = Math.cos(a) * b.r * rr, sn = Math.sin(a) * b.r * rr
            proj(b.x + ax * c + bx2 * sn, b.y + ay * c + by2 * sn, b.z + az * c + bz2 * sn, sq)
            const isFront = sq[2] < s.zc
            if (isFront === front && sq[2] > 5) { if (!open) { bx.beginPath(); bx.moveTo(sq[0], sq[1]); open = true } else bx.lineTo(sq[0], sq[1]) }
            else if (open) { bx.stroke(); open = false }
          }
          if (open) bx.stroke()
        }
      }
      ringSide(false)
      // the atmosphere's glow
      const atm = b.kind === 'earth' ? '90,160,255' : b.kind === 'lava' ? '255,110,30' : b.kind === 'ice' ? '170,220,255' : '255,200,150'
      const ag = bx.createRadialGradient(X, Y, rpx * 0.92, X, Y, rpx * 1.22)
      ag.addColorStop(0, `rgba(${atm},0.35)`); ag.addColorStop(1, `rgba(${atm},0)`)
      bx.fillStyle = ag
      bx.beginPath(); bx.arc(X, Y, rpx * 1.22, 0, TAU); bx.fill()
      bx.save()
      bx.beginPath(); bx.arc(X, Y, rpx, 0, TAU); bx.clip()
      bx.drawImage(b.sprite as HTMLCanvasElement, X - rpx, Y - rpx, rpx * 2, rpx * 2)
      // the night side: a gradient across the planet along the light, its edge moving with how the light falls
      const dl = Math.hypot(Lc.x, Lc.y) || 1, dxl = Lc.x / dl, dyl = -Lc.y / dl
      const pt = 0.5 - 0.62 * Lc.z
      const g0 = clamp(pt - 0.28, 0, 1), g1 = clamp(pt + 0.14, 0.001, 1)
      const sh = bx.createLinearGradient(X + dxl * rpx, Y + dyl * rpx, X - dxl * rpx, Y - dyl * rpx)
      sh.addColorStop(g0, 'rgba(0,0,6,0)'); sh.addColorStop(Math.max(g1, g0 + 0.001), 'rgba(0,0,6,0.92)')
      bx.fillStyle = sh
      bx.fillRect(X - rpx, Y - rpx, rpx * 2, rpx * 2)
      if (b.kind === 'lava') { bx.globalCompositeOperation = 'lighter'; bx.globalAlpha = 0.3; bx.drawImage(b.sprite as HTMLCanvasElement, X - rpx, Y - rpx, rpx * 2, rpx * 2); bx.globalAlpha = 1; bx.globalCompositeOperation = 'source-over' }
      bx.restore()
      ringSide(true)
    }

    // the black holes: the film's picture, moved and scaled in the page
    if (layer) {
      let hi = 0
      for (const s of seen) {
        const b = s.b
        if (b.kind !== 'hole') continue
        if (hi >= 3) break
        if (s.zc < 5) continue
        const sc = s.rpx / HOLE_IMG.shadow
        const hw = HOLE_IMG.cx * sc
        if (sc < 0.04 || s.x + hw < 0 || s.x - hw > W || s.y + HOLE_IMG.cy * sc < 0 || s.y - HOLE_IMG.cy * sc > H) continue
        let el = holeNodes[hi]
        if (!el) {
          el = document.createElement('div')
          el.style.cssText = `position:absolute;left:0;top:0;width:${HOLE_IMG.w}px;height:${HOLE_IMG.h}px;transform-origin:${HOLE_IMG.cx}px ${HOLE_IMG.cy}px;will-change:transform;pointer-events:none`
          const disc = document.createElement('div')
          disc.style.cssText = `position:absolute;left:${HOLE_IMG.cx - 61}px;top:${HOLE_IMG.cy - 61}px;width:122px;height:122px;border-radius:50%;background:#000`
          const img = document.createElement('img')
          img.src = `${base}garg/gargantua.v4.webp`
          img.alt = ''; img.draggable = false
          img.style.cssText = `position:absolute;left:0;top:0;width:${HOLE_IMG.w}px;height:${HOLE_IMG.h}px;display:block`
          el.append(disc, img)
          layer.appendChild(el)
          holeNodes[hi] = el
        }
        el.style.display = 'block'
        el.style.transform = `translate3d(${s.x - HOLE_IMG.cx}px,${s.y - HOLE_IMG.cy}px,0) rotate(${-cam.roll}rad) scale(${Math.min(sc, 24)})`
        hi++
      }
      for (let i = hi; i < holeNodes.length; i++) holeNodes[i].style.display = 'none'
    }

    // ================= front canvas =================
    fx.setTransform(dpr, 0, 0, dpr, 0, 0)
    fx.clearRect(0, 0, W, H)

    // the ship's trail and the events' particles
    if (mode === 'fly') {
      trailAcc.v += dt * (30 + ship.boost * 90)
      while (trailAcc.v >= 1) {
        trailAcc.v -= 1
        emit(ship.x - f.fx * 46 + (rnd() - 0.5) * 14, ship.y - f.fy * 46 + (rnd() - 0.5) * 14, ship.z - f.fz * 46 + (rnd() - 0.5) * 14, -f.fx * 30, -f.fy * 30, -f.fz * 30, 0.9 + ship.boost * 0.6, 3.4, '130,185,255')
      }
    }
    fx.globalCompositeOperation = 'lighter'
    for (const p of parts) {
      if (!p.on) continue
      p.life -= rawDt
      if (p.life <= 0) { p.on = false; continue }
      p.x += p.vx * rawDt; p.y += p.vy * rawDt; p.z += p.vz * rawDt
      proj(p.x, p.y, p.z, sp)
      if (sp[2] < 8) continue
      const a = (p.life / p.max) * clamp(sp[2] / 160, 0, 1), r = clamp((p.size * F) / sp[2], 0.7, Math.max(1.4, p.size * 1.1))
      if (sp[0] < -r || sp[0] > W + r || sp[1] < -r || sp[1] > H + r) continue
      fx.fillStyle = `rgba(${p.c},${clamp(a, 0, 1) * 0.85})`
      fx.beginPath(); fx.arc(sp[0], sp[1], r, 0, TAU); fx.fill()
    }
    fx.globalCompositeOperation = 'source-over'

    // the ship itself: from the model's own axes to the camera's
    {
      const sb = basis(ship.yaw, ship.pitch, ship.bank)
      const d = (ax: number, ay: number, az: number, bx2: number, by2: number, bz2: number) => ax * bx2 + ay * by2 + az * bz2
      const R00 = d(cbs.rx, cbs.ry, cbs.rz, sb.rx, sb.ry, sb.rz), R01 = d(cbs.rx, cbs.ry, cbs.rz, sb.ux, sb.uy, sb.uz), R02 = d(cbs.rx, cbs.ry, cbs.rz, sb.fx, sb.fy, sb.fz)
      const R10 = d(cbs.ux, cbs.uy, cbs.uz, sb.rx, sb.ry, sb.rz), R11 = d(cbs.ux, cbs.uy, cbs.uz, sb.ux, sb.uy, sb.uz), R12 = d(cbs.ux, cbs.uy, cbs.uz, sb.fx, sb.fy, sb.fz)
      const R20 = d(cbs.fx, cbs.fy, cbs.fz, sb.rx, sb.ry, sb.rz), R21 = d(cbs.fx, cbs.fy, cbs.fz, sb.ux, sb.uy, sb.uz), R22 = d(cbs.fx, cbs.fy, cbs.fz, sb.fx, sb.fy, sb.fz)
      const vx = ship.x - cam.x, vy = ship.y - cam.y, vz = ship.z - cam.z
      const t0 = vx * cbs.rx + vy * cbs.ry + vz * cbs.rz, t1 = vx * cbs.ux + vy * cbs.uy + vz * cbs.uz, t2 = vx * cbs.fx + vy * cbs.fy + vz * cbs.fz
      const cs = Math.cos(ship.spin), sn = Math.sin(ship.spin)
      const stretch = mode === 'swallow' ? 1 + 3.5 * sw.p * sw.p : 1, squeeze = mode === 'swallow' ? Math.max(0.25, 1 - 0.75 * sw.p) : 1
      const faces = model()
      const P = scratch.P(faces.length), dep = scratch.dep(faces.length), nrm = scratch.nrm(faces.length), cen = scratch.cen(faces.length)
      const vis = scratch.vis
      vis.length = 0
      const out = [0, 0, 0]
      const xf = (x0: number, y0: number, z0: number, isRing: boolean, o: number[], normal: boolean) => {
        let x = x0, y = y0
        if (isRing) { x = x0 * cs - y0 * sn; y = x0 * sn + y0 * cs }
        if (!normal) { x *= squeeze; y *= squeeze; z0 *= stretch }
        o[0] = R00 * x + R01 * y + R02 * z0 + (normal ? 0 : t0)
        o[1] = R10 * x + R11 * y + R12 * z0 + (normal ? 0 : t1)
        o[2] = R20 * x + R21 * y + R22 * z0 + (normal ? 0 : t2)
      }
      for (let fi = 0; fi < faces.length; fi++) {
        const fc = faces[fi]
        let sx0 = 0, sy0 = 0, sz0 = 0
        for (let i = 0; i < fc.k; i++) {
          xf(fc.p[i * 3], fc.p[i * 3 + 1], fc.p[i * 3 + 2], fc.ring, out, false)
          P[(fi * MAXN + i) * 2] = cx + (out[0] * F) / out[2]
          P[(fi * MAXN + i) * 2 + 1] = cy - (out[1] * F) / out[2]
          sx0 += out[0]; sy0 += out[1]; sz0 += out[2]
        }
        sx0 /= fc.k; sy0 /= fc.k; sz0 /= fc.k
        xf(fc.n[0], fc.n[1], fc.n[2], fc.ring, out, true)
        if (out[0] * sx0 + out[1] * sy0 + out[2] * sz0 >= 0) continue // looks away from the camera
        nrm[fi * 3] = out[0]; nrm[fi * 3 + 1] = out[1]; nrm[fi * 3 + 2] = out[2]
        cen[fi * 3] = sx0; cen[fi * 3 + 1] = sy0; cen[fi * 3 + 2] = sz0
        dep[fi] = sz0
        vis.push(fi)
      }
      vis.sort((p, q) => dep[q] - dep[p])
      const alphaShip = mode === 'swallow' ? 1 - smooth(0.82, 1, sw.p) : 1

      // the ship's glow behind it
      const sxp = cx + (t0 * F) / t2, syp = cy - (t1 * F) / t2
      const rr = (SHIP_R * F) / t2
      const halo = fx.createRadialGradient(sxp, syp, 0, sxp, syp, rr * 1.9)
      halo.addColorStop(0, `rgba(150,185,255,${0.2 * Math.min(1, elapsed)})`)
      halo.addColorStop(1, 'rgba(150,185,255,0)')
      fx.globalAlpha = alphaShip
      fx.fillStyle = halo
      fx.beginPath(); fx.arc(sxp, syp, rr * 1.9, 0, TAU); fx.fill()
      fx.lineJoin = 'round'
      const heat = ship.heat
      for (const fi of vis) {
        const fc = faces[fi], o = fi * MAXN * 2
        const nx = nrm[fi * 3], ny = nrm[fi * 3 + 1], nz = nrm[fi * 3 + 2]
        const cx3 = cen[fi * 3], cy3 = cen[fi * 3 + 1], cz3 = cen[fi * 3 + 2], cl = Math.hypot(cx3, cy3, cz3) || 1
        const vx3 = -cx3 / cl, vy3 = -cy3 / cl, vz3 = -cz3 / cl
        const lit = Math.max(0, nx * Lc.x + ny * Lc.y + nz * Lc.z)
        let hx = Lc.x + vx3, hy = Lc.y + vy3, hz = Lc.z + vz3
        const hl = Math.hypot(hx, hy, hz) || 1
        hx /= hl; hy /= hl; hz /= hl
        const spec = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 28)
        const rim = Math.pow(1 - Math.abs(nx * vx3 + ny * vy3 + nz * vz3), 3)
        const tone = 0.08 + 0.92 * Math.pow(lit, 1.1)
        const shade = (m: number) => {
          const r = clamp(((16 + 220 * tone) * fc.gain + spec * 110 + rim * 24 + heat * 90) * m, 0, 255)
          const g = clamp(((22 + 210 * tone) * fc.gain + spec * 110 + rim * 60 + heat * 30) * m, 0, 255)
          const b = clamp(((38 + 184 * tone) * fc.gain + spec * 110 + rim * 130 - heat * 30) * m, 0, 255)
          return `rgb(${r | 0},${g | 0},${b | 0})`
        }
        fx.beginPath()
        fx.moveTo(P[o], P[o + 1])
        for (let i = 1; i < fc.k; i++) fx.lineTo(P[o + i * 2], P[o + i * 2 + 1])
        fx.closePath()
        const diag = fc.k === 4 ? Math.hypot(P[o + 4] - P[o], P[o + 5] - P[o + 1]) : 0
        if (diag > 9) {
          const gr = fx.createLinearGradient(P[o], P[o + 1], P[o + 4], P[o + 5])
          gr.addColorStop(0, shade(1.18)); gr.addColorStop(1, shade(0.8))
          fx.fillStyle = gr
        } else fx.fillStyle = shade(1)
        fx.fill()
        fx.strokeStyle = `rgba(225,232,245,${0.16 + 0.5 * lit})`
        fx.lineWidth = 0.9
        fx.stroke()
        if (diag > 15) {
          const ccx = (P[o] + P[o + 2] + P[o + 4] + P[o + 6]) / 4, ccy = (P[o + 1] + P[o + 3] + P[o + 5] + P[o + 7]) / 4
          fx.beginPath()
          for (let i = 0; i < 4; i++) {
            const x = ccx + (P[o + i * 2] - ccx) * 0.72, y = ccy + (P[o + i * 2 + 1] - ccy) * 0.72
            if (i === 0) fx.moveTo(x, y)
            else fx.lineTo(x, y)
          }
          fx.closePath()
          fx.fillStyle = 'rgba(0,0,0,0.2)'
          fx.fill()
          fx.strokeStyle = 'rgba(255,255,255,0.09)'
          fx.lineWidth = 0.7
          fx.stroke()
          if (fc.win && diag > 22) {
            const ux = P[o + 2] - P[o], uy = P[o + 3] - P[o + 1], vx2 = P[o + 6] - P[o], vy2 = P[o + 7] - P[o + 1]
            fx.fillStyle = 'rgba(255,226,160,0.92)'
            for (const u of [0.25, 0.5, 0.75]) {
              const wx = P[o] + ux * u + vx2 * 0.5, wy = P[o + 1] + uy * u + vy2 * 0.5
              fx.beginPath()
              fx.moveTo(wx - ux * 0.07 - vx2 * 0.1, wy - uy * 0.07 - vy2 * 0.1)
              fx.lineTo(wx + ux * 0.07 - vx2 * 0.1, wy + uy * 0.07 - vy2 * 0.1)
              fx.lineTo(wx + ux * 0.07 + vx2 * 0.1, wy + uy * 0.07 + vy2 * 0.1)
              fx.lineTo(wx - ux * 0.07 + vx2 * 0.1, wy - uy * 0.07 + vy2 * 0.1)
              fx.closePath(); fx.fill()
            }
          }
        }
      }
      // the engine at the back of the hub, brighter as the ship goes faster
      xf(0, 0, -41, false, out, false)
      if (out[2] > 5) {
        const ex = cx + (out[0] * F) / out[2], ey = cy - (out[1] * F) / out[2]
        const er = ((SHIP_R * 0.5 * F) / out[2]) * (0.8 + 0.2 * Math.sin(t * 7) + ship.boost * 0.9)
        const eg = fx.createRadialGradient(ex, ey, 0, ex, ey, er)
        eg.addColorStop(0, 'rgba(215,238,255,0.95)'); eg.addColorStop(0.25, 'rgba(120,175,255,0.5)'); eg.addColorStop(1, 'rgba(80,130,255,0)')
        fx.globalCompositeOperation = 'lighter'
        fx.fillStyle = eg
        fx.beginPath(); fx.arc(ex, ey, er, 0, TAU); fx.fill()
        fx.globalCompositeOperation = 'source-over'
      }
      fx.globalAlpha = 1
    }

    // radio pulses round a planet with life
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i]
      p.t += rawDt
      if (p.t > 2.4) { pulses.splice(i, 1); continue }
      const s = seen.find(q => q.b.id === p.id)
      if (!s || s.zc < 5) continue
      fx.strokeStyle = `rgba(120,255,190,${0.6 * (1 - p.t / 2.4)})`
      fx.lineWidth = 2
      fx.beginPath(); fx.arc(s.x, s.y, s.rpx * (1.1 + p.t * 0.9) + 4, 0, TAU); fx.stroke()
    }

    // labels and arrows to the bodies nearby
    {
      const font = '600 11px -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif'
      fx.font = font; fx.textAlign = 'center'
      let drawn = 0
      for (let i = seen.length - 1; i >= 0 && drawn < 3; i--) {
        const s = seen[i], b = s.b
        const dd = Math.max(0, Math.hypot(b.x - ship.x, b.y - ship.y, b.z - ship.z) - b.r)
        if (dd > 70000 || !b.found) continue
        drawn++
        const label = `${b.name} · ${Math.round(dd).toLocaleString('ko-KR')}만km`
        const on = s.zc > 5 && s.x > 12 && s.x < W - 12 && s.y > 30 && s.y < H - 30
        if (on && s.rpx > H * 0.22) continue // it fills the view already
        if (on) {
          const r = Math.max(10, s.rpx + 8)
          if (b.kind === 'sun' || s.rpx < 40) {
            fx.strokeStyle = 'rgba(255,255,255,0.45)'; fx.lineWidth = 1
            fx.beginPath(); fx.arc(s.x, s.y, Math.min(r, 80), 0, TAU); fx.stroke()
          }
          fx.lineWidth = 3; fx.strokeStyle = 'rgba(0,0,0,0.65)'; fx.lineJoin = 'round'
          fx.strokeText(label, s.x, Math.min(H - 8, s.y + Math.min(r, 90) + 14))
          fx.fillStyle = 'rgba(255,255,255,0.85)'
          fx.fillText(label, s.x, Math.min(H - 8, s.y + Math.min(r, 90) + 14))
        } else {
          // an arrow at the screen's edge, pointing to it
          let ax = s.x - W / 2, ay = s.y - H / 2
          if (s.zc <= 5) { ax = -ax; ay = -ay }
          const k = Math.min((W / 2 - 22) / Math.abs(ax || 1e-3), (H / 2 - 30) / Math.abs(ay || 1e-3)), px = W / 2 + ax * k, py = H / 2 + ay * k, an = Math.atan2(ay, ax)
          fx.save(); fx.translate(px, py); fx.rotate(an)
          fx.fillStyle = 'rgba(255,255,255,0.75)'
          fx.beginPath(); fx.moveTo(9, 0); fx.lineTo(-5, -6); fx.lineTo(-5, 6); fx.closePath(); fx.fill()
          fx.restore()
          fx.fillStyle = 'rgba(255,255,255,0.6)'
          fx.textAlign = Math.abs(ax) * H > Math.abs(ay) * W ? (ax > 0 ? 'right' : 'left') : 'center'
          fx.fillText(b.name, clamp(px + (ax > 0 ? -14 : 14) * (Math.abs(ax) * H > Math.abs(ay) * W ? 1 : 0), 10, W - 10), clamp(py + (Math.abs(ax) * H > Math.abs(ay) * W ? 4 : ay > 0 ? -12 : 20), 14, H - 6))
          fx.textAlign = 'center'
        }
      }
    }

    // the screen's own effects: heat, the vortex, the flash
    if (ship.heat > 0.02) {
      const hg = fx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75)
      hg.addColorStop(0, 'rgba(255,110,20,0)'); hg.addColorStop(1, `rgba(255,90,10,${ship.heat * 0.55})`)
      fx.fillStyle = hg
      fx.fillRect(0, 0, W, H)
    }
    if (mode === 'swallow') {
      const vg = fx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.7)
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${sw.p * 0.95})`)
      fx.fillStyle = vg
      fx.fillRect(0, 0, W, H)
      fx.fillStyle = `rgba(0,0,0,${smooth(0.5, 0.9, sw.p)})`
      fx.fillRect(0, 0, W, H)
    }
    if (ship.flash > 0.01) {
      fx.fillStyle = flashWhite ? `rgba(255,255,255,${clamp(ship.flash, 0, 1)})` : `rgba(255,170,60,${clamp(ship.flash, 0, 1) * 0.5})`
      fx.fillRect(0, 0, W, H)
    }

    // remember this frame's camera for the next frame's star streaks
    prev.x = cam.x; prev.y = cam.y; prev.z = cam.z; prev.bas = cbs; prev.F = F

    if (t - hudAt > 0.2) {
      hudAt = t
      let near: Hud['near'] = null, bestD = Infinity
      for (const b of list) {
        const dd = Math.hypot(b.x - ship.x, b.y - ship.y, b.z - ship.z) - b.r
        if (b.found && dd < bestD && dd < 70000) { bestD = dd; near = { name: b.name, kind: KIND_NAME[b.kind], d: Math.max(0, dd) } }
      }
      cb.hud({ dist: ship.dist, c: ship.speed * slow / 30 * ts, found, near, warn, ts })
    }
  }

  // buffers for drawing the ship, sized once for the model
  const scratch = (() => {
    let P: Float32Array | null = null, dep: Float32Array | null = null, nrm: Float32Array | null = null, cen: Float32Array | null = null
    return {
      P: (n: number) => (P ??= new Float32Array(n * MAXN * 2)),
      dep: (n: number) => (dep ??= new Float32Array(n)),
      nrm: (n: number) => (nrm ??= new Float32Array(n * 3)),
      cen: (n: number) => (cen ??= new Float32Array(n * 3)),
      vis: [] as number[],
    }
  })()

  ensureSectors()
  return {
    attach(b, f, l) {
      back = b; front = f; layer = l
      bx = b.getContext('2d') as CanvasRenderingContext2D; fx = f.getContext('2d') as CanvasRenderingContext2D
      lastTs = 1
    },
    detach() {
      for (const n of holeNodes) n.remove()
      holeNodes.length = 0
      back = front = layer = null
    },
    resize(w, h, d) {
      W = w; H = h; dpr = d
      if (back) { back.width = Math.round(w * d); back.height = Math.round(h * d) }
      if (front) { front.width = Math.round(w * d); front.height = Math.round(h * d) }
    },
    frame,
    spawn(kind: Kind, dist: number) { // for testing: a body of this kind straight ahead
      const f = basis(ship.yaw, ship.pitch, 0), r = (RADIUS[kind][0] + RADIUS[kind][1]) / 2
      const b = makeBody(`t${extras.length}`, kind, ship.x + f.fx * dist, ship.y + f.fy * dist, ship.z + f.fz * dist, r, salt + extras.length + 9)
      extras.push(b); secKey = ''; ensureSectors(); return b.r
    },
    debug: () => ({ ship, cam: { x: cam.x, y: cam.y, z: cam.z }, mode, bodies: list.filter(b => b.found || b.id.startsWith('s-')).map(b => ({ id: b.id, kind: b.kind, name: b.name, x: b.x, y: b.y, z: b.z, r: b.r })), found }),
  }
}
