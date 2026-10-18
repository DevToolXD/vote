// The two ships of 인터스텔라, as flat pieces in metres: the Ranger 1 the player flies (a long flat wedge, a white top with black
// glazing set in black armour) and the Endurance (twelve white modules with black bands round a spine, a docking port at the
// front with four rings of lights). x right, y up, z forward (the Ranger's nose; the Endurance's port).

import { ES, PORT_Z as PORT_Z_BIG } from './spaceDock'
const PORT_Z = PORT_Z_BIG / ES // (the model is made at its own size; enduranceModel() scales it up at the end)

export type Face = {
  p: Float32Array // corners, x y z each
  n: Float32Array // the way it faces
  k: number // how many corners
  mat: number // index into MATS
  light: number // >= 0: it glows (see LIGHT_*), and ignores the sun
  uv: Float32Array | null // corners in the picture (0..1), when it carries a picture (the Ranger's top)
  win: boolean // a row of lit windows on it
}
export type Mat = { c: [number, number, number]; spec: number; shin: number }
export const MATS: Mat[] = [
  { c: [238, 238, 241], spec: 0.55, shin: 36 }, // 0 white paint
  { c: [26, 28, 32], spec: 0.4, shin: 20 }, // 1 black armour
  { c: [104, 108, 116], spec: 0.5, shin: 28 }, // 2 grey metal
  { c: [182, 184, 190], spec: 0.5, shin: 32 }, // 3 light metal
  { c: [10, 12, 18], spec: 1.0, shin: 70 }, // 4 glass
]
export const WHITE = 0, BLACK = 1, GRAY = 2, LIGHTM = 3, GLASS = 4

// what glows, and in what colour (the four docking rings are set each frame from how the approach is going)
export const LIGHT_KEY = 0, LIGHT_STROBE = 1, LIGHT_RING = 2 /* 2..5 */, LIGHT_WINDOW = 6, LIGHT_RED = 7, LIGHT_GREEN = 8
export const LIGHT_COLORS: [number, number, number][] = [
  [255, 150, 40], [255, 255, 255], [255, 60, 50], [255, 60, 50], [255, 60, 50], [255, 60, 50], [255, 214, 150], [255, 40, 40], [60, 255, 90],
]

type P3 = [number, number, number]
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm = (a: P3): P3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const add3 = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul3 = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k]

class Builder {
  faces: Face[] = []
  /** A flat piece; its normal is worked out and turned to face away from `inside`, unless given. */
  poly(pts: P3[], mat: number, opts: { n?: P3; inside?: P3; light?: number; uv?: [number, number][]; win?: boolean } = {}) {
    let n = opts.n
    if (!n) {
      // the normal from the corners (Newell's method), turned away from the inside
      let x = 0, y = 0, z = 0
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length]
        x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1])
      }
      n = norm([x, y, z])
      if (opts.inside) {
        const c: P3 = [0, 0, 0]
        pts.forEach(q => { c[0] += q[0] / pts.length; c[1] += q[1] / pts.length; c[2] += q[2] / pts.length })
        const o = sub(c, opts.inside)
        if (n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0) n = mul3(n, -1)
      }
    }
    const p = new Float32Array(pts.length * 3)
    pts.forEach((q, i) => { p[i * 3] = q[0]; p[i * 3 + 1] = q[1]; p[i * 3 + 2] = q[2] })
    this.faces.push({ p, n: Float32Array.of(n[0], n[1], n[2]), k: pts.length, mat, light: opts.light ?? -1, uv: opts.uv ? Float32Array.from(opts.uv.flat()) : null, win: !!opts.win })
  }
  /** A box from its centre, axes and half sizes. `winAxis`: the axis whose two faces carry windows; `light`: those faces glow. */
  box(c: P3, axes: [P3, P3, P3], half: [number, number, number], mat: number, winAxis = -1) {
    for (let k = 0; k < 3; k++) {
      const o1 = (k + 1) % 3, o2 = (k + 2) % 3
      for (const s of [-1, 1]) {
        const mid = add3(c, mul3(axes[k], s * half[k]))
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => add3(mid, add3(mul3(axes[o1], p * half[o1]), mul3(axes[o2], q * half[o2]))))
        this.poly(pts, mat, { n: mul3(axes[k], s), win: k === winAxis })
      }
    }
  }
  /** A prism along z, `sides` sided, closed at both ends. */
  prism(cx: number, cy: number, rad: number, z0: number, z1: number, mat: number, sides = 8, capMat = mat) {
    const ang = (i: number) => (i / sides) * Math.PI * 2
    for (let i = 0; i < sides; i++) {
      const a0 = ang(i), a1 = ang(i + 1), am = (a0 + a1) / 2
      this.poly([[cx + rad * Math.cos(a0), cy + rad * Math.sin(a0), z0], [cx + rad * Math.cos(a1), cy + rad * Math.sin(a1), z0], [cx + rad * Math.cos(a1), cy + rad * Math.sin(a1), z1], [cx + rad * Math.cos(a0), cy + rad * Math.sin(a0), z1]], mat, { n: [Math.cos(am), Math.sin(am), 0] })
    }
    const cap = (z: number) => Array.from({ length: sides }, (_, i) => [cx + rad * Math.cos(ang(i)), cy + rad * Math.sin(ang(i)), z] as P3)
    this.poly(cap(z0), capMat, { n: [0, 0, -1] })
    this.poly(cap(z1).reverse(), capMat, { n: [0, 0, 1] })
  }
}

