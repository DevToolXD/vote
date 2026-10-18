// Docking with the Endurance, by the numbers. The Endurance spins about its long axis (+ez is the way its docking port faces);
// the Ranger's nose carries the other half of the port, so it has to come in along that axis, nose first. The port has a key
// (an orange bar at the Endurance's +y, turning with it) and the Ranger has its own, on its top: they have to be lined up AND
// turn together, or the two will not lock. Metres, seconds, radians.

export type V = [number, number, number]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
const len = (a: V) => Math.hypot(a[0], a[1], a[2])
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

export const RS = 1.5 // how much bigger the Ranger is drawn and flown than its model
export const NOSE = 14.2 * RS // from the Ranger's centre to the tip of its docking collar
export const ES = 2.3 // how much bigger the Endurance is drawn and flown than its model
export const PORT_Z = 42 * ES // the Endurance's port face, along its axis from its centre
export const LIMITS = { axisDeg: 10.5, offset: 2.7, closing: 1.5, side: 0.75, rollDeg: 15, rollRate: 0.15 } // one and a half times as forgiving as it was

export type DockIn = {
  ship: V; f: V; u: V; vel: V // the Ranger's centre, nose direction, up and velocity
  e: V; ex: V; ey: V; ez: V; spin: number // the Endurance's centre and axes (ez: out of its port) and how far it has turned
}
export type DockMetrics = {
  /** How far the nose tip is outside the port face (negative: touching or past it). */
  h: number
  /** Distance from the axis at the nose tip. */
  offset: number
  /** The Ranger's nose against "straight into the port", degrees. */
  axisDeg: number
  /** Speed toward the port, and sideways to it. */
  closing: number
  side: number
  /** The Ranger's key against the port's key, round the nose axis, radians (-π..π). */
  roll: number
  /** The distance from the Endurance's centre (for knowing when to look). */
  dist: number
}

/** The port's key as a direction in the world: the Endurance's +y turned by `spin` about its axis. */
export function keyDir(ex: V, ey: V, spin: number): V {
  return [-Math.sin(spin) * ex[0] + Math.cos(spin) * ey[0], -Math.sin(spin) * ex[1] + Math.cos(spin) * ey[1], -Math.sin(spin) * ex[2] + Math.cos(spin) * ey[2]]
}

export function dockMetrics(i: DockIn): DockMetrics {
  const d = sub(i.ship, i.e)
  const tip: V = [d[0] + i.f[0] * NOSE, d[1] + i.f[1] * NOSE, d[2] + i.f[2] * NOSE]
  const tz = dot(tip, i.ez), tx = dot(tip, i.ex), ty = dot(tip, i.ey)
  const toward = scale(i.ez, -1)
  const axisDeg = (Math.acos(Math.max(-1, Math.min(1, dot(i.f, toward)))) * 180) / Math.PI
  const vAxis = dot(i.vel, i.ez)
  const side = len(sub(i.vel, scale(i.ez, vAxis)))
  // the two keys, seen along the nose
  const key = keyDir(i.ex, i.ey, i.spin)
  const kp = sub(key, scale(i.f, dot(key, i.f))), up = sub(i.u, scale(i.f, dot(i.u, i.f)))
  const roll = Math.atan2(dot(i.f, cross(up, kp)), dot(up, kp))
  return { h: tz - PORT_Z, offset: Math.hypot(tx, ty), axisDeg, closing: -vAxis, side, roll, dist: len(d) }
}

export type Verdict = { axis: boolean; offset: boolean; roll: boolean; speed: boolean; all: boolean }
/** Which of the four are right; `rollRate` is how fast the keys' angle is changing (rad/s). */
export function dockVerdict(m: DockMetrics, rollRate: number): Verdict {
  const axis = m.axisDeg < LIMITS.axisDeg
  const offset = m.offset < LIMITS.offset
  const roll = Math.abs(m.roll) < (LIMITS.rollDeg * Math.PI) / 180 && Math.abs(rollRate) < LIMITS.rollRate
  const speed = m.closing > -0.05 && m.closing < LIMITS.closing && m.side < LIMITS.side
  return { axis, offset, roll, speed, all: axis && offset && roll && speed }
}

/** The angle of a to b, wrapped to -π..π. */
export const wrapPi = (a: number) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
