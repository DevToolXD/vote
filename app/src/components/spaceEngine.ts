// 인터스텔라's world, in metres and seconds. The Ranger 1 flies by Newton: it keeps the speed it has (a flight computer turns the
// speed round to follow the nose, and caps what the engines will add by how near the nearest thing is), turns by rates about its
// own three axes (so it can roll freely), and a camera follows behind and above. The sky is the stars at infinity and the sun, a
// fixed light the planets, the Endurance and the Ranger are all lit by. At the start there is nothing but a blinking light far
// ahead: the Endurance, spinning on its axis. To dock the Ranger has to come in along the axis nose first, slowly, with its key
// lined up with the port's AND turning with it (spaceDock.ts); the four rings of lights on the port say which of those is wrong.
//
// The Ranger and the Endurance are drawn in the front canvas, stars, sun and planets in the back one, and the black holes (the
// film's animated picture) are DOM images between the two so the picture keeps its animation and full quality.

import { ATMOSPHERE, KIND_RADIUS, SATURN_RINGS, hash3, planetSprite, rngOf, smooth, type Kind, type Sprite } from './spacePlanets'
import { ENDURANCE_RING, LIGHT_COLORS, LIGHT_RING, LIGHT_STROBE, MATS, drawPicture, enduranceModel, rangerModel, rangerTexture, type Face } from './spaceModels'
import { NOSE, PORT_Z, dockMetrics, dockVerdict, keyDir, wrapPi, type V } from './spaceDock'

export type Input = { yaw: number; pitch: number; roll: number; rollStop: boolean; thrust: boolean; brake: boolean }
export type Engine = {
  attach(back: HTMLCanvasElement, front: HTMLCanvasElement, layer: HTMLElement): void
  detach(): void
  resize(w: number, h: number, dpr: number): void
  frame(now: number, inp: Input): void
  debug(): unknown
}
/** What the screen writes: the speed (m/s), the distance to the nearest planet's surface (m) and the hull (100 = whole). */
export type Callbacks = { hud: (h: { speed: number; planet: number; hull: number }) => void; haptic: (pattern: number[]) => void }

type Body = { id: string; kind: Kind; x: number; y: number; z: number; r: number; seed: number; sprite: Sprite | null; ring: V | null }

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
const CAM_BACK = 36, CAM_RISE = 17 // the camera, behind and above the Ranger (metres)
const PITCH_MAX = 0.7, YAW_MAX = 0.7 // rad/s at a full push (the ship holds its attitude when let go)
const ROLL_ACC = 0.4 // rad/s² while a roll button is held (a tap of a tenth of a second is a few hundredths of a rad/s: fine enough to match the port's turn); the roll then goes on (nothing slows it)
const VMAX_CAP = 6e6 // what the engines add per second at most, far from everything
const VMAX = 1.5e6 // top speed (m/s): fast, but a planet can still be seen coming
const CRASH_V = 12 // into a planet faster than this (m/s) and the Ranger blows up
const RING_REACH = 40 // how close to Saturn's ring plane the ship must be to be hit by the rings (m)
const MAX_ST = 35 // Endurances alive at once
const HOLE_G = 1.5e7 // m/s² at a black hole's edge
const SHIP_R = 7 // the Ranger's body, for hitting things
const MAXN = 8
const HOLE_IMG = { w: 600, h: 360, cx: 300, cy: 180 } // the film's picture: its size and the centre of the hole in it

/** An Endurance: where, the axes of its own frame (z out of its docking port) and how far it has turned. */
type Station = { p: V; x: V; y: V; z: V; spin: number; w: number; id: number }
function makeStation(p: V, z0: V, spin: number, w: number, id: number): Station {
  const z = norm(z0), x = norm(cross(Math.abs(z[1]) > 0.98 ? [1, 0, 0] : [0, 1, 0], z))
  return { p, x, y: cross(z, x), z, spin, w, id }
}