// ---------------- the Ranger 1 ----------------

/** The outline of the Ranger's top (x, z): narrow at the nose, widest a little ahead of the middle, a flat tail. */
export const RANGER_TOP: [number, number][] = [[-2.6, 12], [2.6, 12], [5.8, 3.5], [5.4, -12], [-5.4, -12], [-5.8, 3.5]]
const RANGER_BOT: [number, number][] = [[-2.0, 11.2], [2.0, 11.2], [4.7, 3.5], [4.4, -11.5], [-4.4, -11.5], [-4.7, 3.5]]
const yTop = (z: number) => 1.45 - 0.035 * z
const Y_BOT = -0.9

let RANGER: Face[] | null = null
export function rangerModel(): Face[] {
  if (RANGER) return RANGER
  const b = new Builder()
  const top = RANGER_TOP.map(([x, z]) => [x, yTop(z), z] as P3), bot = RANGER_BOT.map(([x, z]) => [x, Y_BOT, z] as P3)
  b.poly(top, WHITE, { n: norm([0, 1, 0.035]), uv: RANGER_TOP.map(([x, z]) => [(x + 6) / 12, (12 - z) / 24]) })
  b.poly(bot, GRAY, { n: [0, -1, 0] })
  for (let i = 0; i < 6; i++) { // the armoured sides, sloping in
    const j = (i + 1) % 6
    b.poly([top[i], top[j], bot[j], bot[i]], BLACK, { inside: [0, 0, 0] })
  }
  // three engine nozzles at the tail, two black flaps at its corners, a block of thrusters on each side
  for (const x of [-2.6, 0, 2.6]) b.prism(x, 0.45, 1.05, -13.8, -11.8, GRAY, 8, BLACK)
  for (const s of [-1, 1]) {
    b.box([s * 4.3, 1.55, -12.8], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [1.8, 0.3, 1.1], BLACK)
    b.box([s * 5.95, 0.95, 3.5], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.28, 0.32, 0.8], GRAY)
    b.box([s * 5.3, 0.95, -8], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.28, 0.32, 0.6], GRAY)
  }
  // the docking collar on the nose, and its key on the top
  b.prism(0, 0.1, 1.35, 12, NOSE_TIP, LIGHTM, 8, GRAY)
  b.box([0, 1.58, 13.1], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.11, 0.07, 0.95], BLACK)
  b.poly([[-0.09, 1.66, 12.2], [0.09, 1.66, 12.2], [0.09, 1.66, 14.0], [-0.09, 1.66, 14.0]], WHITE, { n: [0, 1, 0], light: LIGHT_KEY })
  RANGER = b.faces
  return RANGER
}
const NOSE_TIP = 14.2

