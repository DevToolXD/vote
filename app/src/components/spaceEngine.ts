// 인터스텔라's world, in metres and seconds. The Ranger 1 flies by Newton: it keeps the speed it has (a flight computer turns the
// speed round to follow the nose, and caps what the engines will add by how near the nearest thing is), turns by rates about its
// own three axes (so it can roll freely), and a camera follows behind and above. The sky is the stars at infinity and the sun, a
// fixed light the planets, the Endurance and the Ranger are all lit by. At the start there is nothing but a blinking light far
// ahead: the Endurance, spinning on its axis. To dock the Ranger has to come in along the axis nose first, slowly, with its key
// lined up with the port's AND turning with it (spaceDock.ts); the four rings of lights on the port say which of those is wrong.
//
// The Ranger and the Endurance are drawn in the front canvas, stars, sun and planets in the back one, and the black holes (the
// film's animated picture) are DOM images between the two so the picture keeps its animation and full quality.

import { KIND_RADIUS, LANDABLE, hash3, rngOf, smooth, worldOf, type Kind, type RGB } from './spacePlanets'
import { TEX_H, TEX_W, requestTexture, type Tex } from './spaceTexture'
import { ENDURANCE_RING, LIGHT_COLORS, LIGHT_RING, LIGHT_STROBE, MATS, drawPicture, enduranceModel, gearModel, rangerModel, rangerTexture, type Face } from './spaceModels'
import { ES, NOSE, PORT_Z, RS, dockMetrics, dockVerdict, keyDir, wrapPi, type V } from './spaceDock'

export type Input = { yaw: number; pitch: number; roll: number; rollStop: boolean; thrust: boolean; brake: boolean; speedMul: number; undock: boolean }
export type Engine = {
  attach(back: HTMLCanvasElement, front: HTMLCanvasElement, layer: HTMLElement): void
  detach(): void
  resize(w: number, h: number, dpr: number): void
  frame(now: number, inp: Input): void
  debug(): unknown
}
/** What the screen writes: the speed (m/s), the distance to the nearest planet's surface (m) and the hull (100 = whole). */
export type Callbacks = { hud: (h: { speed: number; planet: number; hull: number; note: string; docked: boolean }) => void; haptic: (pattern: number[]) => void }

/** A world drawn as a ball: its picture (lit by the sun, seen from where the camera is), kept until the view has turned enough to need a new one. */
type Ball = { cv: HTMLCanvasElement; img: ImageData; px32: Uint32Array; S: number; ez: V; cr: V }
type Body = {
  id: string; kind: Kind; x: number; y: number; z: number; r: number; seed: number; tex: Tex | null; ball: Ball | null; ring: V | null
  bands: [number, number, number][] | null; tint: [string, string]; atm: string | null; name: string
}
const KIND_NAME: Record<Kind, string> = {
  earth: '지구', moon: '달', mars: '화성', jupiter: '목성', saturn: '토성', neptune: '해왕성', hole: '블랙홀', mercury: '수성', venus: '금성', io: '이오', europa: '유로파',
  titan: '타이탄', pluto: '명왕성', lava: '용암 행성', ocean: '바다 행성', desert: '사막 행성', jungle: '정글 행성', ice: '얼음 행성', uranus: '천왕성', pink: '분홍 가스 행성',
  rock: '암석 행성', gas: '가스 행성',
}

const TAU = Math.PI * 2
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3)

const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V) => Math.hypot(a[0], a[1], a[2])
const norm = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

const SUN: V = norm([-0.5, 0.55, -0.67]) // toward the sun, in the world, the same everywhere (it is that far)
const SECTOR = 1.5e9 // the world is cut into cubes this wide; each is filled by its own seeded random, sparsely
const CAM_BACK = 36 * RS, CAM_RISE = 17 * RS // the camera, behind and above the Ranger (metres)
const PITCH_MAX = 0.7, YAW_MAX = 0.7 // rad/s at a full push (the ship holds its attitude when let go)
const ROLL_ACC = 0.4 // rad/s² while a roll button is held (a tap of a tenth of a second is a few hundredths of a rad/s: fine enough to match the port's turn); the roll then goes on (nothing slows it)
const VMAX_CAP = 6e6 // what the engines add per second at most, far from everything
const VMAX = 1.5e6 // top speed (m/s): fast, but a planet can still be seen coming
const CRASH_V = 12 // into a planet faster than this (m/s) and the Ranger blows up
const RING_REACH = 40 // how close to Saturn's ring plane the ship must be to be hit by the rings (m)
const LAND_H = 500 // below this a ship with its gear down is in the landing approach (m)
const LAND_V = 18, LAND_SIDE = 45 // set down on a world: at most this fast into it and along it (m/s), or it is a crash
const HOVER = 5.3 // the ship's centre above the ground when it stands on its gear (m)
const SKY_H = 1.5e5 // the air thins out to nothing by this height (m)
const HOLE_G = 1.5e7 // m/s² at a black hole's edge
const SHIP_R = 7 * RS // the Ranger's body, for hitting things
const MAXN = 8
const HOLE_IMG = { w: 600, h: 360, cx: 300, cy: 180 } // the film's picture: its size and the centre of the hole in it

/** An Endurance: where, the axes of its own frame (z out of its docking port) and how far it has turned. */
type Station = { p: V; x: V; y: V; z: V; spin: number; w: number; id: number }
function makeStation(p: V, z0: V, spin: number, w: number, id: number): Station {
  const z = norm(z0), x = norm(cross(Math.abs(z[1]) > 0.98 ? [1, 0, 0] : [0, 1, 0], z))
  return { p, x, y: cross(z, x), z, spin, w, id }
}

function makeBody(id: string, kind: Kind, p: V, r: number, seed: number): Body {
  const rnd = rngOf(seed), w = worldOf(kind, seed)
  let ring: V | null = null
  if (kind === 'saturn' || w.bands) { const a = (rnd() - 0.5) * 0.9, b = (rnd() - 0.5) * 0.9; ring = norm([Math.sin(a) * 0.45, 1, Math.sin(b) * 0.45]) }
  const code = id.includes('#') ? ' ' + String.fromCharCode(65 + (seed % 26)) + '-' + (100 + (seed % 900)) : '' // the ones met on the way get a number, like in a catalogue
  return { id, kind, x: p[0], y: p[1], z: p[2], r, seed, tex: null, ball: null, ring, bands: ring ? w.bands : null, tint: w.tint, atm: w.atm, name: KIND_NAME[kind] + code }
}
const WEIGHTS: [Kind, number][] = [
  ['moon', 7], ['mars', 7], ['earth', 5], ['mercury', 6], ['venus', 5], ['io', 5], ['europa', 5], ['titan', 5], ['pluto', 4], ['lava', 5], ['ocean', 4],
  ['desert', 5], ['jungle', 5], ['ice', 5], ['neptune', 5], ['jupiter', 5], ['saturn', 5], ['uranus', 4], ['pink', 4], ['hole', 3],
  ['rock', 140], ['gas', 50], // made from the seed alone: every one different
]
function pickKind(r: number): Kind {
  const total = WEIGHTS.reduce((a, [, w]) => a + w, 0)
  let acc = 0
  for (const [k, w] of WEIGHTS) { acc += w / total; if (r < acc) return k }
  return 'moon'
}