function makeBody(id: string, kind: Kind, p: V, r: number, seed: number): Body {
  const rnd = rngOf(seed)
  let ring: V | null = null
  if (kind === 'saturn') { const a = (rnd() - 0.5) * 0.9, b = (rnd() - 0.5) * 0.9; ring = norm([Math.sin(a) * 0.45, 1, Math.sin(b) * 0.45]) }
  return { id, kind, x: p[0], y: p[1], z: p[2], r, seed, sprite: null, ring }
}
const WEIGHTS: [Kind, number][] = [['moon', 0.2], ['mars', 0.2], ['earth', 0.12], ['neptune', 0.14], ['jupiter', 0.15], ['saturn', 0.13], ['hole', 0.06]]
function pickKind(r: number): Kind {
  let acc = 0
  for (const [k, w] of WEIGHTS) { acc += w; if (r < acc) return k }
  return 'moon'
}

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
  const rgFaces = rangerModel()
  const gone = new Uint8Array(rgFaces.length)
  const breakAt = new Float32Array(rgFaces.length) // the damage (0..1) at which each piece comes off: the small fittings first, the armour last
  for (let i = 0; i < rgFaces.length; i++) { const x = Math.sin(i * 12.9898) * 43758.5453; breakAt[i] = i < 8 ? 0.8 + 0.02 * i : 0.06 + 0.7 * (x - Math.floor(x)) }
  type Bit = { p: V; v: V; life: number; max: number; s: number; kind: 0 | 1 | 2; c?: number } // a shard, a spark, a puff of smoke
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
      if (rnd() > 0.78) {
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
  function nearest() {
    let d = Infinity
    // each Endurance's hull: the spine (a rod) and the ring (a ring of modules), not its centre
    for (const S of stations) {
      const d3 = sub(ship.p, S.p), lx = dot(d3, S.x), ly = dot(d3, S.y), lz = dot(d3, S.z), rho = Math.hypot(lx, ly)
      d = Math.min(d, Math.max(3, Math.min(Math.hypot(rho, lz - clamp(lz, -36, PORT_Z + 2)) - 6.3, Math.hypot(rho - ENDURANCE_RING, lz) - 11)))
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
  function stepControl(inp: Input, dt: number) {
    const kp = 1 - Math.exp(-dt * 5)
    ship.wp += (-inp.pitch * PITCH_MAX - ship.wp) * kp // pushed down = nose down
    ship.wy += (inp.yaw * YAW_MAX - ship.wy) * kp
    if (inp.rollStop) ship.wr *= Math.exp(-dt * 4)
    else ship.wr = clamp(ship.wr + inp.roll * ROLL_ACC * dt, -1.5, 1.5)
    turnShip(ship.wp * dt, ship.wy * dt, ship.wr * dt)

    // near things the engines push gently, so a docking can be done by hand; the push grows with the speed, so far from everything it climbs to the top speed
    const aT = clamp(0.6 * clamp(0.08 * nearest(), 0.35, VMAX_CAP), 0.5, 5e6)
    ship.thr += ((inp.thrust ? 1 : 0) - ship.thr) * (1 - Math.exp(-dt * 6))
    if (inp.thrust) { const s0 = len(ship.v); ship.v = add(ship.v, mul(ship.f, (aT + 0.35 * s0 * Math.max(0, 1 - s0 / VMAX)) * dt)) }
    if (inp.brake) {
      const sp = len(ship.v)
      if (sp > 0) ship.v = mul(ship.v, 1 - Math.min(sp, Math.max(aT, 0.6 * sp) * dt) / sp)
    }
    // flight assist: the velocity turns round to follow the nose (forward or backward, whichever it is nearer) without losing speed
    const sp = len(ship.v)
    if (sp > VMAX) ship.v = mul(ship.v, VMAX / sp)
    if (sp > 1e-4) {
      const vf = dot(ship.v, ship.f), tgt = mul(ship.f, vf >= 0 ? sp : -sp)
      const k = 1 - Math.exp(-dt / 2)
      const nv = add(mul(ship.v, 1 - k), mul(tgt, k))
      const nl = len(nv)
      if (nl > 0) ship.v = mul(nv, Math.min(sp, VMAX) / nl)
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
    const p1 = add(p0, mul(ship.v, dt))
    // Saturn's rings: only close to them, and only a little at a time
    if (elapsed > ringT) {
      for (const b of list) {
        if (!b.ring) continue
        const c: V = [b.x, b.y, b.z], h0 = dot(sub(p0, c), b.ring), h1 = dot(sub(p1, c), b.ring)
        if (Math.abs(h1) > RING_REACH && h0 * h1 >= 0) continue
        const q = h0 * h1 < 0 ? add(p0, mul(sub(p1, p0), h0 / (h0 - h1))) : p1
        const rel = sub(q, c), rho = len(sub(rel, mul(b.ring, dot(rel, b.ring)))) / b.r
        if (SATURN_RINGS.some(([from, to, op]) => rho >= from && rho < to && op >= 0.2)) { ringT = elapsed + 0.45; hurt(3 + Math.random() * 2, null); break }
      }
      if (mode !== 'fly') return
    }
    let hit: { t: number; b: Body } | null = null
    for (const b of list) {
      const t = segHit(p0, p1, [b.x, b.y, b.z], b.kind === 'hole' ? b.r * 1.35 : b.r + 12)
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
    ship.p = add(c, mul(n, b.r + 14)) // out past the hit distance, so the next step starts free of it
    if (into > CRASH_V) { explode(); return }
    bump(n, 2)
    ship.v = mul(ship.v, 0.6)
    if (into > 2) hurt(5 + into * 0.4, n)
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
      x /= fc.k; y /= fc.k; z /= fc.k
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
    stationId = 1; spawnT = 0; elapsed = 0
    dock.on = false; dock.st = null; dock.lights = [false, false, false, false]; dock.haveRoll = false
    secKey = ''; ensureSectors()
    flash = 1; mode = 'fly'
  }

  /** The Endurances appear as the Ranger flies: always one close, and a crowd of them further out (all that is spread wider the faster it goes). */
  function manageStations(dt: number) {
    spawnT += dt
    if (spawnT < 1 || elapsed < 15) return
    spawnT = 0
    const sc = 1 + len(ship.v) / 3000
    for (let i = stations.length - 1; i >= 0; i--) if (stations[i] !== dock.st && len(sub(stations[i].p, ship.p)) > 500000 * sc) stations.splice(i, 1)
    let near = Infinity
    for (const S of stations) near = Math.min(near, len(sub(S.p, ship.p)))
    const spawn = (lo: number, hi: number) => {
      const r = () => Math.random() * 2 - 1
      const dir = norm(add(ship.f, mul(norm([r(), r(), r()]), 0.9))) // mostly ahead, where it is seen
      stations.push(makeStation(add(ship.p, mul(dir, (lo + Math.random() * (hi - lo)) * sc)), [r(), r(), r()], Math.random() * TAU, 0.08 + Math.random() * 0.08, stationId++))
    }
    if (near > 60000 * sc) spawn(20000, 45000)
    if (stations.length < MAX_ST) spawn(30000, 180000)
  }

  /** The Endurance: its docking test, the lights, and the hits. */
  function stepStation(S: Station, dt: number) {
    dock.cool = Math.max(0, dock.cool - dt)
    if (len(sub(ship.p, S.p)) > 600) { if (dock.st === S) { dock.lights = [false, false, false, false]; dock.haveRoll = false } return }
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
    if (lz > -36 && lz < PORT_Z + 2 && rho < 6.3 + SHIP_R) {
      const rr = rho || 1e-6
      n = add(mul(S.x, lx / rr), mul(S.y, ly / rr)); over = 6.3 + SHIP_R - rho
    } else {
      const dr = Math.hypot(rho - ENDURANCE_RING, lz)
      if (dr < 11 + SHIP_R && rho > 20) {
        const rr = rho || 1e-6, q = dr || 1e-6
        n = add(add(mul(S.x, (lx / rr) * ((rho - ENDURANCE_RING) / q)), mul(S.y, (ly / rr) * ((rho - ENDURANCE_RING) / q))), mul(S.z, lz / q))
        over = 11 + SHIP_R - dr
      }
    }
    if (n) { const nn = norm(n); ship.p = add(ship.p, mul(nn, over + 0.05)); bump(nn, 1) }
  }

  function stepDocked(inp: Input, dt: number) {
    const S = dock.st
    if (!S) { dock.on = false; return }
    dock.t = Math.min(1, dock.t + dt / 0.9)
    const k = ease(dock.t)
    // where it ends up: the nose tip at the port's face, the Ranger's key on the port's key
    const toP = add(S.p, mul(S.z, PORT_Z + NOSE)), toF = mul(S.z, -1), toU = keyDir(S.x, S.y, S.spin)
    ship.p = dock.t < 1 ? add(mul(dock.from.p, 1 - k), mul(toP, k)) : toP
    const f = norm(add(mul(dock.from.f, 1 - k), mul(toF, k))), uu = add(mul(dock.from.u, 1 - k), mul(toU, k))
    const r = norm(cross(sub(uu, mul(f, dot(uu, f))), f))
    ship.f = f; ship.r = r; ship.u = norm(cross(f, r))
    ship.v = [0, 0, 0]; ship.wp = ship.wy = ship.wr = 0
    ship.thr += (0 - ship.thr) * 0.2
    // pushing the engine lets go: a slow push away along the axis, still turning with the Endurance
    if (inp.thrust && dock.t >= 1) {
      dock.on = false; dock.cool = 4
      ship.v = mul(S.z, 1.5)
      const du = mul(add(mul(S.x, -Math.cos(S.spin)), mul(S.y, -Math.sin(S.spin))), S.w)
      ship.wr = dot(du, ship.r)
    }
  }

  // ---- the frame ----
  function frame(now: number, inp: Input) {
    if (!back || !front) return
    const t = now / 1000
    if (lastTs === 1) { lastTs = t; return }
    const dt = Math.min(0.05, Math.max(0, t - lastTs))
    lastTs = t
    elapsed += dt
    ensureSectors()

    for (const S of stations) S.spin += S.w * dt
    if (mode === 'fly') {
      manageStations(dt)
      if (dock.on) stepDocked(inp, dt)
      else {
        stepControl(inp, dt)
        // near an Endurance the move is cut into steps a few metres long, so a fast ship cannot pass through it
        const ns = nearStation(), close = !!ns && ns.d < 900
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

    // ---- the camera follows: its direction turns after the ship's, a moment later ----
    const kc = 1 - Math.exp(-dt * 4.5)
    cam.f = norm(add(mul(cam.f, 1 - kc), mul(ship.f, kc)))
    cam.u = add(mul(cam.u, 1 - kc), mul(ship.u, kc))
    cam.u = norm(sub(cam.u, mul(cam.f, dot(cam.f, cam.u))))
    const intro = ease(elapsed / 2.4)
    // the faster it goes, the further back the camera hangs and the wider the view, so the speed is felt
    camSp += (clamp(Math.log10(1 + len(ship.v) / 30) / 4.5, 0, 1) - camSp) * (1 - Math.exp(-dt * 2))
    const back0 = lerp(CAM_BACK * 14, CAM_BACK, intro) * (1 + 0.7 * camSp)
    cam.p = add(sub(ship.p, mul(cam.f, back0)), mul(cam.u, CAM_RISE * (0.4 + 0.6 * intro)))
    // it looks at a point a little ahead of the ship, so the ship sits low in the view but not at its edge
    cam.fv = norm(sub(add(ship.p, mul(cam.f, 30)), cam.p))
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

    // planets, far to near
    let building = false
    for (const s of seen) {
      const b = s.b
      if (b.kind === 'hole' || s.zc < 1) continue
      const rpx = s.rpx, X = s.x, Y = s.y
      const ext = rpx * (b.ring ? 2.4 : 1.3)
      if (X < -ext || X > W + ext || Y < -ext || Y > H + ext) continue
      if (rpx < 1.5) { bx.fillStyle = 'rgba(205,212,230,0.85)'; bx.beginPath(); bx.arc(X, Y, 1.3, 0, TAU); bx.fill(); continue }
      if (!b.sprite) b.sprite = planetSprite(b.kind, b.seed, rpx > 60 ? 320 : 224)
      if (!b.sprite.done && !building) { b.sprite.step(3.5); building = true }
      if (!b.sprite.done) { bx.fillStyle = 'rgba(40,44,56,0.9)'; bx.beginPath(); bx.arc(X, Y, rpx, 0, TAU); bx.fill(); continue }
      const ringHalf = (front: boolean) => {
        const n = b.ring
        if (!n) return
        const c0 = cross(n, [0, 0, 1])
        const a1: V = len(c0) < 1e-3 ? [1, 0, 0] : norm(c0), a2 = cross(n, a1)
        for (let i = 0; i < SATURN_RINGS.length; i++) {
          const [from, to, op] = SATURN_RINGS[i]
          const rad = ((from + to) / 2) * b.r
          bx.strokeStyle = `rgba(${i % 2 ? '218,200,160' : '202,184,148'},${op})`
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
      ringHalf(false)
      const atm = ATMOSPHERE[b.kind]
      if (atm) { // a thin glow at the edge
        const ag = bx.createRadialGradient(X, Y, rpx * 0.93, X, Y, rpx * 1.1)
        ag.addColorStop(0, `rgba(${atm},0.5)`); ag.addColorStop(1, `rgba(${atm},0)`)
        bx.fillStyle = ag
        bx.beginPath(); bx.arc(X, Y, rpx * 1.1, 0, TAU); bx.fill()
      }
      bx.save()
      bx.beginPath(); bx.arc(X, Y, rpx, 0, TAU); bx.clip()
      bx.drawImage(b.sprite.cv, X - rpx, Y - rpx, rpx * 2, rpx * 2)
      // the night side: a gradient across the planet along the sun's direction; its edge moves with how the light falls on it
      const dl = Math.hypot(Lc[0], Lc[1]) || 1, dxl = Lc[0] / dl, dyl = -Lc[1] / dl
      const pt = 0.5 - 0.62 * Lc[2]
      const g0 = clamp(pt - 0.2, 0, 1), g1 = clamp(pt + 0.1, 0.001, 1)
      const sh = bx.createLinearGradient(X + dxl * rpx, Y + dyl * rpx, X - dxl * rpx, Y - dyl * rpx)
      sh.addColorStop(g0, 'rgba(0,0,4,0)'); sh.addColorStop(Math.max(g1, g0 + 0.001), 'rgba(0,0,4,0.96)')
      bx.fillStyle = sh
      bx.fillRect(X - rpx, Y - rpx, rpx * 2, rpx * 2)
      bx.restore()
      ringHalf(true)
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
    const lightOn = (id: number, S: Station | null) => (id === LIGHT_STROBE ? (t + (S ? S.id * 0.37 : 0)) % 2 < 0.22 : true)
    const lightColor = (id: number, S: Station | null): [number, number, number] => (id >= LIGHT_RING && id < LIGHT_RING + 4 ? (S && dock.st === S && dock.lights[id - LIGHT_RING] ? [70, 255, 110] : [255, 60, 50]) : LIGHT_COLORS[id])
    const glows: { x: number; y: number; r: number; c: [number, number, number] }[] = []
    // the Endurances drawn piece by piece: the two nearest that are more than a speck; the others are specks
    const depthOf = (S: Station) => dot(sub(S.p, cam.p), CF)
    const meshes = stations.filter(S => { const z = depthOf(S); return z > 1 && (ENDURANCE_RING * 1.3 * F) / z > 2.2 }).sort((a, b) => depthOf(a) - depthOf(b)).slice(0, 2)
    {
      const rg = rangerModel(), eg = enduranceModel()
      const nR = rg.length, tot = rg.length + 2 * eg.length
      const P = scratch.P(tot), dep = scratch.dep(tot), nrm = scratch.nrm(tot), cen = scratch.cen(tot)
      const vis = scratch.vis
      vis.length = 0
      const out = [0, 0, 0]

      // one object's pieces on their way to the screen: its axes in the world, its place, a turn about its own z (the Endurance's spin)
      const place = (faces: Face[], off: number, ax: V, ay: V, az: V, pos: V, spin: number, stretch: number, squeeze: number, broken?: Uint8Array) => {
        const R00 = dot(CR, ax), R01 = dot(CR, ay), R02 = dot(CR, az)
        const R10 = dot(CU, ax), R11 = dot(CU, ay), R12 = dot(CU, az)
        const R20 = dot(CF, ax), R21 = dot(CF, ay), R22 = dot(CF, az)
        const d = sub(pos, cam.p)
        const t0 = dot(d, CR), t1 = dot(d, CU), t2 = dot(d, CF)
        const cs = Math.cos(spin), sn = Math.sin(spin)
        const xf = (x0: number, y0: number, z0: number, normal: boolean) => {
          let x = x0, y = y0
          if (spin) { x = x0 * cs - y0 * sn; y = x0 * sn + y0 * cs }
          if (!normal) { x *= squeeze; y *= squeeze; z0 *= stretch }
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
      if (mode !== 'dead') place(rg, 0, ship.r, ship.u, ship.f, ship.p, 0, stretch, squeeze, gone)
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
        const isR = id < nR
        const fc = isR ? rg[id] : eg[(id - nR) % eg.length], o = id * MAXN * 2
        const owner = isR ? null : meshes[Math.floor((id - nR) / eg.length)]
        fx.globalAlpha = isR ? alphaShip : 1
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
        const dk = isR ? 1 - 0.55 * dmgR : 1 // soot
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
      if (mode !== 'dead') {
        const d = sub(ship.p, cam.p)
        const b0 = dot(d, CR), b1 = dot(d, CU), b2 = dot(d, CF)
        for (const nxm of [-2.6, 0, 2.6]) {
          const lp = add(add(mul(ship.r, nxm), mul(ship.u, 0.45)), mul(ship.f, -13.9))
          const zc = b2 + dot(lp, CF)
          if (zc < 1) continue
          const x = cx + ((b0 + dot(lp, CR)) * F) / zc, y = cy - ((b1 + dot(lp, CU)) * F) / zc
          const r = (((1.2 + 5 * ship.thr) * F) / zc) * (0.85 + 0.15 * Math.sin(t * 40 + nxm))
          const g = fx.createRadialGradient(x, y, 0, x, y, r)
          g.addColorStop(0, `rgba(190,225,255,${0.2 + 0.75 * ship.thr})`); g.addColorStop(0.4, `rgba(110,170,255,${0.1 + 0.4 * ship.thr})`); g.addColorStop(1, 'rgba(80,130,255,0)')
          fx.globalCompositeOperation = 'lighter'
          fx.fillStyle = g
          fx.beginPath(); fx.arc(x, y, r, 0, TAU); fx.fill()
          if (ship.thr > 0.05) {
            const tl = add(lp, mul(ship.f, -(5 + 34 * ship.thr) * (0.9 + 0.1 * Math.sin(t * 55 + nxm))))
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
          const w = add(add(add(ship.p, mul(ship.r, fc.p[0])), mul(ship.u, fc.p[1])), mul(ship.f, fc.p[2]))
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
          fx.fillStyle = 'rgba(225,232,255,0.9)'
          fx.beginPath(); fx.arc(sp[0], sp[1], 1.5, 0, TAU); fx.fill()
          if ((t + S.id * 0.37) % 2 < 0.22) {
            const g = fx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], 9)
            g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)')
            fx.fillStyle = g
            fx.beginPath(); fx.arc(sp[0], sp[1], 9, 0, TAU); fx.fill()
          }
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
      cb.hud({ speed: dock.on ? 0 : len(ship.v), planet, hull })
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
    debug: () => { const S = dock.st ?? nearStation()?.S ?? stations[0]; return { hull, hurt: (a: number) => hurt(a, null), ship, E: { pos: S.p, x: S.x, y: S.y, z: S.z, spin: S.spin }, stations: stations.map(x => ({ id: x.id, p: x.p })), dock, metrics: dockMetrics({ ship: ship.p, f: ship.f, u: ship.u, vel: ship.v, e: S.p, ex: S.x, ey: S.y, ez: S.z, spin: S.spin }), mode, bodies: list.map(b => ({ id: b.id, kind: b.kind, x: b.x, y: b.y, z: b.z, r: b.r, ring: b.ring })) } },
  }
}