/** The Ranger's landing gear, drawn at full length with the hull's underside at y = 0 and the feet at y = -1: the game stretches it as it comes down. */
let GEAR: Face[] | null = null
export function gearModel(): Face[] {
  if (GEAR) return GEAR
  const b = new Builder(), ax: [P3, P3, P3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  for (const [x, z] of [[-3.2, 6], [3.2, 6], [-3.7, -8], [3.7, -8]] as [number, number][]) {
    b.box([x, -0.5, z], ax, [0.2, 0.5, 0.2], GRAY)
    b.box([x, -0.97, z], ax, [0.8, 0.03, 1.0], BLACK)
  }
  GEAR = b.faces
  return GEAR
}

/** The picture of the Ranger's top: a white plate in a black frame, black glazing set in it, a hatch behind, seams and grime. */
export function rangerTexture(): HTMLCanvasElement {
  const W = 384, H = 768, S = 32 // 32 pixels to the metre
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  if (!g) return cv
  const at = (x: number, z: number): [number, number] => [(x + 6) * S, (12 - z) * S]
  const path = (pts: [number, number][]) => { g.beginPath(); pts.forEach(([x, z], i) => { const [u, v] = at(x, z); if (i) g.lineTo(u, v); else g.moveTo(u, v) }); g.closePath() }
  let seed = 7
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  g.fillStyle = '#14161a'; g.fillRect(0, 0, W, H)
  // the plate, inside a black frame about half a metre wide
  const plate = RANGER_TOP.map(([x, z]) => [x * 0.9, z * 0.955] as [number, number])
  path(plate)
  const base = g.createLinearGradient(0, 0, 0, H)
  base.addColorStop(0, '#f4f5f7'); base.addColorStop(0.5, '#ebecee'); base.addColorStop(1, '#dcdde1')
  g.fillStyle = base; g.fill()
  g.save(); path(plate); g.clip()
  // seams: a grid of panels, the bigger hatch behind
  g.strokeStyle = 'rgba(120,124,132,0.45)'; g.lineWidth = 1
  for (let z = 11; z > -12; z -= 2.2) { const [, v] = at(0, z); g.beginPath(); g.moveTo(0, v); g.lineTo(W, v); g.stroke() }
  for (let x = -5.5; x < 6; x += 2.75) { const [u] = at(x, 0); g.beginPath(); g.moveTo(u, 0); g.lineTo(u, H); g.stroke() }
  const [hx0, hz0] = at(-3.3, -0.4), [hx1, hz1] = at(3.4, -10.6)
  g.fillStyle = 'rgba(205,207,212,0.9)'; g.fillRect(hx0, hz0, hx1 - hx0, hz1 - hz0)
  g.strokeStyle = 'rgba(70,74,82,0.85)'; g.lineWidth = 2.2; g.strokeRect(hx0, hz0, hx1 - hx0, hz1 - hz0)
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(90,94,102,0.7)'
  g.beginPath(); g.moveTo(hx0, hz0); g.lineTo(hx1, hz1); g.moveTo(hx1, hz0); g.lineTo(hx0, hz1); g.moveTo((hx0 + hx1) / 2, hz0); g.lineTo((hx0 + hx1) / 2, hz1); g.stroke()
  // the glazing: a cluster of irregular black panes in the front part, a little to the left
  const inPlate = (x: number, z: number) => Math.abs(x) < 3.6 + (11 - z) * 0.0 && z > 2.2 && z < 11.2
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    if (r() < 0.22) continue
    const cx = -3.3 + col * 1.5 + (r() - 0.5) * 0.5, cz = 10.4 - row * 1.75 + (r() - 0.5) * 0.5
    if (!inPlate(cx, cz) || (cz > 8 && cx > 1.8)) continue
    const n = 5 + Math.floor(r() * 2), pts: [number, number][] = []
    const rad = 0.5 + r() * 0.35
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5; const rr = rad * (0.75 + r() * 0.4); pts.push([cx + Math.cos(a) * rr * 1.25, cz + Math.sin(a) * rr * 0.9]) }
    path(pts)
    const [u0, v0] = at(cx - 0.7, cz + 0.6), [u1, v1] = at(cx + 0.7, cz - 0.6)
    const gl = g.createLinearGradient(u0, v0, u1, v1)
    gl.addColorStop(0, '#323845'); gl.addColorStop(0.35, '#0a0c11'); gl.addColorStop(1, '#030407')
    g.fillStyle = gl; g.fill()
    g.strokeStyle = 'rgba(160,168,184,0.55)'; g.lineWidth = 1.4; g.stroke()
  }
  // grime: streaks along the flight, speckle, a darker run at the seams
  for (let i = 0; i < 60; i++) {
    const x = (r() * 12 - 6), z0 = r() * 24 - 12, [u, v] = at(x, z0)
    g.strokeStyle = `rgba(60,64,72,${0.04 + r() * 0.06})`; g.lineWidth = 0.6 + r() * 1.6
    g.beginPath(); g.moveTo(u, v); g.lineTo(u + (r() - 0.5) * 6, v + 20 + r() * 90); g.stroke()
  }
  for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,44,52' : '255,255,255'},${0.03 + r() * 0.08})`; g.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5) }
  g.restore()
  return cv
}