const ballTables = new Map<number, { nx: Float32Array; ny: Float32Array; nz: Float32Array; a: Uint8Array }>()
function tablesOf(S: number) {
  let t = ballTables.get(S)
  if (t) return t
  t = { nx: new Float32Array(S * S), ny: new Float32Array(S * S), nz: new Float32Array(S * S), a: new Uint8Array(S * S) }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const nx = ((i + 0.5) * 2) / S - 1, ny = 1 - ((j + 0.5) * 2) / S, q = nx * nx + ny * ny, k = j * S + i
    t.nx[k] = nx; t.ny[k] = ny; t.nz[k] = Math.sqrt(Math.max(0, 1 - q))
    t.a[k] = Math.round(clamp((1 - Math.sqrt(q)) * S * 0.5, 0, 1) * 255) // a soft edge
  }
  ballTables.set(S, t)
  return t
}
/** A colour of a world's map in the direction w from its centre. */
function texAt(tex: Tex, w: V, o: RGB) {
  if (!tex.px) { o[0] = o[1] = o[2] = 100; return }
  const lon = Math.atan2(w[0], w[2]), lat = Math.asin(clamp(w[1] / (len(w) || 1), -1, 1))
  const u = Math.min(TEX_W - 1, Math.max(0, ((lon / TAU + 0.5) * TEX_W) | 0)), v = Math.min(TEX_H - 1, Math.max(0, ((0.5 - lat / Math.PI) * TEX_H) | 0))
  const t = tex.px[v * TEX_W + u]
  o[0] = t & 255; o[1] = (t >> 8) & 255; o[2] = (t >> 16) & 255
}
/** Paints a world as a ball seen from the direction `ez` (towards the viewer), with screen axes ex (right) and ey (up), lit by the sun. */
function renderBall(b: Body, S: number, ex: V, ey: V, ez: V) {
  const tex = b.tex
  if (!tex || !tex.px) return
  let ball = b.ball
  if (!ball || ball.S !== S) {
    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    const img = (cv.getContext('2d') as CanvasRenderingContext2D).createImageData(S, S)
    ball = b.ball = { cv, img, px32: new Uint32Array(img.data.buffer), S, ez, cr: ex }
  }
  ball.ez = ez; ball.cr = ex
  const T = tablesOf(S), px = tex.px, out = ball.px32
  const sx = dot(SUN, ex), sy = dot(SUN, ey), sz = dot(SUN, ez)
  const atm = b.atm ? (b.atm.split(',').map(Number) as RGB) : null
  const INV = 1 / TAU, IPI = 1 / Math.PI
  for (let k = 0; k < S * S; k++) {
    const a = T.a[k]
    if (a === 0) { out[k] = 0; continue }
    const nx = T.nx[k], ny = T.ny[k], nz = T.nz[k]
    const wx = nx * ex[0] + ny * ey[0] + nz * ez[0], wy = nx * ex[1] + ny * ey[1] + nz * ez[1], wz = nx * ex[2] + ny * ey[2] + nz * ez[2]
    let u = ((Math.atan2(wx, wz) * INV + 0.5) * TEX_W) | 0, v = ((0.5 - Math.asin(wy > 1 ? 1 : wy < -1 ? -1 : wy) * IPI) * TEX_H) | 0
    if (u >= TEX_W) u = TEX_W - 1
    if (v >= TEX_H) v = TEX_H - 1
    if (v < 0) v = 0
    const t = px[v * TEX_W + u], lam = nx * sx + ny * sy + nz * sz
    const lit = lam <= -0.08 ? 0 : lam >= 0.4 ? 1 : (lam + 0.08) / 0.48
    const kk = 0.02 + 1.02 * lit * (0.55 + 0.45 * lit)
    let r = (t & 255) * kk, g = ((t >> 8) & 255) * kk, bl = ((t >> 16) & 255) * kk
    if (atm) { // the air shows at the edge, brighter on the lit side
      const q = 1 - nz, rim = q * q * q * (0.12 + 0.88 * lit) * 0.95
      r += atm[0] * rim; g += atm[1] * rim; bl += atm[2] * rim
    }
    out[k] = (a << 24) | ((bl > 255 ? 255 : bl) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r)
  }
  ;(ball.cv.getContext('2d') as CanvasRenderingContext2D).putImageData(ball.img, 0, 0)
}
/** A distance in words. */
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : m / 1000 < 100 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 1000).toLocaleString('ko-KR')} km`)

export function createEngine(base: string, cb: Callbacks): Engine {
  const salt = Math.floor(Math.random() * 1e9)
  let back: HTMLCanvasElement | null = null, front: HTMLCanvasElement | null = null, layer: HTMLElement | null = null
  // the two canvases' pens; they are only used while the canvases are attached (frame checks that)
  let bx = null as unknown as CanvasRenderingContext2D, fx = null as unknown as CanvasRenderingContext2D
  let W = 1, H = 1, dpr = 1
  const holeNodes: HTMLDivElement[] = []

  // ---- the Ranger ----
  const ship = { p: [0, 0, 0] as V, v: [0, 0, 0] as V, f: [0, 0, 1] as V, u: [0, 1, 0] as V, r: [1, 0, 0] as V, wp: 0, wy: 0, wr: 0, thr: 0 }
  const cam = { p: [0, 0, -CAM_BACK] as V, f: [0, 0, 1] as V, u: [0, 1, 0] as V, roll: 0, r: [1, 0, 0] as V, uR: [0, 1, 0] as V, fv: [0, 0, 1] as V }
  // the first Endurance, ahead of the start with its port facing back toward it; more appear as the Ranger flies on
  const stations: Station[] = [makeStation([3400, 900, 22000], [-0.3, 0.2, -0.93], 0, 0.12, 0)]
  let stationId = 1, spawnT = 0
  const dock = { on: false, st: null as Station | null, t: 0, from: { p: [0, 0, 0] as V, f: [0, 0, 1] as V, u: [0, 1, 0] as V }, cool: 0, rollPrev: 0, rollT: 0, rate: 0, haveRoll: false, lights: [false, false, false, false] }
  let mode: 'fly' | 'swallow' | 'dead' = 'fly'
  const sw = { t: 0, rel: [0, 0, 0] as V, k: [0, 1, 0] as V, hole: null as Body | null, p: 0 }
  let elapsed = 0, hudAt = 0, lastTs = 1, flash = 0, shake = 0
  // the hull: 100 whole; each hit takes some, and pieces of the Ranger come off as it goes down
  let hull = 100, deadT = 0, ringT = 0, camSp = 0, emitAcc = 0
  let hAlt = Infinity, hb: Body | null = null // the nearest world and the height above it
  let emitDust = 0, vmul = 1, retro = 0, touch = 1, landCam = 0, camDock = 0
  let gear = 0, heat = 0, landedOn: Body | null = null // the landing gear (0 up .. 1 down), the glow of the air, the world it stands on
  const gg = gearModel()
  const rgFaces = rangerModel()
  const gone = new Uint8Array(rgFaces.length)
  const breakAt = new Float32Array(rgFaces.length) // the damage (0..1) at which each piece comes off: the small fittings first, the armour last
  for (let i = 0; i < rgFaces.length; i++) { const x = Math.sin(i * 12.9898) * 43758.5453; breakAt[i] = i < 8 ? 0.8 + 0.02 * i : 0.06 + 0.7 * (x - Math.floor(x)) }
  type Bit = { p: V; v: V; life: number; max: number; s: number; kind: 0 | 1 | 2 | 3; c?: number; col?: string } // a shard, a spark, a puff of smoke
  const bits: Bit[] = []

  // ---- the sky: stars at infinity (a band of them along a plane, for the Milky Way) ----
  const STARS = 1700
  const sd = new Float32Array(STARS * 3), sb = new Float32Array(STARS)
  {
    const r = rngOf(salt), band = norm([0.3, 0.9, 0.3]), b1 = norm(cross(band, [1, 0, 0])), b2 = cross(band, b1)
    for (let i = 0; i < STARS; i++) {
      let d: V
      if (i < 1100) { const a = r() * TAU, z = r() * 2 - 1, s = Math.sqrt(1 - z * z); d = [s * Math.cos(a), z, s * Math.sin(a)] }
      else { // concentrated near the band's plane
        const a = r() * TAU, w = (r() + r() + r() - 1.5) * 0.28
        d = norm(add(add(mul(b1, Math.cos(a)), mul(b2, Math.sin(a))), mul(band, w)))
      }
      sd[i * 3] = d[0]; sd[i * 3 + 1] = d[1]; sd[i * 3 + 2] = d[2]
      sb[i] = Math.pow(r(), i < 1100 ? 5 : 3) * (i < 1100 ? 1 : 0.5)
    }
  }
  // dust round the ship: it shows how fast, and which way, the ship is moving (there is nothing else to show it)
  // in layers, each box twelve times wider than the last: whatever the speed, one of them goes by at a pace the eye can follow
  const DUST_L = 7, DUST_N = 70, DUST_BOX = (k: number) => 240 * Math.pow(12, k)
  const dust = new Float32Array(DUST_L * DUST_N * 3)
  { const r = rngOf(salt + 5); for (let k = 0; k < DUST_L; k++) for (let i = 0; i < DUST_N * 3; i++) dust[k * DUST_N * 3 + i] = (r() * 2 - 1) * DUST_BOX(k) }

  // ---- bodies: placed by hand around the start (none in view at first), the rest sparsely by sector ----
  const sectors = new Map<string, Body[]>()
  const start: Body[] = [
    makeBody('earth', 'earth', [-1.5e8, -2.5e7, 5.0e7], 6.37e6, salt + 1),
    makeBody('moon', 'moon', [-1.5e8 + 4.0e7, -2.5e7 + 1.2e7, 5.0e7 - 1.8e7], 1.74e6, salt + 2),
    makeBody('saturn', 'saturn', [4.07e8, 4.2e7, -8.4e7], 5.8e7, salt + 3),
    makeBody('hole', 'hole', [-3.2e8, 3.8e8, -1.18e9], 6.0e7, salt + 4),
    makeBody('mars', 'mars', [-2.0e8, -3.0e8, -2.5e8], 3.4e6, salt + 5),
    makeBody('neptune', 'neptune', [1.4e8, 6.1e8, 2.0e8], 2.45e7, salt + 6),
    makeBody('jupiter', 'jupiter', [-6.0e8, -1.5e8, -3.0e8], 6.9e7, salt + 7),
    makeBody('lava', 'lava', [2.4e8, -2.0e8, 1.2e8], 5.0e6, salt + 8),
    makeBody('desert', 'desert', [-4.0e8, 1.6e8, 3.4e8], 5.5e6, salt + 9),
    makeBody('ice', 'ice', [3.0e8, 3.0e8, -2.6e8], 4.5e6, salt + 10),
    makeBody('ocean', 'ocean', [-2.2e8, 2.6e8, 1.6e8], 6.0e6, salt + 11),
    makeBody('jungle', 'jungle', [5.6e8, -3.0e8, 2.0e8], 6.5e6, salt + 12),
    makeBody('io', 'io', [-5.0e8, -3.2e8, 1.0e8], 1.8e6, salt + 13),
  ]
  let list: Body[] = [...start]
  let secKey = ''
  const sec = (v: number) => Math.round(v / SECTOR)
  function ensureSectors() {
    const ix = sec(ship.p[0]), iy = sec(ship.p[1]), iz = sec(ship.p[2])
    const key = `${ix},${iy},${iz}`
    if (key === secKey) return
    secKey = key
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const sx = ix + a, sy = iy + b, sz = iz + c, k = `${sx},${sy},${sz}`
      if (sectors.has(k)) continue
      const rnd = rngOf(hash3(sx, sy, sz) * 4294967296 + salt)
      const out: Body[] = []
      if (rnd() > 0.714) {
        const kind = pickKind(rnd()), r = lerp(KIND_RADIUS[kind][0], KIND_RADIUS[kind][1], rnd())
        const p: V = [(sx + (rnd() - 0.5) * 0.7) * SECTOR, (sy + (rnd() - 0.5) * 0.7) * SECTOR, (sz + (rnd() - 0.5) * 0.7) * SECTOR]
        // none near the start, and none in front of it: at first there is nothing to see but the Endurance's light
        const dist0 = len(p), ahead = dist0 > 0 ? p[2] / dist0 : 0
        if (dist0 > 1.2e9 && !(dist0 < 4e9 && ahead > 0.4)) out.push(makeBody(`${k}#0`, kind, p, r, Math.floor(rnd() * 1e9)))
      }
      sectors.set(k, out)
    }
    for (const k of [...sectors.keys()]) {
      const [a, b, c] = k.split(',').map(Number)
      if (Math.abs(a - ix) > 2 || Math.abs(b - iy) > 2 || Math.abs(c - iz) > 2) sectors.delete(k)
    }
    list = [...start, ...[...sectors.values()].flat()]
  }

  // ---- the ship's attitude, turned by rates about its own axes ----
  /** `cur` turned toward `tgt` by the fraction k of the angle between them (round `hint` if they are opposite). */
  const slerpTo = (cur: V, tgt: V, k: number, hint: V): V => {
    const c = clamp(dot(cur, tgt), -1, 1), ang = Math.acos(c)
    if (ang < 1e-5) return tgt
    let ax = cross(cur, tgt)
    ax = len(ax) < 1e-4 ? norm(cross(cur, hint)) : norm(ax)
    const a = ang * k, ca = Math.cos(a), sa = Math.sin(a)
    // Rodrigues: cur turned by a about ax
    return norm(add(add(mul(cur, ca), mul(cross(ax, cur), sa)), mul(ax, dot(ax, cur) * (1 - ca))))
  }
  const turnPair = (a: V, b: V, ang: number): [V, V] => { const c = Math.cos(ang), s = Math.sin(ang); return [[a[0] * c + b[0] * s, a[1] * c + b[1] * s, a[2] * c + b[2] * s], [b[0] * c - a[0] * s, b[1] * c - a[1] * s, b[2] * c - a[2] * s]] }
  function turnShip(dp: number, dy: number, dr: number) {
    let [f, u] = turnPair(ship.f, ship.u, dp) // pitch: the nose toward up
    let r: V
    ;[f, r] = turnPair(f, ship.r, dy) // yaw: the nose toward right
    ;[u, r] = turnPair(u, r, dr) // roll: up toward right (clockwise seen from behind)
    f = norm(f)
    r = norm(sub(r, mul(f, dot(f, r))))
    u = cross(f, r)
    r = cross(u, f)
    ship.f = f; ship.u = u; ship.r = r
  }

  // ---- flight ----
  /** The distance to the nearest thing that matters (metres). */
  function nearest(skip: Station | null = null) {
    let d = Infinity
    // each Endurance's hull: the spine (a rod) and the ring (a ring of modules), not its centre
    for (const S of stations) {
      if (S === skip) continue
      const d3 = sub(ship.p, S.p), lx = dot(d3, S.x), ly = dot(d3, S.y), lz = dot(d3, S.z), rho = Math.hypot(lx, ly)
      d = Math.min(d, Math.max(3, Math.min(Math.hypot(rho, lz - clamp(lz, -36 * ES, PORT_Z + 2)) - 6.3 * ES, Math.hypot(rho - ENDURANCE_RING, lz) - 11 * ES)))
    }
    for (const b of list) d = Math.min(d, Math.max(5, len(sub(ship.p, [b.x, b.y, b.z])) - b.r))
    return d
  }
  /** The nearest Endurance and how far its centre is. */
  function nearStation(): { S: Station; d: number } | null {
    let best: { S: Station; d: number } | null = null
    for (const S of stations) { const d = len(sub(ship.p, S.p)); if (!best || d < best.d) best = { S, d } }
    return best
  }
  const bump = (n: V, strength = 1) => {
    // a hard touch: kicked off, turning a little, the phone buzzes
    const vn = dot(ship.v, n)
    if (vn < 0) ship.v = sub(ship.v, mul(n, 1.4 * vn))
    ship.wp += (Math.random() - 0.5) * 0.5 * strength; ship.wy += (Math.random() - 0.5) * 0.5 * strength; ship.wr += (Math.random() - 0.5) * 0.4 * strength
    shake = Math.max(shake, 0.9)
    cb.haptic([70])
  }

  /** Where the segment p0 -> p1 first comes within `rad` of c: the fraction along it, or -1. */
  function segHit(p0: V, p1: V, c: V, rad: number) {
    const d = sub(p1, p0), m = sub(p0, c)
    const c0 = dot(m, m) - rad * rad
    if (c0 <= 0) return dot(m, d) < 0 ? 0 : -1 // already inside: hit only if going further in (going out is free, so the ship can never be caught)
    const a = dot(d, d)
    if (a < 1e-12) return -1
    const b = dot(m, d), disc = b * b - a * c0
    if (disc < 0) return -1
    const t = (-b - Math.sqrt(disc)) / a
    return t >= 0 && t <= 1 ? t : -1
  }

  /** Attitude and engines: the push grows with the speed, up to the top speed. */
  const vmaxNow = () => VMAX * vmul * (dock.on ? 2 : 1) // the 최대속도 패스 triples it, and the Endurance's engines behind the Ranger double it
  function stepControl(inp: Input, dt: number) {
    const kp = 1 - Math.exp(-dt * 5)
    // the final approach to a world: the ship holds itself level over the ground, and the engines under it slow the fall (as far as they can)
    const land = !!hb && !!LANDABLE[hb.kind] && hAlt < LAND_H && gear > 0.6 && !landedOn
    if (land && hb && Math.abs(inp.pitch) < 0.15) {
      const n = norm(sub(ship.p, [hb.x, hb.y, hb.z])), fh = sub(ship.f, mul(n, dot(ship.f, n)))
      if (len(fh) > 0.05) {
        const k = 1 - Math.exp(-dt * 1.4), f0 = norm(add(mul(ship.f, 1 - k), mul(norm(fh), k))), u0 = add(mul(ship.u, 1 - k), mul(n, k))
        const f = norm(f0), r = norm(cross(u0, f))
        ship.f = f; ship.r = r; ship.u = cross(f, r)
      }
      ship.wp *= Math.exp(-dt * 3)
    }
    ship.wp += (-inp.pitch * PITCH_MAX - ship.wp) * kp // pushed down = nose down
    ship.wy += (inp.yaw * YAW_MAX - ship.wy) * kp
    if (inp.rollStop) ship.wr *= Math.exp(-dt * 4)
    else ship.wr = clamp(ship.wr + inp.roll * ROLL_ACC * dt, -1.5, 1.5)
    turnShip(ship.wp * dt, ship.wy * dt, ship.wr * dt)

    // near things the engines push gently, so a docking can be done by hand; the push grows with the speed, so far from everything it climbs to the top speed
    const vmax = vmaxNow()
    const aT = clamp(0.6 * clamp(0.08 * nearest(), 0.35, VMAX_CAP), 0.5, 5e6)
    ship.thr += ((inp.thrust ? 1 : 0) - ship.thr) * (1 - Math.exp(-dt * 6))
    if (inp.thrust) { const s0 = len(ship.v); ship.v = add(ship.v, mul(ship.f, (aT + 0.35 * s0 * Math.max(0, 1 - s0 / vmax)) * dt)) }
    if (inp.brake) {
      const sp = len(ship.v)
      if (sp > 0) ship.v = mul(ship.v, 1 - Math.min(sp, Math.max(aT, 0.6 * sp) * dt) / sp)
    }
    let retroOn = false
    if (land && hb) {
      const n = norm(sub(ship.p, [hb.x, hb.y, hb.z])), down = -dot(ship.v, n), safe = 3 + 0.1 * Math.max(0, hAlt - HOVER)
      if (inp.thrust) ship.v = add(ship.v, mul(n, 6 * dt)) // pushing the engines lifts it (and ends the landing)
      else if (down > safe) { ship.v = add(ship.v, mul(n, Math.min(down - safe, 7 * dt))); retroOn = true }
      if (hAlt < 120) { const vt = sub(ship.v, mul(n, dot(ship.v, n))); ship.v = sub(ship.v, mul(vt, 1 - Math.exp(-(inp.brake ? 1.2 : 0.35) * dt))) } // the ground drags it along
    }
    retro += ((retroOn ? 1 : 0) - retro) * (1 - Math.exp(-dt * 8))
    // flight assist: the velocity turns round to follow the nose (forward or backward, whichever it is nearer) without losing speed; not on the landing approach, where it falls straight
    const sp = len(ship.v)
    if (sp > vmax) ship.v = mul(ship.v, vmax / sp)
    if (sp > 1e-4 && !land) {
      const vf = dot(ship.v, ship.f), tgt = mul(ship.f, vf >= 0 ? sp : -sp)
      const k = 1 - Math.exp(-dt / 2)
      const nv = add(mul(ship.v, 1 - k), mul(tgt, k))
      const nl = len(nv)
      if (nl > 0) ship.v = mul(nv, Math.min(sp, vmax) / nl)
    }
  }

  /** Moving: a black hole pulls; the path is tested whole, so even at a speed with no name the ship cannot skip through a planet. */
  function stepMove(dt: number) {
    const p0 = ship.p
    for (const b of list) {
      if (b.kind !== 'hole') continue
      const d3 = sub([b.x, b.y, b.z], p0), d = len(d3)
      if (d < b.r * 8 && d > 0) ship.v = add(ship.v, mul(norm(d3), HOLE_G * Math.pow(b.r / d, 2) * dt))
    }
    // air: it slows the ship, thicker the lower it is
    for (const b of list) {
      if (b.kind === 'hole' || !b.atm) continue
      const alt = len(sub(p0, [b.x, b.y, b.z])) - b.r
      if (alt < 3e5) ship.v = mul(ship.v, Math.exp(-0.25 * Math.exp(-Math.max(alt, 0) / 40000) * dt))
    }
    const p1 = add(p0, mul(ship.v, dt))
    // Saturn's rings: only close to them, and only a little at a time
    if (elapsed > ringT) {
      for (const b of list) {
        if (!b.ring || !b.bands) continue
        const c: V = [b.x, b.y, b.z], h0 = dot(sub(p0, c), b.ring), h1 = dot(sub(p1, c), b.ring)
        if (Math.abs(h1) > RING_REACH && h0 * h1 >= 0) continue
        const q = h0 * h1 < 0 ? add(p0, mul(sub(p1, p0), h0 / (h0 - h1))) : p1
        const rel = sub(q, c), rho = len(sub(rel, mul(b.ring, dot(rel, b.ring)))) / b.r
        if (b.bands.some(([from, to, op]) => rho >= from && rho < to && op >= 0.2)) { ringT = elapsed + 0.45; hurt(3 + Math.random() * 2, null); break }
      }
      if (mode !== 'fly') return
    }
    let hit: { t: number; b: Body } | null = null
    for (const b of list) {
      const t = segHit(p0, p1, [b.x, b.y, b.z], b.kind === 'hole' ? b.r * 1.35 : LANDABLE[b.kind] ? b.r + HOVER : b.r + 12 * RS)
      if (t >= 0 && (!hit || t < hit.t)) hit = { t, b }
    }
    if (!hit) { ship.p = p1; return }
    const b = hit.b, c: V = [b.x, b.y, b.z], pt = add(p0, mul(sub(p1, p0), hit.t))
    if (b.kind === 'hole') { // past the point of no return: it takes the ship in
      ship.p = pt
      mode = 'swallow'
      sw.t = 0; sw.hole = b; sw.rel = sub(pt, c)
      const k = cross(sw.rel, [0, 1, 0])
      sw.k = len(k) < 1e-3 * len(sw.rel) ? [1, 0, 0] : norm(k)
      return
    }
    // a planet is solid: the ship stops on its surface and is thrown back
    const n = norm(sub(pt, c)), into = -dot(ship.v, n)
    if (LANDABLE[b.kind] && dock.on) { // the pair cannot land: a hard touch ends it, a soft one bounces
      ship.p = add(c, mul(n, b.r + HOVER + 2))
      if (into > 6) { explode(); return }
      bump(n, 1); ship.v = mul(ship.v, 0.6)
      return
    }
    if (LANDABLE[b.kind]) { // a world with a ground: set down on the gear if it is slow enough, else it is a crash
      if (into > LAND_V || len(sub(ship.v, mul(n, -into))) > LAND_SIDE) { ship.p = pt; explode(); return }
      landOn(b, n)
      return
    }
    ship.p = add(c, mul(n, b.r + 12 * RS + 2)) // out past the hit distance, so the next step starts free of it
    if (into > CRASH_V) { explode(); return }
    bump(n, 2)
    ship.v = mul(ship.v, 0.6)
    if (into > 2) hurt(5 + into * 0.4, n)
  }

  /** Dust thrown up from the ground under the ship, outward along the ground. */
  function puffGround(b: Body, n: V, count: number) {
    const col = b.tex ? b.tex.avg : ([120, 112, 104] as RGB), foot = add([b.x, b.y, b.z], mul(n, b.r + 1))
    const t1 = norm(cross(n, Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), t2 = cross(n, t1)
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, sp = 6 + Math.random() * 16
      bits.push({ p: foot, v: add(add(mul(t1, Math.cos(a) * sp), mul(t2, Math.sin(a) * sp)), mul(n, 1 + Math.random() * 5)), life: 2.2, max: 2.2, s: 1.5 + Math.random() * 2.5, kind: 3, col: `${col[0] * 0.9 | 0},${col[1] * 0.9 | 0},${col[2] * 0.9 | 0}` })
    }
  }
  function landOn(b: Body, n: V) {
    landedOn = b
    shake = Math.max(shake, 0.35 + Math.min(0.5, 0.03 * -dot(ship.v, n)))
    ship.p = add([b.x, b.y, b.z], mul(n, b.r + HOVER)); ship.v = [0, 0, 0]; ship.wp = ship.wy = ship.wr = 0
    touch = 0
    puffGround(b, n, 36)
    cb.haptic([40, 30, 40])
    if (gear < 0.9) hurt(10, null) // down on its belly
  }
  /** Standing on a world: the ship settles level; pushing the engines lifts it off. */
  function stepLanded(inp: Input, dt: number) {
    const b = landedOn
    if (!b) return
    const c: V = [b.x, b.y, b.z], n = norm(sub(ship.p, c))
    ship.p = add(c, mul(n, b.r + HOVER)); ship.v = [0, 0, 0]; ship.wp = ship.wy = ship.wr = 0
    ship.thr += ((inp.thrust ? 1 : 0) - ship.thr) * (1 - Math.exp(-dt * 6))
    let fh = sub(ship.f, mul(n, dot(ship.f, n)))
    if (len(fh) < 0.05) fh = sub(ship.r, mul(n, dot(ship.r, n)))
    const k = 1 - Math.exp(-dt * 3)
    const level = (f0: V, u0: V) => { const f = norm(f0), r = norm(cross(u0, f)); ship.f = f; ship.r = r; ship.u = cross(f, r) }
    level(add(mul(ship.f, 1 - k), mul(norm(fh), k)), add(mul(ship.u, 1 - k), mul(n, k)))
    if (inp.thrust) {
      landedOn = null
      ship.v = mul(n, 12)
      level(add(ship.f, mul(n, 0.55)), n)
      cb.haptic([25])
    }
  }

  /** A hit on the hull: some of the hull goes, and every piece whose time has come breaks off. */
  function hurt(amount: number, n: V | null) {
    if (mode !== 'fly') return
    hull = Math.max(0, hull - amount)
    shake = Math.max(shake, 0.5 + amount * 0.04)
    cb.haptic([50])
    const dmg = 1 - hull / 100
    for (let i = 0; i < rgFaces.length; i++) {
      if (gone[i] || breakAt[i] >= dmg) continue
      gone[i] = 1
      const fc = rgFaces[i]
      let x = 0, y = 0, z = 0
      for (let j = 0; j < fc.k; j++) { x += fc.p[j * 3]; y += fc.p[j * 3 + 1]; z += fc.p[j * 3 + 2] }
      x = (x / fc.k) * RS; y = (y / fc.k) * RS; z = (z / fc.k) * RS
      const w = add(add(add(ship.p, mul(ship.r, x)), mul(ship.u, y)), mul(ship.f, z))
      const out = n ? mul(n, 8) : [0, 0, 0] as V
      bits.push({ p: w, v: add(add(ship.v, out), [(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14]), life: 4, max: 4, s: 0.3 + Math.random() * 0.7, kind: 0, c: fc.mat })
    }
    if (hull <= 0) explode()
  }
  function explode() {
    if (mode !== 'fly') return
    mode = 'dead'; deadT = 0; hull = 0
    for (let i = 0; i < 70; i++) {
      const d = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]), sp = 6 + Math.random() * 60
      bits.push({ p: add(ship.p, mul(d, Math.random() * 6)), v: mul(d, sp), life: 4.5, max: 4.5, s: 0.4 + Math.random() * 1.4, kind: i % 4 ? 0 : 1, c: i % 3 })
    }
    ship.v = [0, 0, 0]; ship.wp = ship.wy = ship.wr = 0; dock.on = false
    flash = 1.1; shake = 2.2
    cb.haptic([120, 50, 200])
  }
  /** After the blast the Ranger is whole again, at the start. */
  function respawn() {
    hull = 100; gone.fill(0); bits.length = 0; ringT = 0
    ship.p = [0, 0, 0]; ship.v = [0, 0, 0]; ship.f = [0, 0, 1]; ship.u = [0, 1, 0]; ship.r = [1, 0, 0]; ship.wp = ship.wy = ship.wr = 0; ship.thr = 0
    cam.f = ship.f; cam.u = ship.u; cam.roll = 0
    stations.length = 0
    stations.push(makeStation([3400, 900, 22000], [-0.3, 0.2, -0.93], 0, 0.12, 0))
    stationId = 1; spawnT = 0; elapsed = 0; gear = 0; heat = 0; landedOn = null; retro = 0; camDock = 0; landCam = 0
    dock.on = false; dock.st = null; dock.lights = [false, false, false, false]; dock.haveRoll = false
    secKey = ''; ensureSectors()
    flash = 1; mode = 'fly'
  }

  /** The Endurances appear as the Ranger flies: always one within 60 km, and now and then another further out. */
  function manageStations(dt: number) {
    spawnT += dt
    if (spawnT < 2 || elapsed < 15) return
    spawnT = 0
    for (let i = stations.length - 1; i >= 0; i--) if (stations[i] !== dock.st && len(sub(stations[i].p, ship.p)) > 500000) stations.splice(i, 1)
    let near = Infinity
    for (const S of stations) near = Math.min(near, len(sub(S.p, ship.p)))
    const spawn = (lo: number, hi: number) => {
      const r = () => Math.random() * 2 - 1
      const dir = norm(add(ship.f, mul(norm([r(), r(), r()]), 0.9))) // mostly ahead, where it is seen
      stations.push(makeStation(add(ship.p, mul(dir, lo + Math.random() * (hi - lo))), [r(), r(), r()], Math.random() * TAU, 0.08 + Math.random() * 0.08, stationId++))
    }
    if (near > 60000) spawn(20000, 45000)
    else if (stations.length < 5 && Math.random() < 0.3) spawn(30000, 90000)
  }

  /** The Endurance: its docking test, the lights, and the hits. */
  function stepStation(S: Station, dt: number) {
    dock.cool = Math.max(0, dock.cool - dt)
    if (len(sub(ship.p, S.p)) > 600 * ES) { if (dock.st === S) { dock.lights = [false, false, false, false]; dock.haveRoll = false } return }
    if (dock.st !== S) { dock.st = S; dock.haveRoll = false }
    const m = dockMetrics({ ship: ship.p, f: ship.f, u: ship.u, vel: ship.v, e: S.p, ex: S.x, ey: S.y, ez: S.z, spin: S.spin })
    // how fast the two keys are turning against each other: the change over a quarter of a second, so the noise of single frames does not count
    if (!dock.haveRoll) { dock.rate = 0; dock.rollPrev = m.roll; dock.rollT = elapsed; dock.haveRoll = true }
    else if (elapsed - dock.rollT >= 0.25) { dock.rate = wrapPi(m.roll - dock.rollPrev) / (elapsed - dock.rollT); dock.rollPrev = m.roll; dock.rollT = elapsed }
    const v = dockVerdict(m, dock.rate)
    dock.lights = [v.axis, v.offset, v.roll, v.speed]
    if (dock.cool > 0) return
    // the nose at the port's face: lock if all four are right, else it bounces off
    if (m.h < 0.6 && m.h > -6 && m.offset < 5.2) {
      if (v.all) {
        dock.on = true; dock.t = 0
        dock.from = { p: ship.p, f: ship.f, u: ship.u }
        ship.v = [0, 0, 0]; ship.wp = ship.wy = ship.wr = 0
        cb.haptic([30, 40, 30])
      } else {
        ship.p = add(ship.p, mul(S.z, 0.7 - m.h))
        bump(S.z, 1)
      }
      return
    }
    // the hull: the spine, and the ring's modules (the ship as a ball at its centre)
    const d3 = sub(ship.p, S.p), lx = dot(d3, S.x), ly = dot(d3, S.y), lz = dot(d3, S.z)
    const rho = Math.hypot(lx, ly)
    let n: V | null = null, over = 0
    if (lz > -36 * ES && lz < PORT_Z + 2 && rho < 6.3 * ES + SHIP_R) {
      const rr = rho || 1e-6
      n = add(mul(S.x, lx / rr), mul(S.y, ly / rr)); over = 6.3 * ES + SHIP_R - rho
    } else {
      const dr = Math.hypot(rho - ENDURANCE_RING, lz)
      if (dr < 11 * ES + SHIP_R && rho > 20 * ES) {
        const rr = rho || 1e-6, q = dr || 1e-6
        n = add(add(mul(S.x, (lx / rr) * ((rho - ENDURANCE_RING) / q)), mul(S.y, (ly / rr) * ((rho - ENDURANCE_RING) / q))), mul(S.z, lz / q))
        over = 11 * ES + SHIP_R - dr
      }
    }
    if (n) { const nn = norm(n); ship.p = add(ship.p, mul(nn, over + 0.05)); bump(nn, 1) }
  }

  function stepDocked(inp: Input, dt: number) {
    const S = dock.st
    if (!S) { dock.on = false; return }
    dock.t = Math.min(1, dock.t + dt / 0.9)
    const L = PORT_Z + NOSE
    if (dock.t < 1) {
      const k = ease(dock.t)
      // where it ends up: the nose tip at the port's face, the Ranger's key on the port's key
      const toP = add(S.p, mul(S.z, L)), toF = mul(S.z, -1), toU = keyDir(S.x, S.y, S.spin)
      ship.p = add(mul(dock.from.p, 1 - k), mul(toP, k))
      const f = norm(add(mul(dock.from.f, 1 - k), mul(toF, k))), uu = add(mul(dock.from.u, 1 - k), mul(toU, k))
      const r = norm(cross(sub(uu, mul(f, dot(uu, f))), f))
      ship.f = f; ship.r = r; ship.u = norm(cross(f, r))
      ship.v = [0, 0, 0]; ship.wp = ship.wy = ship.wr = 0
      return
    }
    // locked: the Ranger and the Endurance are one craft. It flies the way the Endurance's engines push (out of the port's side), the
    // controls turn the pair about its middle, and the Endurance's engines give it twice the top speed.
    let mid = sub(ship.p, mul(S.z, L / 2))
    const dp = -inp.pitch * 0.2 * dt, dy = inp.yaw * 0.2 * dt
    let [z1, y1] = turnPair(S.z, S.y, dp)
    let x1: V
    ;[z1, x1] = turnPair(z1, S.x, dy)
    z1 = norm(z1); x1 = norm(sub(x1, mul(z1, dot(z1, x1)))); y1 = cross(z1, x1)
    S.z = z1; S.x = x1; S.y = y1
    ship.p = add(mid, mul(S.z, L / 2))
    const vmax = vmaxNow()
    const aT = clamp(0.6 * clamp(0.08 * nearest(S), 0.35, VMAX_CAP), 0.5, 5e6)
    ship.thr += ((inp.thrust ? 1 : 0) - ship.thr) * (1 - Math.exp(-dt * 6))
    if (inp.thrust) { const s0 = len(ship.v); ship.v = add(ship.v, mul(S.z, (aT + 0.35 * s0 * Math.max(0, 1 - s0 / vmax)) * dt)) }
    if (inp.brake) { const sp = len(ship.v); if (sp > 0) ship.v = mul(ship.v, 1 - Math.min(sp, Math.max(aT, 0.6 * sp) * dt) / sp) }
    const sp = len(ship.v)
    if (sp > vmax) ship.v = mul(ship.v, vmax / sp)
    if (sp > 1e-4) { // the velocity follows the craft's axis
      const k = 1 - Math.exp(-dt / 2), nv = add(mul(ship.v, 1 - k), mul(S.z, k * sp)), nl = len(nv)
      if (nl > 0) ship.v = mul(nv, Math.min(sp, vmax) / nl)
    }
    stepMove(dt)
    if (mode !== 'fly') return
    mid = sub(ship.p, mul(S.z, L / 2))
    S.p = sub(ship.p, mul(S.z, L))
    ship.f = mul(S.z, -1); ship.u = keyDir(S.x, S.y, S.spin)
    ship.r = norm(cross(ship.u, ship.f)); ship.u = cross(ship.f, ship.r)
    ship.wp = ship.wy = ship.wr = 0
    // letting go: the Endurance stops where it is and the Ranger drifts away along the axis, still turning with it
    if (inp.undock) {
      dock.on = false; dock.cool = 4
      ship.v = mul(S.z, 1.5)
      const du = mul(add(mul(S.x, -Math.cos(S.spin)), mul(S.y, -Math.sin(S.spin))), S.w)
      ship.wr = dot(du, ship.r)
    }
  }

  function frame(now: number, inp: Input) {
    if (!back || !front) return
    const t = now / 1000
    if (lastTs === 1) { lastTs = t; return }
    const dt = Math.min(0.05, Math.max(0, t - lastTs))
    lastTs = t
    elapsed += dt
    ensureSectors()
    vmul = Math.max(1, inp.speedMul || 1)
    hAlt = Infinity; hb = null
    for (const b of list) { if (b.kind === 'hole') continue; const al = len(sub(ship.p, [b.x, b.y, b.z])) - b.r; if (al < hAlt) { hAlt = al; hb = b } }

    for (const S of stations) S.spin += S.w * dt
    if (mode === 'fly') {
      manageStations(dt)
      if (dock.on) stepDocked(inp, dt)
      else if (landedOn) stepLanded(inp, dt)
      else {
        stepControl(inp, dt)
        // near an Endurance the move is cut into steps a few metres long, so a fast ship cannot pass through it
        const ns = nearStation(), close = !!ns && ns.d < 900 * ES
        const steps = close ? clamp(Math.ceil((len(ship.v) * dt) / 3), 1, 80) : 1
        for (let i = 0; i < steps && mode === 'fly' && !dock.on; i++) { stepMove(dt / steps); if (close && ns && mode === 'fly') stepStation(ns.S, dt / steps) }
        if (!close && dock.st) { dock.lights = [false, false, false, false]; dock.haveRoll = false }
      }
    } else if (mode === 'dead') {
      deadT += dt
      if (deadT > 3.6) respawn()
    } else if (sw.hole) {
      // falling in: a spiral that tightens, the ship turned to face the hole and stretched along its fall
      const h = sw.hole, hp: V = [h.x, h.y, h.z]
      sw.t += dt
      const p = clamp(sw.t / 4.6, 0, 1)
      sw.p = p
      const rf = Math.max(0.02, 1 - Math.pow(p, 1.25)), ang = p * p * 11
      const c = Math.cos(ang), s = Math.sin(ang)
      const rel = sw.rel, kk = sw.k, kd = dot(kk, rel), kx = cross(kk, rel)
      const rot = add(add(mul(rel, c), mul(kx, s)), mul(kk, kd * (1 - c)))
      ship.p = add(hp, mul(rot, rf))
      const want = norm(sub(hp, ship.p))
      ship.f = norm(add(mul(ship.f, 0.85), mul(want, 0.15)))
      ship.r = norm(cross([0, 1, 0], ship.f)); ship.u = cross(ship.f, ship.r)
      shake = Math.max(shake, p * 2.5)
      cam.roll += dt * (0.4 + p * 7)
      flash = Math.max(flash, smooth(0.84, 1, p))
      if (sw.t > 4.8) {
        // out the other side, a long way off, with the sky quiet again
        const dir = norm([Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5])
        ship.p = add(hp, mul(dir, 3e9)); ship.v = [0, 0, 0]
        ship.f = norm([Math.random() - 0.5, 0, Math.random() - 0.5]); ship.r = norm(cross([0, 1, 0], ship.f)); ship.u = cross(ship.f, ship.r)
        cam.f = ship.f; cam.u = ship.u; cam.roll = 0
        secKey = ''
        flash = 1.4; mode = 'fly'; sw.hole = null
        cb.haptic([40, 60, 40])
        ensureSectors()
      }
    }
    if (flash > 0 && mode !== 'swallow') flash = Math.max(0, flash - dt * 0.9)
    shake = Math.max(0, shake - dt * 2.2)
    // the gear comes down by itself over a world a ship can land on; the air glows with speed
    if (mode === 'fly') {
      const want = !dock.on && (landedOn || (hb && LANDABLE[hb.kind] && hAlt < Math.max(3000, len(ship.v) * 6))) ? 1 : 0
      gear += clamp(want - gear, -dt / 1.6, dt / 1.6)
      const q = hb && hb.atm ? clamp((len(ship.v) / 1500) * Math.exp(-Math.max(0, hAlt) / 40000), 0, 1) : 0
      heat += (q - heat) * (1 - Math.exp(-dt * 4))
      if (heat > 0.05) shake = Math.max(shake, heat * 0.7)
      touch = Math.min(1, touch + dt / 0.7)
      // the engines blow dust off the ground under the ship when it is close
      if (retro > 0.1 && hb && hAlt < 90 && !dock.on) {
        emitDust += dt * retro * clamp(1 - hAlt / 90, 0, 1) * 70
        if (emitDust >= 1) { const n = Math.floor(emitDust); emitDust -= n; puffGround(hb, norm(sub(ship.p, [hb.x, hb.y, hb.z])), n) }
      }
    }

    // ---- the camera follows: its direction turns after the ship's, a moment later ----
    // docked, it moves out to hang behind the middle of the Ranger and the Endurance, looking the way the pair flies; landing, it sinks toward the ground
    const SD = dock.on ? dock.st : null, PL = PORT_Z + NOSE
    camDock += ((SD && dock.t >= 0.6 ? 1 : 0) - camDock) * (1 - Math.exp(-dt * 1.3))
    landCam += (((hb && LANDABLE[hb.kind] && hAlt < LAND_H * 1.4 && gear > 0.3) || landedOn ? 1 : 0) - landCam) * (1 - Math.exp(-dt * 1.5))
    const kc = 1 - Math.exp(-dt * 4.5)
    const tf = SD && dock.t >= 0.6 ? SD.z : ship.f, tu = SD && dock.t >= 0.6 ? SD.y : ship.u
    cam.f = slerpTo(cam.f, tf, SD ? 1 - Math.exp(-dt * 2.2) : kc, cam.u)
    cam.u = slerpTo(cam.u, tu, SD ? 1 - Math.exp(-dt * 2.2) : kc, cam.f)
    cam.u = norm(sub(cam.u, mul(cam.f, dot(cam.f, cam.u))))
    const anchor = SD ? add(mul(ship.p, 1 - camDock), mul(add(SD.p, mul(SD.z, PL / 2)), camDock)) : ship.p
    const intro = ease(elapsed / 2.4)
    // the faster it goes, the further back the camera hangs and the wider the view, so the speed is felt
    camSp += (clamp(Math.log10(1 + len(ship.v) / 30) / 4.5, 0, 1) - camSp) * (1 - Math.exp(-dt * 2))
    const back0 = (lerp(CAM_BACK * 14, CAM_BACK, intro) * (1 + 0.7 * camSp) * (1 - 0.25 * landCam)) * (1 - camDock) + 175 * ES * camDock
    const rise0 = CAM_RISE * (0.4 + 0.6 * intro) * (1 - 0.55 * landCam) * (1 - camDock) + 40 * ES * camDock
    cam.p = add(sub(anchor, mul(cam.f, back0)), mul(cam.u, rise0))
    // it looks at a point a little ahead of the ship, so the ship sits low in the view but not at its edge
    cam.fv = norm(sub(add(anchor, mul(cam.f, (30 * RS) * (1 - camDock) + 80 * ES * camDock)), cam.p))
    const camR0 = norm(cross(cam.u, cam.fv)), camU0 = cross(cam.fv, camR0)
    // the view may be rolled (falling into a hole)
    const cR = Math.cos(cam.roll), sR = Math.sin(cam.roll)
    cam.r = add(mul(camR0, cR), mul(camU0, -sR)); cam.uR = add(mul(camU0, cR), mul(camR0, sR))
    const F = Math.min(W, H) * 0.95 * (1 - 0.16 * camSp)
    const shx = (Math.random() - 0.5) * shake * 3, shy = (Math.random() - 0.5) * shake * 3
    const cx = W / 2 + shx, cy = H / 2 + shy
    const CR = cam.r, CU = cam.uR, CF = cam.fv

    // a point of the world seen from the camera: [x, y, depth]
    const proj = (p: V, o: number[]) => {
      const v0 = p[0] - cam.p[0], v1 = p[1] - cam.p[1], v2 = p[2] - cam.p[2]
      const zc = v0 * CF[0] + v1 * CF[1] + v2 * CF[2]
      o[0] = cx + ((v0 * CR[0] + v1 * CR[1] + v2 * CR[2]) * F) / zc
      o[1] = cy - ((v0 * CU[0] + v1 * CU[1] + v2 * CU[2]) * F) / zc
      o[2] = zc
    }
    const sp = [0, 0, 0]
    // the sun's light in the camera's axes
    const Lc: V = [dot(SUN, CR), dot(SUN, CU), dot(SUN, CF)]

    // ---- bodies as the camera sees them ----
    type Seen = { b: Body; x: number; y: number; zc: number; rpx: number; d: number }
    const seen: Seen[] = []
    for (const b of list) {
      proj([b.x, b.y, b.z], sp)
      const d = Math.hypot(b.x - cam.p[0], b.y - cam.p[1], b.z - cam.p[2])
      seen.push({ b, x: sp[0], y: sp[1], zc: sp[2], rpx: sp[2] > 1 ? (b.r * F) / sp[2] : 0, d })
    }
    seen.sort((p, q) => q.d - p.d)
    let lens: { x: number; y: number; r: number } | null = null
    for (const s of seen) if (s.b.kind === 'hole' && s.zc > 1 && s.rpx > 4 && (!lens || s.rpx > lens.r)) lens = { x: s.x, y: s.y, r: s.rpx }

    // ================= back canvas =================
    bx.setTransform(dpr, 0, 0, dpr, 0, 0)
    bx.fillStyle = '#000'
    bx.fillRect(0, 0, W, H)
    for (let i = 0; i < STARS; i++) {
      const dx = sd[i * 3], dy = sd[i * 3 + 1], dz = sd[i * 3 + 2]
      const zc = dx * CF[0] + dy * CF[1] + dz * CF[2]
      if (zc < 0.05) continue
      let x = cx + ((dx * CR[0] + dy * CR[1] + dz * CR[2]) * F) / zc, y = cy - ((dx * CU[0] + dy * CU[1] + dz * CU[2]) * F) / zc
      if (x < -3 || x > W + 3 || y < -3 || y > H + 3) continue
      if (lens) { // light bends round a black hole
        const ddx = x - lens.x, ddy = y - lens.y, rho = Math.hypot(ddx, ddy)
        if (rho > lens.r * 0.95 && rho < lens.r * 5) { const k = 1 + (lens.r * lens.r * 1.3) / (rho * rho); x = lens.x + ddx * k; y = lens.y + ddy * k }
      }
      const b = sb[i]
      bx.fillStyle = `rgba(${b > 0.6 ? '255,248,235' : '215,225,255'},${0.14 + 0.86 * b})`
      bx.beginPath(); bx.arc(x, y, 0.45 + b * 1.1, 0, TAU); bx.fill()
    }

    // the sky of a world with air: it hides the stars, the thinner the higher the ship is
    if (hb && hb.atm && hAlt < SKY_H && mode !== 'swallow') {
      const nu = norm(sub(ship.p, [hb.x, hb.y, hb.z])), day = clamp(dot(nu, SUN) * 1.6 + 0.35, 0, 1)
      const a = Math.pow(1 - Math.max(0, hAlt) / SKY_H, 1.5) * day
      if (a > 0.01) {
        const [r0, g0, b0] = hb.atm.split(',').map(Number)
        const sg = bx.createLinearGradient(0, 0, 0, H)
        sg.addColorStop(0, `rgba(${r0 * 0.35 | 0},${g0 * 0.35 | 0},${b0 * 0.45 | 0},${a})`); sg.addColorStop(1, `rgba(${r0},${g0},${b0},${a * 0.95})`)
        bx.fillStyle = sg; bx.fillRect(0, 0, W, H)
      }
    }

    // the ground of a world seen from close: the horizon, and marks on it that go by with the ship
    const drawGround = (b: Body, hc: number, alpha: number, tex: Tex | null) => {
      const c: V = [b.x, b.y, b.z], nc = norm(sub(cam.p, c)), R = b.r
      const avg: RGB = [70, 70, 76], loc: RGB = [0, 0, 0]
      if (tex) texAt(tex, nc, avg) // the colour of the ground right below, from the world's map
      const day = clamp(dot(nc, SUN) * 1.4 + 0.2, 0.03, 1)
      const kh = Math.sqrt(Math.max(0, 1 - (R / (R + Math.max(hc, 0))) ** 2)) // the horizon: the directions whose dot with 'up' is -kh
      const A = dot(nc, CR), B = dot(nc, CU), C = dot(nc, CF)
      const gnd = (X: number, Y: number) => (A * X + B * Y + C) / Math.sqrt(X * X + Y * Y + 1) + kh // < 0: looking at the ground
      const STEP = 6, tops: number[] = [], bots: number[] = []
      for (let sx = 0; sx <= W + STEP; sx += STEP) {
        const X = (sx - cx) / F
        const g0 = gnd(X, cy / F) < 0, g1 = gnd(X, (cy - H) / F) < 0
        if (g0 && g1) { tops.push(0); bots.push(H) } else if (!g0 && !g1) { tops.push(-1); bots.push(-1) } else {
          let lo = 0, hi = H
          for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if ((gnd(X, (cy - m) / F) < 0) === g0) lo = m; else hi = m }
          if (g1) { tops.push(hi); bots.push(H) } else { tops.push(0); bots.push(hi) }
        }
      }
      bx.save()
      bx.globalAlpha = alpha
      bx.fillStyle = `rgb(${avg[0] * 0.8 * day | 0},${avg[1] * 0.8 * day | 0},${avg[2] * 0.8 * day | 0})`
      bx.beginPath()
      for (let i = 0; i < tops.length - 1; i++) {
        if (tops[i] < 0 || tops[i + 1] < 0) continue
        const x = i * STEP
        bx.moveTo(x, tops[i]); bx.lineTo(x + STEP, tops[i + 1]); bx.lineTo(x + STEP, bots[i + 1]); bx.lineTo(x, bots[i])
      }
      bx.fill()
      const atm = b.atm
      if (atm) { // haze along the horizon
        bx.strokeStyle = `rgba(${atm},${0.5 * day})`; bx.lineWidth = 12; bx.lineJoin = 'round'
        bx.beginPath()
        let open = false
        for (let i = 0; i < tops.length; i++) {
          const y = tops[i] > 0 ? tops[i] : bots[i] < H && bots[i] > 0 ? bots[i] : -1
          if (y < 0) { open = false; continue }
          if (!open) { bx.moveTo(i * STEP, y); open = true } else bx.lineTo(i * STEP, y)
        }
        bx.stroke()
      }
      // marks: craters, rocks, ridges, in cells fixed to the world (the axis nearest 'up' is dropped to give the ground its coordinates)
      if (LANDABLE[b.kind] && hc < 3e5) {
        const ax = Math.abs(nc[0]) >= Math.abs(nc[1]) && Math.abs(nc[0]) >= Math.abs(nc[2]) ? 0 : Math.abs(nc[1]) >= Math.abs(nc[2]) ? 1 : 2
        const i1 = (ax + 1) % 3, i2 = (ax + 2) % 3, sg = nc[ax] >= 0 ? 1 : -1
        const u0 = nc[i1] * R, v0 = nc[i2] * R
        const pt: V = [0, 0, 0], pc: V = [0, 0, 0]
        const surf = (u: number, v: number, o: V) => { const w2 = R * R - u * u - v * v; if (w2 <= 0) return false; o[ax] = c[ax] + Math.sqrt(w2) * sg; o[i1] = c[i1] + u; o[i2] = c[i2] + v; return true }
        for (let k = 0; k < 7; k++) {
          const g = 4 * Math.pow(6, k), lg = Math.log10(g / Math.max(hc, 2))
          const w = smooth(-1.6, -1.2, lg) * (1 - smooth(0.1, 0.6, lg))
          if (w < 0.03) continue
          const ci = Math.floor(u0 / g), cj = Math.floor(v0 / g)
          for (let di = -7; di <= 7; di++) for (let dj = -7; dj <= 7; dj++) {
            const ii = ci + di, jj = cj + dj, seedH = k * 7 + ax * 3 + (sg > 0 ? 0 : 50)
            const r1 = hash3(ii, jj, seedH + 100)
            if (r1 > 0.42) continue
            const r2 = hash3(ii, jj, seedH + 200), r3 = hash3(ii, jj, seedH + 300)
            const cu = (ii + r2) * g, cv = (jj + r3) * g, rad = g * (0.12 + 0.26 * r3)
            if (!surf(cu, cv, pc)) continue
            // not past the horizon
            if ((pc[0] - c[0]) * (cam.p[0] - pc[0]) + (pc[1] - c[1]) * (cam.p[1] - pc[1]) + (pc[2] - c[2]) * (cam.p[2] - pc[2]) <= 0) continue
            proj(pc, sp)
            const px = (rad * F) / sp[2]
            if (sp[2] < 1 || px < 1.2 || sp[0] < -px || sp[0] > W + px || sp[1] < -px || sp[1] > H + px) continue
            bx.beginPath()
            let ok = true
            for (let t = 0; t < 9; t++) {
              const an = (t / 9) * TAU
              if (!surf(cu + Math.cos(an) * rad, cv + Math.sin(an) * rad, pt)) { ok = false; break }
              proj(pt, sp)
              if (sp[2] < 1) { ok = false; break }
              if (t === 0) bx.moveTo(sp[0], sp[1]); else bx.lineTo(sp[0], sp[1])
            }
            if (!ok) continue
            bx.closePath()
            const dark = r1 < 0.28
            const m = dark ? 0.45 : 1.35
            if (tex) texAt(tex, [pc[0] - c[0], pc[1] - c[1], pc[2] - c[2]], loc); else { loc[0] = avg[0]; loc[1] = avg[1]; loc[2] = avg[2] }
            bx.fillStyle = `rgba(${loc[0] * m * day | 0},${loc[1] * m * day | 0},${loc[2] * m * day | 0},${(dark ? 0.55 : 0.4) * w})`
            bx.fill()
          }
        }
      }
      bx.restore()
    }

    // planets, far to near
    let building = false, ballBudget = 1, firstBudget = 3
    for (const s of seen) {
      const b = s.b
      if (b.kind === 'hole') continue
      // close to a world its picture is no use (a few hundred pixels stretched over the sky): the ground is drawn instead, fading in
      const hcam = s.d - b.r, gAlpha = smooth(0.25 * b.r, 0.05 * b.r, hcam)
      if (s.zc < 1 && gAlpha <= 0) continue
      const rpx = s.rpx, X = s.x, Y = s.y
      const ext = rpx * (b.ring ? 2.4 : 1.3)
      if (gAlpha <= 0 && (X < -ext || X > W + ext || Y < -ext || Y > H + ext)) continue
      if (rpx < 1.5 && gAlpha <= 0) { bx.fillStyle = 'rgba(205,212,230,0.85)'; bx.beginPath(); bx.arc(X, Y, 1.3, 0, TAU); bx.fill(); continue }
      if (!b.tex) b.tex = requestTexture(b.kind, b.seed)
      if (b.tex.step && !b.tex.ready && !building) { b.tex.step(3.5); building = true }
      const flat = rpx > 8000 || s.zc < 1 // too big for the picture
      const ready = b.tex.ready
      if (!ready) { if (!flat) { bx.fillStyle = 'rgba(40,44,56,0.9)'; bx.beginPath(); bx.arc(X, Y, rpx, 0, TAU); bx.fill() } if (gAlpha <= 0) continue }
      const ringHalf = (front: boolean) => {
        const n = b.ring
        if (!n) return
        const c0 = cross(n, [0, 0, 1])
        const a1: V = len(c0) < 1e-3 ? [1, 0, 0] : norm(c0), a2 = cross(n, a1)
        const bands = b.bands ?? []
        for (let i = 0; i < bands.length; i++) {
          const [from, to, op] = bands[i]
          const rad = ((from + to) / 2) * b.r
          bx.strokeStyle = `rgba(${b.tint[i % 2]},${op})`
          bx.lineWidth = Math.max(0.8, ((to - from) * b.r * F) / s.zc)
          let open = false
          for (let j = 0; j <= 80; j++) {
            const a = (j / 80) * TAU
            proj([b.x + (a1[0] * Math.cos(a) + a2[0] * Math.sin(a)) * rad, b.y + (a1[1] * Math.cos(a) + a2[1] * Math.sin(a)) * rad, b.z + (a1[2] * Math.cos(a) + a2[2] * Math.sin(a)) * rad], sp)
            const isFront = sp[2] < s.zc
            if (isFront === front && sp[2] > 1) { if (!open) { bx.beginPath(); bx.moveTo(sp[0], sp[1]); open = true } else bx.lineTo(sp[0], sp[1]) }
            else if (open) { bx.stroke(); open = false }
          }
          if (open) bx.stroke()
        }
      }
      if (!flat && ready) {
        ringHalf(false)
        if (b.atm) { // a thin glow at the edge
          const ag = bx.createRadialGradient(X, Y, rpx * 0.93, X, Y, rpx * 1.1)
          ag.addColorStop(0, `rgba(${b.atm},0.5)`); ag.addColorStop(1, `rgba(${b.atm},0)`)
          bx.fillStyle = ag
          bx.beginPath(); bx.arc(X, Y, rpx * 1.1, 0, TAU); bx.fill()
        }
        // the ball: painted from its map as it is seen from here and lit by the sun, again when the view has turned enough to show
        const S = clamp(Math.ceil((rpx * 2) / 32) * 32, 32, 256)
        const ez = norm(sub(cam.p, [b.x, b.y, b.z]))
        const old = b.ball
        if (!old || old.S !== S || dot(old.ez, ez) < 0.99997 || dot(old.cr, CR) < 0.99997) {
          if (old ? ballBudget > 0 : firstBudget > 0) {
            if (old) ballBudget--; else firstBudget--
            const ex = norm(sub(CR, mul(ez, dot(CR, ez))))
            const e1 = sub(sub(CU, mul(ez, dot(CU, ez))), mul(ex, dot(CU, ex)))
            renderBall(b, S, ex, norm(e1), ez)
          }
        }
        if (b.ball) bx.drawImage(b.ball.cv, X - rpx, Y - rpx, rpx * 2, rpx * 2)
        ringHalf(true)
      }
      if (gAlpha > 0) drawGround(b, hcam, gAlpha, ready ? b.tex : null)
    }

    // the black holes: the film's picture, moved and scaled in the page
    if (layer) {
      let hi = 0
      for (const s of seen) {
        if (s.b.kind !== 'hole' || hi >= 2 || s.zc < 1) continue
        const sc = s.rpx / 62
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

    // dust: it stays where it is while the ship goes by, so it streaks as fast as the ship goes; the layer that goes by at a pace the eye can follow shows most
    {
      fx.lineCap = 'round'
      const vmag = len(ship.v), trail = 0.06
      for (let k = 0; k < DUST_L; k++) {
        const B = DUST_BOX(k), u = Math.log10(B / Math.max(vmag, 1e-6)) // seconds to cross half the box (log)
        const wgt = (k === 0 ? 1 : smooth(0, 0.5, u)) * (1 - smooth(1.7, 2.4, u))
        if (wgt < 0.02) continue
        const base = k * DUST_N * 3, B2 = 2 * B, zmin = 4 + B * 0.01
        for (let i = 0; i < DUST_N; i++) {
          const wx = ((((dust[base + i * 3] - cam.p[0] + B) % B2) + B2) % B2) - B
          const wy = ((((dust[base + i * 3 + 1] - cam.p[1] + B) % B2) + B2) % B2) - B
          const wz = ((((dust[base + i * 3 + 2] - cam.p[2] + B) % B2) + B2) % B2) - B
          const zc = wx * CF[0] + wy * CF[1] + wz * CF[2]
          if (zc < zmin) continue
          const x = cx + ((wx * CR[0] + wy * CR[1] + wz * CR[2]) * F) / zc, y = cy - ((wx * CU[0] + wy * CU[1] + wz * CU[2]) * F) / zc
          if (x < 0 || x > W || y < 0 || y > H) continue
          const alpha = 0.55 * wgt * clamp(1.6 - zc / B, 0, 1)
          if (alpha <= 0.01) continue
          fx.strokeStyle = `rgba(215,225,240,${alpha})`
          fx.lineWidth = 1 + 0.12 * k
          fx.beginPath()
          // where it was a moment ago (the ship has moved, and the camera with it)
          const px = wx + ship.v[0] * trail, py = wy + ship.v[1] * trail, pz = wz + ship.v[2] * trail
          const pzc = px * CF[0] + py * CF[1] + pz * CF[2]
          if (vmag > 0.05 && pzc > zmin * 0.5) {
            const qx = cx + ((px * CR[0] + py * CR[1] + pz * CR[2]) * F) / pzc, qy = cy - ((px * CU[0] + py * CU[1] + pz * CU[2]) * F) / pzc
            const l = Math.hypot(qx - x, qy - y), cap = Math.min(1, 140 / (l || 1))
            fx.moveTo(x + (qx - x) * cap, y + (qy - y) * cap)
          } else fx.moveTo(x, y)
          fx.lineTo(x + 0.01, y)
          fx.stroke()
        }
      }
    }

    // ---- the ships ----
    // each strobe flashes on its own beat; only the Endurance the Ranger is lining up on has its rings lit by how the approach goes
    const lightOn = (id: number, S: Station | null) => (id === LIGHT_STROBE ? (t / 1.2 + (S ? S.id * 0.37 : 0)) % 1 < 0.5 : true)
    const lightColor = (id: number, S: Station | null): [number, number, number] => (id >= LIGHT_RING && id < LIGHT_RING + 4 ? (S && dock.st === S && dock.lights[id - LIGHT_RING] ? [70, 255, 110] : [255, 60, 50]) : LIGHT_COLORS[id])
    const glows: { x: number; y: number; r: number; c: [number, number, number] }[] = []
    // the Endurances drawn piece by piece: the two nearest that are more than a speck; the others are specks
    const depthOf = (S: Station) => dot(sub(S.p, cam.p), CF)
    const meshes = stations.filter(S => { const z = depthOf(S); return z > 1 && (ENDURANCE_RING * 1.3 * F) / z > 2.2 }).sort((a, b) => depthOf(a) - depthOf(b)).slice(0, 2)
    {
      const rg = rangerModel(), eg = enduranceModel()
      const nR = rg.length, gOff = nR + 2 * eg.length, tot = gOff + gg.length
      const P = scratch.P(tot), dep = scratch.dep(tot), nrm = scratch.nrm(tot), cen = scratch.cen(tot)
      const vis = scratch.vis
      vis.length = 0
      const out = [0, 0, 0]

      // one object's pieces on their way to the screen: its axes in the world, its place, a turn about its own z (the Endurance's spin)
      const place = (faces: Face[], off: number, ax: V, ay: V, az: V, pos: V, spin: number, stretch: number, squeeze: number, broken?: Uint8Array, sc = 1, ysc = 1, yoff = 0) => {
        const R00 = dot(CR, ax), R01 = dot(CR, ay), R02 = dot(CR, az)
        const R10 = dot(CU, ax), R11 = dot(CU, ay), R12 = dot(CU, az)
        const R20 = dot(CF, ax), R21 = dot(CF, ay), R22 = dot(CF, az)
        const d = sub(pos, cam.p)
        const t0 = dot(d, CR), t1 = dot(d, CU), t2 = dot(d, CF)
        const cs = Math.cos(spin), sn = Math.sin(spin)
        const xf = (x0: number, y0: number, z0: number, normal: boolean) => {
          let x = x0, y = normal ? y0 : y0 * ysc + yoff
          if (spin) { x = x0 * cs - y0 * sn; y = x0 * sn + y0 * cs }
          if (!normal) { x *= squeeze * sc; y *= squeeze * sc; z0 *= stretch * sc }
          out[0] = R00 * x + R01 * y + R02 * z0 + (normal ? 0 : t0)
          out[1] = R10 * x + R11 * y + R12 * z0 + (normal ? 0 : t1)
          out[2] = R20 * x + R21 * y + R22 * z0 + (normal ? 0 : t2)
        }
        for (let fi = 0; fi < faces.length; fi++) {
          if (broken && broken[fi]) continue
          const fc = faces[fi], id = off + fi
          let sx0 = 0, sy0 = 0, sz0 = 0
          for (let i = 0; i < fc.k; i++) {
            xf(fc.p[i * 3], fc.p[i * 3 + 1], fc.p[i * 3 + 2], false)
            if (out[2] < 0.5) { sz0 = -1; break }
            P[(id * MAXN + i) * 2] = cx + (out[0] * F) / out[2]
            P[(id * MAXN + i) * 2 + 1] = cy - (out[1] * F) / out[2]
            sx0 += out[0]; sy0 += out[1]; sz0 += out[2]
          }
          if (sz0 < 0) continue
          sx0 /= fc.k; sy0 /= fc.k; sz0 /= fc.k
          xf(fc.n[0], fc.n[1], fc.n[2], true)
          if (out[0] * sx0 + out[1] * sy0 + out[2] * sz0 >= 0) continue // looks away from the camera
          nrm[id * 3] = out[0]; nrm[id * 3 + 1] = out[1]; nrm[id * 3 + 2] = out[2]
          cen[id * 3] = sx0; cen[id * 3 + 1] = sy0; cen[id * 3 + 2] = sz0
          dep[id] = sz0
          vis.push(id)
        }
      }
      const stretch = mode === 'swallow' ? 1 + 3.5 * sw.p * sw.p : 1, squeeze = mode === 'swallow' ? Math.max(0.25, 1 - 0.75 * sw.p) : 1
      if (mode !== 'dead') {
        place(rg, 0, ship.r, ship.u, ship.f, ship.p, 0, stretch, squeeze, gone, RS)
        if (gear > 0.02) place(gg, gOff, ship.r, ship.u, ship.f, ship.p, 0, stretch, squeeze, undefined, RS, 2.6 * gear * (1 - 0.14 * Math.sin(Math.PI * touch)), -0.9)
      }
      meshes.forEach((S, k) => place(eg, nR + k * eg.length, S.x, S.y, S.z, S.p, S.spin, 1, 1))
      vis.sort((p, q) => dep[q] - dep[p])

      const tex = scratch.tex ?? (scratch.tex = rangerTexture())
      const alphaShip = mode === 'swallow' ? 1 - smooth(0.82, 1, sw.p) : 1
      fx.lineJoin = 'round'
      const dmgR = 1 - hull / 100
      const h01 = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
      // scorched armour: cracks across a big piece, more of them the worse the hull
      const cracks = (o: number, k: number, id: number, diag: number) => {
        if (dmgR < 0.2 || diag < 14) return
        let ccx = 0, ccy = 0
        for (let i = 0; i < k; i++) { ccx += P[o + i * 2]; ccy += P[o + i * 2 + 1] }
        ccx /= k; ccy /= k
        fx.strokeStyle = 'rgba(0,0,0,0.6)'; fx.lineWidth = 1; fx.beginPath()
        for (let c = 0, n = Math.min(5, 1 + ((dmgR * 7) | 0)); c < n; c++) {
          const a = h01(id * 7 + c) * TAU, l = diag * (0.2 + 0.3 * h01(id * 3 + c))
          const mx = ccx + Math.cos(a) * l * 0.5 + Math.sin(a) * l * 0.12, my = ccy + Math.sin(a) * l * 0.5 - Math.cos(a) * l * 0.12
          fx.moveTo(ccx, ccy); fx.lineTo(mx, my); fx.lineTo(ccx + Math.cos(a) * l, ccy + Math.sin(a) * l)
        }
        fx.stroke()
      }
      for (const id of vis) {
        const isR = id < nR, isG = id >= gOff, isS = isR || isG
        const fc = isR ? rg[id] : isG ? gg[id - gOff] : eg[(id - nR) % eg.length], o = id * MAXN * 2
        const owner = isS ? null : meshes[Math.floor((id - nR) / eg.length)]
        fx.globalAlpha = isS ? alphaShip : 1
        const nx = nrm[id * 3], ny = nrm[id * 3 + 1], nz = nrm[id * 3 + 2]
        if (fc.light >= 0) {
          if (!lightOn(fc.light, owner)) continue
          const col = lightColor(fc.light, owner)
          fx.beginPath(); fx.moveTo(P[o], P[o + 1])
          for (let i = 1; i < fc.k; i++) fx.lineTo(P[o + i * 2], P[o + i * 2 + 1])
          fx.closePath()
          fx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`
          fx.fill()
          glows.push({ x: (P[o] + P[o + 4]) / 2, y: (P[o + 1] + P[o + 5]) / 2, r: Math.max(2.5, Math.hypot(P[o + 4] - P[o], P[o + 5] - P[o + 1]) * 0.9), c: col })
          continue
        }
        const cx3 = cen[id * 3], cy3 = cen[id * 3 + 1], cz3 = cen[id * 3 + 2], cl = Math.hypot(cx3, cy3, cz3) || 1
        const vx3 = -cx3 / cl, vy3 = -cy3 / cl, vz3 = -cz3 / cl
        const lit = Math.max(0, nx * Lc[0] + ny * Lc[1] + nz * Lc[2])
        let hx = Lc[0] + vx3, hy = Lc[1] + vy3, hz = Lc[2] + vz3
        const hl = Math.hypot(hx, hy, hz) || 1
        hx /= hl; hy /= hl; hz /= hl
        const mt = MATS[fc.mat]
        const spec = lit > 0 ? Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), mt.shin) * mt.spec : 0
        // a hard sun, a very dark shadow: the sky gives a little cool light
        const sun = 1.8 * lit, amb = 0.035
        const dk = isS ? 1 - 0.55 * dmgR : 1 // soot
        const rgb = (m0: number) => { const m = m0 * dk; return `rgb(${clamp((mt.c[0] * (amb + sun) + spec * 255 + 6) * m, 0, 255) | 0},${clamp((mt.c[1] * (amb + sun) + spec * 255 + 8) * m, 0, 255) | 0},${clamp((mt.c[2] * (amb + sun) + spec * 255 + 14) * m, 0, 255) | 0})` }
        const diag = fc.k >= 4 ? Math.hypot(P[o + 4] - P[o], P[o + 5] - P[o + 1]) : 0
        if (diag < 1.2 && fc.k <= 4) continue
        if (fc.uv && diag > 5) {
          // the picture, then the sun on it
          drawPicture(fx, tex, P, o, fc.uv, fc.k)
          fx.beginPath(); fx.moveTo(P[o], P[o + 1])
          for (let i = 1; i < fc.k; i++) fx.lineTo(P[o + i * 2], P[o + i * 2 + 1])
          fx.closePath()
          fx.fillStyle = `rgba(2,4,9,${clamp(Math.max(1 - (0.05 + 1.9 * lit), isR ? dmgR * 0.6 : 0), 0, 0.97)})`
          fx.fill()
          if (spec > 0.02) {
            const sg = fx.createLinearGradient(P[o], P[o + 1], P[o + 4], P[o + 5])
            sg.addColorStop(0, `rgba(255,255,255,${Math.min(0.35, spec * 0.4)})`); sg.addColorStop(1, 'rgba(255,255,255,0)')
            fx.fillStyle = sg; fx.fill()
          }
          fx.strokeStyle = 'rgba(210,216,228,0.25)'; fx.lineWidth = 0.8; fx.stroke()
          if (isR) cracks(o, fc.k, id, diag)
          continue
        }
        fx.beginPath(); fx.moveTo(P[o], P[o + 1])
        for (let i = 1; i < fc.k; i++) fx.lineTo(P[o + i * 2], P[o + i * 2 + 1])
        fx.closePath()
        if (diag > 26) {
          const gr = fx.createLinearGradient(P[o], P[o + 1], P[o + 4], P[o + 5])
          gr.addColorStop(0, rgb(1.12)); gr.addColorStop(1, rgb(0.86))
          fx.fillStyle = gr
        } else fx.fillStyle = rgb(1)
        fx.fill()
        if (diag > 5) { fx.strokeStyle = `rgba(215,222,235,${0.1 + 0.3 * lit})`; fx.lineWidth = 0.7; fx.stroke() }
        if (isR) cracks(o, fc.k, id, diag)
        if (fc.k === 4 && diag > 38) {
          // a panel set into the face
          const ccx = (P[o] + P[o + 2] + P[o + 4] + P[o + 6]) / 4, ccy = (P[o + 1] + P[o + 3] + P[o + 5] + P[o + 7]) / 4
          fx.beginPath()
          for (let i = 0; i < 4; i++) { const x = ccx + (P[o + i * 2] - ccx) * 0.78, y = ccy + (P[o + i * 2 + 1] - ccy) * 0.78; if (i === 0) fx.moveTo(x, y); else fx.lineTo(x, y) }
          fx.closePath()
          fx.fillStyle = 'rgba(0,0,0,0.14)'; fx.fill()
          fx.strokeStyle = 'rgba(255,255,255,0.07)'; fx.lineWidth = 0.6; fx.stroke()
          if (fc.win && diag > 44) { // a row of lit windows
            const ux = P[o + 2] - P[o], uy = P[o + 3] - P[o + 1], vx2 = P[o + 6] - P[o], vy2 = P[o + 7] - P[o + 1]
            fx.fillStyle = 'rgba(255,208,140,0.55)'
            for (const u of [0.2, 0.4, 0.6, 0.8]) {
              const wx = P[o] + ux * u + vx2 * 0.5, wy = P[o + 1] + uy * u + vy2 * 0.5
              fx.beginPath()
              fx.moveTo(wx - ux * 0.03 - vx2 * 0.07, wy - uy * 0.03 - vy2 * 0.07); fx.lineTo(wx + ux * 0.03 - vx2 * 0.07, wy + uy * 0.03 - vy2 * 0.07)
              fx.lineTo(wx + ux * 0.03 + vx2 * 0.07, wy + uy * 0.03 + vy2 * 0.07); fx.lineTo(wx - ux * 0.03 + vx2 * 0.07, wy - uy * 0.03 + vy2 * 0.07)
              fx.closePath(); fx.fill()
            }
          }
        }
      }
      fx.globalAlpha = 1

      // the Ranger's engines: three small glows at the tail, brighter with the push, and a flame streaming back
      if (mode !== 'dead' && retro > 0.04 && !dock.on) { // the engines under the ship that slow its fall: a glow at each foot
        const d = sub(ship.p, cam.p)
        fx.globalCompositeOperation = 'lighter'
        for (const [gx, gz] of [[-3.2, 6], [3.2, 6], [-3.7, -8], [3.7, -8]]) {
          const lp = add(add(mul(ship.r, gx * RS), mul(ship.u, -0.95 * RS)), mul(ship.f, gz * RS))
          const zc = dot(d, CF) + dot(lp, CF)
          if (zc < 1) continue
          const x = cx + ((dot(d, CR) + dot(lp, CR)) * F) / zc, y = cy - ((dot(d, CU) + dot(lp, CU)) * F) / zc
          const r = ((1 + 2.2 * retro) * RS * F) / zc * (0.85 + 0.15 * Math.sin(t * 50 + gx))
          const g = fx.createRadialGradient(x, y, 0, x, y, r)
          g.addColorStop(0, `rgba(255,240,210,${0.55 * retro})`); g.addColorStop(0.4, `rgba(255,170,80,${0.28 * retro})`); g.addColorStop(1, 'rgba(255,100,40,0)')
          fx.fillStyle = g
          fx.beginPath(); fx.arc(x, y, r, 0, TAU); fx.fill()
        }
        fx.globalCompositeOperation = 'source-over'
      }
      if (mode !== 'dead' && dock.on && dock.st && ship.thr > 0.05) { // docked: the Endurance's engines glow at its far end
        const S = dock.st
        proj(add(S.p, mul(S.z, -40 * ES)), sp)
        if (sp[2] > 1) {
          const r = ((14 + 26 * ship.thr) * ES * F) / sp[2], g = fx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], r)
          g.addColorStop(0, `rgba(210,235,255,${0.9 * ship.thr})`); g.addColorStop(0.4, `rgba(110,170,255,${0.5 * ship.thr})`); g.addColorStop(1, 'rgba(80,130,255,0)')
          fx.globalCompositeOperation = 'lighter'
          fx.fillStyle = g
          fx.beginPath(); fx.arc(sp[0], sp[1], r, 0, TAU); fx.fill()
          fx.globalCompositeOperation = 'source-over'
        }
      }
      if (mode !== 'dead' && !dock.on) {
        const d = sub(ship.p, cam.p)
        const b0 = dot(d, CR), b1 = dot(d, CU), b2 = dot(d, CF)
        for (const nxm of [-2.6, 0, 2.6]) {
          const lp = add(add(mul(ship.r, nxm * RS), mul(ship.u, 0.45 * RS)), mul(ship.f, -13.9 * RS))
          const zc = b2 + dot(lp, CF)
          if (zc < 1) continue
          const x = cx + ((b0 + dot(lp, CR)) * F) / zc, y = cy - ((b1 + dot(lp, CU)) * F) / zc
          const r = (((1.2 + 5 * ship.thr) * RS * F) / zc) * (0.85 + 0.15 * Math.sin(t * 40 + nxm))
          const g = fx.createRadialGradient(x, y, 0, x, y, r)
          g.addColorStop(0, `rgba(190,225,255,${0.2 + 0.75 * ship.thr})`); g.addColorStop(0.4, `rgba(110,170,255,${0.1 + 0.4 * ship.thr})`); g.addColorStop(1, 'rgba(80,130,255,0)')
          fx.globalCompositeOperation = 'lighter'
          fx.fillStyle = g
          fx.beginPath(); fx.arc(x, y, r, 0, TAU); fx.fill()
          if (ship.thr > 0.05) {
            const tl = add(lp, mul(ship.f, -(5 + 34 * ship.thr) * RS * (0.9 + 0.1 * Math.sin(t * 55 + nxm))))
            const zt = b2 + dot(tl, CF)
            if (zt > 1) {
              const tx = cx + ((b0 + dot(tl, CR)) * F) / zt, ty = cy - ((b1 + dot(tl, CU)) * F) / zt
              const fg = fx.createLinearGradient(x, y, tx, ty)
              fg.addColorStop(0, `rgba(170,215,255,${0.7 * ship.thr})`); fg.addColorStop(1, 'rgba(80,130,255,0)')
              fx.strokeStyle = fg; fx.lineWidth = Math.max(1.2, r * 0.7); fx.lineCap = 'round'
              fx.beginPath(); fx.moveTo(x, y); fx.lineTo(tx, ty); fx.stroke()
            }
          }
          fx.globalCompositeOperation = 'source-over'
        }
      }
      // smoke and sparks off a hurt hull
      if (mode === 'fly' && dmgR > 0.25) {
        emitAcc += dt * (dmgR * 14)
        while (emitAcc >= 1) {
          emitAcc -= 1
          const fi = (Math.random() * rgFaces.length) | 0
          if (gone[fi]) continue
          const fc = rgFaces[fi]
          const w = add(add(add(ship.p, mul(ship.r, fc.p[0] * RS)), mul(ship.u, fc.p[1] * RS)), mul(ship.f, fc.p[2] * RS))
          const spark = dmgR > 0.45 && Math.random() < 0.4
          bits.push({ p: w, v: add(add(ship.v, mul(ship.f, spark ? -2 : -6)), [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4]), life: spark ? 0.5 : 2.4, max: spark ? 0.5 : 2.4, s: spark ? 0.5 : 0.5 + Math.random() * 0.7, kind: spark ? 1 : 2 })
        }
      }
      if (bits.length > 400) bits.splice(0, bits.length - 400)
      for (let i = bits.length - 1; i >= 0; i--) {
        const q = bits[i]
        q.life -= dt
        if (q.life <= 0) { bits.splice(i, 1); continue }
        q.p = add(q.p, mul(q.v, dt))
        proj(q.p, sp)
        if (sp[2] < 1 || sp[0] < -20 || sp[0] > W + 20 || sp[1] < -20 || sp[1] > H + 20) continue
        const px = (q.s * F) / sp[2], a = clamp(q.life / q.max, 0, 1)
        if (q.kind === 0) { // a shard, tumbling
          const r = clamp(px, 1.2, 16), an = q.life * 5 + i
          fx.globalAlpha = Math.min(1, a * 3)
          const mc = MATS[q.c ?? 1].c; fx.fillStyle = `rgb(${mc[0] * 0.7 | 0},${mc[1] * 0.7 | 0},${mc[2] * 0.72 | 0})`
          fx.beginPath()
          fx.moveTo(sp[0] + Math.cos(an) * r, sp[1] + Math.sin(an) * r)
          fx.lineTo(sp[0] + Math.cos(an + 2.3) * r * 0.7, sp[1] + Math.sin(an + 2.3) * r * 0.7)
          fx.lineTo(sp[0] + Math.cos(an + 4.1) * r * 0.5, sp[1] + Math.sin(an + 4.1) * r * 0.5)
          fx.closePath(); fx.fill()
          fx.globalAlpha = 1
        } else if (q.kind === 1) { // a spark
          fx.globalCompositeOperation = 'lighter'
          fx.fillStyle = `rgba(255,${150 + 80 * a | 0},60,${a})`
          fx.beginPath(); fx.arc(sp[0], sp[1], Math.max(1, px), 0, TAU); fx.fill()
          fx.globalCompositeOperation = 'source-over'
        } else if (q.kind === 3) { // dust off the ground
          const r = Math.max(1.5, px * (1 + (1 - a) * 3))
          fx.fillStyle = `rgba(${q.col},${0.3 * a})`
          fx.beginPath(); fx.arc(sp[0], sp[1], r, 0, TAU); fx.fill()
        } else { // smoke, spreading
          const r = Math.max(1.5, (px * (1 + (1 - a) * 2.5)))
          fx.fillStyle = `rgba(70,72,80,${0.2 * a})`
          fx.beginPath(); fx.arc(sp[0], sp[1], r, 0, TAU); fx.fill()
        }
      }
      if (mode === 'dead') { // the fireball
        proj(ship.p, sp)
        if (sp[2] > 1) {
          const p = clamp(deadT / 2.4, 0, 1), r = ((10 + 110 * ease(p)) * F) / sp[2], a = Math.pow(1 - p, 1.5)
          const g = fx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], r)
          g.addColorStop(0, `rgba(255,245,210,${a})`); g.addColorStop(0.35, `rgba(255,170,60,${0.8 * a})`); g.addColorStop(1, 'rgba(255,80,20,0)')
          fx.globalCompositeOperation = 'lighter'
          fx.fillStyle = g
          fx.beginPath(); fx.arc(sp[0], sp[1], r, 0, TAU); fx.fill()
          fx.globalCompositeOperation = 'source-over'
        }
      }
      // the lights' glow
      fx.globalCompositeOperation = 'lighter'
      for (const gl of glows) {
        const g = fx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r)
        g.addColorStop(0, `rgba(${gl.c[0]},${gl.c[1]},${gl.c[2]},0.5)`); g.addColorStop(1, `rgba(${gl.c[0]},${gl.c[1]},${gl.c[2]},0)`)
        fx.fillStyle = g
        fx.beginPath(); fx.arc(gl.x, gl.y, gl.r, 0, TAU); fx.fill()
      }
      // the Endurances far off: a speck in the sun, with a strobe
      for (const S of stations) {
        if (meshes.includes(S) || depthOf(S) <= 1) continue
        proj(S.p, sp)
        if (sp[0] > -10 && sp[0] < W + 10 && sp[1] > -10 && sp[1] < H + 10) {
          // looks like any star but swells to 1.7 times its size and back every 1.2 seconds, so it can be told from the stars at any distance
          const pulse = 1 + 0.7 * (0.5 - 0.5 * Math.cos(((t + S.id * 0.37) / 1.2) * TAU))
          fx.fillStyle = 'rgb(255,255,255)'
          fx.beginPath(); fx.arc(sp[0], sp[1], 1.4 * pulse, 0, TAU); fx.fill()
        }
      }
      fx.globalCompositeOperation = 'source-over'
    }

    // the sun: a bright point at infinity, with a glare round it; planets in front of it hide it
    {
      const zc = Lc[2]
      if (zc > 0.02) {
        const x = cx + (Lc[0] * F) / zc, y = cy - (Lc[1] * F) / zc
        let hidden = false
        for (const s of seen) if (s.b.kind !== 'hole' && s.zc > 1 && Math.hypot(x - s.x, y - s.y) < s.rpx * 0.98) hidden = true
        if (!hidden && x > -300 && x < W + 300 && y > -300 && y < H + 300) {
          fx.globalCompositeOperation = 'lighter'
          const big = F * 0.5, g = fx.createRadialGradient(x, y, 0, x, y, big)
          g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.03, 'rgba(255,240,205,0.8)'); g.addColorStop(0.18, 'rgba(255,214,150,0.22)'); g.addColorStop(1, 'rgba(255,190,120,0)')
          fx.fillStyle = g
          fx.beginPath(); fx.arc(x, y, big, 0, TAU); fx.fill()
          // a cross of light, as a lens makes
          const lg = fx.createLinearGradient(x - big * 1.2, y, x + big * 1.2, y)
          lg.addColorStop(0, 'rgba(255,230,190,0)'); lg.addColorStop(0.5, 'rgba(255,240,215,0.5)'); lg.addColorStop(1, 'rgba(255,230,190,0)')
          fx.fillStyle = lg; fx.fillRect(x - big * 1.2, y - 0.7, big * 2.4, 1.4)
          fx.globalCompositeOperation = 'source-over'
          // looking right at it whites the view a little
          const facing = smooth(0.985, 0.9995, Lc[2])
          if (facing > 0) { fx.fillStyle = `rgba(255,248,235,${facing * 0.35})`; fx.fillRect(0, 0, W, H) }
        }
      }
    }

    // the glow of air at speed
    if (heat > 0.03 && mode === 'fly') {
      const hg = fx.createRadialGradient(W / 2, H * 0.62, H * 0.1, W / 2, H * 0.62, Math.max(W, H) * 0.75)
      hg.addColorStop(0, `rgba(255,170,70,${heat * 0.3})`); hg.addColorStop(1, `rgba(255,60,20,${heat * 0.55})`)
      fx.globalCompositeOperation = 'lighter'
      fx.fillStyle = hg; fx.fillRect(0, 0, W, H)
      fx.globalCompositeOperation = 'source-over'
    }

    // falling into a hole: the view darkens, then a white flash
    if (mode === 'swallow') {
      const vg = fx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.7)
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${sw.p * 0.95})`)
      fx.fillStyle = vg; fx.fillRect(0, 0, W, H)
      fx.fillStyle = `rgba(0,0,0,${smooth(0.5, 0.9, sw.p)})`; fx.fillRect(0, 0, W, H)
    }
    if (flash > 0.01) { fx.fillStyle = `rgba(255,255,255,${clamp(flash, 0, 1)})`; fx.fillRect(0, 0, W, H) }

    if (t - hudAt > 0.1) {
      hudAt = t
      let planet = Infinity
      for (const b of list) planet = Math.min(planet, Math.max(0, len(sub(ship.p, [b.x, b.y, b.z])) - b.r))
      let note = ''
      if (landedOn) note = '착륙 완료 · 가속하면 이륙해요'
      else if (dock.on && dock.t >= 1) note = '도킹 완료 · 같이 날아가요 (최대속도 2배)'
      else if (hb && LANDABLE[hb.kind] && hAlt < LAND_H && gear > 0.5) {
        const down = -dot(ship.v, norm(sub(ship.p, [hb.x, hb.y, hb.z])))
        note = `고도 ${fmtDist(Math.max(0, hAlt - HOVER))} · 하강 ${down.toFixed(1)} m/s${down > LAND_V ? ' · 너무 빨라요!' : ''}`
      } else if (heat > 0.25) note = '대기권 진입 중'
      else if (gear > 0.5) note = '착륙 장치 내려감'
      cb.hud({ speed: len(ship.v), planet, hull, note, docked: dock.on && dock.t >= 1 })
    }
  }

  // buffers for drawing the ships, made once for the models
  const scratch = (() => {
    let P: Float32Array | null = null, dep: Float32Array | null = null, nrm: Float32Array | null = null, cen: Float32Array | null = null
    return {
      P: (n: number) => (P ??= new Float32Array(n * MAXN * 2)),
      dep: (n: number) => (dep ??= new Float32Array(n)),
      nrm: (n: number) => (nrm ??= new Float32Array(n * 3)),
      cen: (n: number) => (cen ??= new Float32Array(n * 3)),
      vis: [] as number[],
      tex: null as HTMLCanvasElement | null,
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
    debug: () => { const S = dock.st ?? nearStation()?.S ?? stations[0]; return { hull, gear, retro, landed: !!landedOn, heat, hurt: (a: number) => hurt(a, null), ship, E: { pos: S.p, x: S.x, y: S.y, z: S.z, spin: S.spin }, stations: stations.map(x => ({ id: x.id, p: x.p })), dock, metrics: dockMetrics({ ship: ship.p, f: ship.f, u: ship.u, vel: ship.v, e: S.p, ex: S.x, ey: S.y, ez: S.z, spin: S.spin }), mode, bodies: list.map(b => ({ id: b.id, kind: b.kind, x: b.x, y: b.y, z: b.z, r: b.r, ring: b.ring, name: b.name, ready: !!b.tex?.ready })) } },
  }
}
