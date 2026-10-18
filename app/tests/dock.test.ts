import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NOSE, PORT_Z, dockMetrics, dockVerdict, keyDir, type DockIn, type V } from '../src/components/spaceDock'

const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`)

// The Endurance at the origin, axes the world's, spinning 0.4 rad in; its port faces +z. The Ranger comes in from +z, nose toward -z.
const base = (over: Partial<DockIn> = {}): DockIn => ({
  ship: [0, 0, PORT_Z + NOSE + 3], f: [0, 0, -1], u: [Math.sin(-0.4), Math.cos(-0.4), 0] as V, vel: [0, 0, -0.5],
  e: [0, 0, 0], ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1], spin: 0.4, ...over,
})

test('the key is the +y turned by the spin', () => {
  const k = keyDir([1, 0, 0], [0, 1, 0], Math.PI / 2)
  near(k[0], -1); near(k[1], 0, 1e-9)
})

test('a good approach reads right everywhere', () => {
  const m = dockMetrics(base())
  near(m.h, 3); near(m.offset, 0); near(m.axisDeg, 0, 1e-6); near(m.closing, 0.5); near(m.side, 0)
  // the Ranger's up is the key's direction here: nothing to turn
  const u: V = keyDir([1, 0, 0], [0, 1, 0], 0.4)
  const m2 = dockMetrics(base({ u }))
  near(m2.roll, 0, 1e-9)
  assert.equal(dockVerdict(m2, 0).all, true)
})

test('each fault is found by its own light', () => {
  const u: V = keyDir([1, 0, 0], [0, 1, 0], 0.4)
  const good = base({ u })
  // off the axis by 5 m at the tip
  assert.equal(dockVerdict(dockMetrics({ ...good, ship: [5, 0, PORT_Z + NOSE + 3] }), 0).offset, false)
  // the nose turned 20 degrees
  const a = (20 * Math.PI) / 180
  assert.equal(dockVerdict(dockMetrics({ ...good, f: [Math.sin(a), 0, -Math.cos(a)] }), 0).axis, false)
  // the keys a quarter turn apart, and turning against each other
  assert.equal(dockVerdict(dockMetrics(base({ u: [1, 0, 0] })), 0).roll, false)
  assert.equal(dockVerdict(dockMetrics(good), 0.3).roll, false)
  // too fast, or drifting sideways
  assert.equal(dockVerdict(dockMetrics({ ...good, vel: [0, 0, -2.5] }), 0).speed, false)
  assert.equal(dockVerdict(dockMetrics({ ...good, vel: [1.5, 0, -0.4] }), 0).speed, false)
  // backing away is not "closing"
  assert.equal(dockVerdict(dockMetrics({ ...good, vel: [0, 0, 0.5] }), 0).speed, false)
})

import { affine, enduranceModel, rangerModel } from '../src/components/spaceModels'

test('the picture map takes the picture corners to the screen corners', () => {
  // a made-up map: x = 3u + 2v + 5, y = -u + 4v + 7
  const f = (u: number, v: number): [number, number] => [3 * u + 2 * v + 5, -u + 4 * v + 7]
  const [x0, y0] = f(0.1, 0.2), [x1, y1] = f(0.9, 0.3), [x2, y2] = f(0.4, 0.8)
  const m = affine(0.1, 0.2, 0.9, 0.3, 0.4, 0.8, x0, y0, x1, y1, x2, y2)
  assert.ok(m)
  const [a, b, c, d, e, g] = m!
  // a point not among the three goes where the made-up map says
  const [u, v] = [0.6, 0.5], [ex, ey] = f(u, v)
  near(a * u + c * v + e, ex, 1e-9); near(b * u + d * v + g, ey, 1e-9)
})

test('the models are made of flat pieces with sound normals', () => {
  for (const faces of [rangerModel(), enduranceModel()]) {
    assert.ok(faces.length > 50)
    for (const f of faces) {
      assert.ok(f.k >= 3 && f.k <= 8)
      assert.ok(Math.abs(Math.hypot(f.n[0], f.n[1], f.n[2]) - 1) < 1e-4)
      for (let i = 0; i < f.k * 3; i++) assert.ok(Number.isFinite(f.p[i]))
    }
  }
  // the Ranger's top carries the picture, and every corner of it has its place in it
  const topFace = rangerModel().find(f => f.uv)
  assert.ok(topFace && topFace.uv!.length === topFace.k * 2)
})

import { LANDABLE, surfaceTinted, worldOf } from '../src/components/spacePlanets'

test('worlds made from a seed: the same seed the same world, other seeds other worlds', () => {
  const pts: [number, number, number][] = [[0, 0, 1], [0.6, 0.3, 0.74], [-0.5, -0.5, 0.7]]
  const col = (kind: 'rock' | 'gas', seed: number) => pts.map(([x, y, z]) => { const l = Math.hypot(x, y, z); return surfaceTinted(kind, seed)(x / l, y / l, z / l).map(Math.round).join(',') }).join('|')
  assert.equal(col('rock', 7), col('rock', 7))
  const seen = new Set<string>()
  for (let s = 1; s <= 40; s++) seen.add(col('rock', s * 7919))
  assert.ok(seen.size >= 38, `only ${seen.size} different rock worlds in 40`)
  const gas = new Set<string>()
  for (let s = 1; s <= 40; s++) gas.add(col('gas', s * 104729))
  assert.ok(gas.size >= 38)
  // some gas giants have rings, with bands inside the allowed span; the rock worlds can be landed on, the gas ones cannot
  let rings = 0
  for (let s = 1; s <= 60; s++) { const w = worldOf('gas', s * 31); if (w.bands) { rings++; assert.ok(w.bands.every(([a, b]) => a >= 1.2 && b > a && b <= 3.2)) } }
  assert.ok(rings > 5 && rings < 40, `${rings} of 60 with rings`)
  assert.ok(LANDABLE.rock && !('gas' in LANDABLE))
})