// ---------------- the Endurance ----------------

const RING_BASE = 62
export const ENDURANCE_RING = RING_BASE * ES // the ring's radius
const MODULES = 12

let ENDURANCE: Face[] | null = null
export function enduranceModel(): Face[] {
  if (ENDURANCE) return ENDURANCE
  const b = new Builder(), Z: P3 = [0, 0, 1]
  const AX: [P3, P3, P3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  // the spine: segments of white with grey joints, a black rear, the radiator vanes
  for (let z = -30; z < 34; z += 8) b.prism(0, 0, 5, z, z + 8, WHITE, 8, GRAY)
  for (let z = -22; z < 34; z += 16) b.prism(0, 0, 5.6, z - 0.6, z + 0.6, GRAY, 8)
  b.prism(0, 0, 4.2, 34, 40, LIGHTM, 8)
  b.prism(0, 0, 5.0, 40, PORT_Z, GRAY, 8, BLACK)
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, r: P3 = [Math.cos(a), Math.sin(a), 0], t: P3 = [-Math.sin(a), Math.cos(a), 0]
    b.box([r[0] * 11, r[1] * 11, -26], [t, r, Z], [0.15, 6, 6], GRAY)
  }
  // the docking face: the port in black, the drogue in its middle, the key, and four rings of eight lights
  const oct = (rad: number, z: number) => Array.from({ length: 8 }, (_, i) => [rad * Math.cos((i / 8) * Math.PI * 2 + Math.PI / 8), rad * Math.sin((i / 8) * Math.PI * 2 + Math.PI / 8), z] as P3)
  b.poly(oct(1.7, PORT_Z + 0.05), LIGHTM, { n: Z })
  b.poly([[-0.24, 1.8, PORT_Z + 0.09], [0.24, 1.8, PORT_Z + 0.09], [0.24, 4.9, PORT_Z + 0.09], [-0.24, 4.9, PORT_Z + 0.09]], WHITE, { n: Z, light: LIGHT_KEY })
  for (let ring = 0; ring < 4; ring++) {
    const rad = 4.55 - ring * 0.75
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 16, a0 = a - 0.2, a1 = a + 0.2
      b.poly([[Math.cos(a0) * (rad - 0.17), Math.sin(a0) * (rad - 0.17), PORT_Z + 0.07], [Math.cos(a1) * (rad - 0.17), Math.sin(a1) * (rad - 0.17), PORT_Z + 0.07], [Math.cos(a1) * (rad + 0.17), Math.sin(a1) * (rad + 0.17), PORT_Z + 0.07], [Math.cos(a0) * (rad + 0.17), Math.sin(a0) * (rad + 0.17), PORT_Z + 0.07]], WHITE, { n: Z, light: LIGHT_RING + ring })
    }
  }
  // the strobe, on the spine's rear
  b.box([0, 5.4, -28], AX, [0.35, 0.35, 0.35], WHITE)
  b.poly([[-0.3, 5.76, -28.3], [0.3, 5.76, -28.3], [0.3, 5.76, -27.7], [-0.3, 5.76, -27.7]], WHITE, { n: [0, 1, 0], light: LIGHT_STROBE })

  // the ring: twelve modules, black bands, docking hatches outward, a truss on two rails between them, six spokes
  for (let i = 0; i < MODULES; i++) {
    const a = (i / MODULES) * Math.PI * 2
    const r: P3 = [Math.cos(a), Math.sin(a), 0], t: P3 = [-Math.sin(a), Math.cos(a), 0]
    const axes: [P3, P3, P3] = [t, r, Z]
    const R = RING_BASE
    b.box(mul3(r, R), axes, [12, 6.5, 6], WHITE, 2)
    for (const z of [-3.2, 3.2]) b.box([r[0] * R, r[1] * R, z], axes, [12.06, 6.56, 0.38], BLACK)
    b.box(mul3(r, R - 6.5 - 1.1), axes, [5, 1.1, 3.4], GRAY)
    // the hatch on the outside
    const hc = mul3(r, R + 6.5)
    for (const f of hatch(hc, r, t)) b.faces.push(f)
    // the truss to the next module
    const am = a + Math.PI / MODULES, rm: P3 = [Math.cos(am), Math.sin(am), 0], tm: P3 = [-Math.sin(am), Math.cos(am), 0]
    for (const z of [-4.6, 4.6]) b.box([rm[0] * R * Math.cos(Math.PI / MODULES), rm[1] * R * Math.cos(Math.PI / MODULES), z], [tm, rm, Z], [5.8, 0.8, 0.8], GRAY)
    if (i % 2 === 0) b.box(mul3(r, 28), [t, r, Z], [0.9, 24, 0.9], LIGHTM) // a spoke to every second module
    // the lit ports at the ends of two modules, as navigation lights
    if (i === 0) b.poly([[R + 0.4, -0.5, 6.05], [R + 0.4, 0.5, 6.05], [R - 0.4, 0.5, 6.05], [R - 0.4, -0.5, 6.05]], WHITE, { n: Z, light: LIGHT_RED })
    if (i === 6) b.poly([[-R + 0.4, -0.5, 6.05], [-R + 0.4, 0.5, 6.05], [-R - 0.4, 0.5, 6.05], [-R - 0.4, -0.5, 6.05]], WHITE, { n: Z, light: LIGHT_GREEN })
  }
  for (const fc of b.faces) for (let i = 0; i < fc.p.length; i++) fc.p[i] *= ES
  ENDURANCE = b.faces
  return ENDURANCE
}

/** A round docking hatch on a module's outer face: a hexagonal ring and a dark centre (faces pointing along `r`). */
function hatch(c: P3, r: P3, t: P3): Face[] {
  const b = new Builder(), Z: P3 = [0, 0, 1]
  const ring = (rad: number, h: number, mat: number) => {
    const pts = (hh: number) => Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return add3(add3(c, mul3(r, hh)), add3(mul3(t, Math.cos(a) * rad), mul3(Z, Math.sin(a) * rad))) })
    b.poly(pts(h), mat, { n: r })
  }
  ring(2.6, 0.5, GRAY)
  ring(1.6, 0.6, BLACK)
  return b.faces
}

// ---------------- drawing a picture on a flat piece ----------------

/** The affine map that takes the picture's corners (u, v) to the screen's (x, y): [a, b, c, d, e, f] for ctx.transform, or null. */
export function affine(u0: number, v0: number, u1: number, v1: number, u2: number, v2: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): [number, number, number, number, number, number] | null {
  const det = u0 * (v1 - v2) + v0 * (u2 - u1) + (u1 * v2 - u2 * v1)
  if (Math.abs(det) < 1e-12) return null
  const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / det
  const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / det
  const e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / det
  const b2 = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / det
  const d = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / det
  const f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / det
  return [a, b2, c, d, e, f]
}

/** Draws a picture on a convex flat piece from its corners on the screen (`sp`, x y each) and in the picture (`uv`, 0..1). */
export function drawPicture(g: CanvasRenderingContext2D, img: HTMLCanvasElement, sp: ArrayLike<number>, o: number, uv: Float32Array, k: number) {
  let cx = 0, cy = 0, cu = 0, cv = 0
  for (let i = 0; i < k; i++) { cx += sp[o + i * 2] / k; cy += sp[o + i * 2 + 1] / k; cu += uv[i * 2] / k; cv += uv[i * 2 + 1] / k }
  const W = img.width, H = img.height
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k
    // the triangle (centre, i, j), grown a hair so the seams between the triangles do not show
    const grow = (x: number, y: number): [number, number] => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + (dx / l) * 0.7, y + (dy / l) * 0.7] }
    const [ax, ay] = grow(sp[o + i * 2], sp[o + i * 2 + 1]), [bx, by] = grow(sp[o + j * 2], sp[o + j * 2 + 1])
    const m = affine(cu * W, cv * H, uv[i * 2] * W, uv[i * 2 + 1] * H, uv[j * 2] * W, uv[j * 2 + 1] * H, cx, cy, ax, ay, bx, by)
    if (!m) continue
    g.save()
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(ax, ay); g.lineTo(bx, by); g.closePath(); g.clip()
    g.transform(m[0], m[1], m[2], m[3], m[4], m[5])
    g.drawImage(img, 0, 0)
    g.restore()
  }
}
