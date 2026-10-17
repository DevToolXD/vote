import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushOf, rollAndNod, upOnScreen } from '../src/components/spaceTilt'

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`)
const poseOf = (beta: number, gamma: number, angle: number) => rollAndNod(upOnScreen(beta, gamma, angle))

// Held upright, screen vertical, in each of the four ways the screen can be turned: "up" is the screen's up whatever the angles.
test('upright is upright in every orientation', () => {
  for (const [beta, gamma, angle] of [[90, 0, 0], [0, -90, 90], [0, 90, 270], [-90, 0, 180]] as const) {
    const u = upOnScreen(beta, gamma, angle)
    near(u.x, 0); near(u.y, 1); near(u.z, 0)
  }
})

// The top edge away from the person (the phone nodding down) is the same + nod in every orientation, and nothing else changes.
test('nod: the top edge away is positive in every orientation', () => {
  for (const [beta, gamma, angle] of [[70, 0, 0], [0, -70, 90], [0, 70, 270], [-70, 0, 180]] as const) {
    const p = poseOf(beta, gamma, angle)
    near(p.nod, 20, 0.05); near(p.roll, 0, 0.05)
  }
})

// Turned like a wheel, the right edge down is a positive roll in landscape (the sensor angles at gamma = ±90 stay well-behaved).
test('roll: the right edge down is positive', () => {
  near(poseOf(10, -90, 90).roll, 10, 0.05); near(poseOf(10, -90, 90).nod, 0, 0.05)
  near(poseOf(-10, 90, 270).roll, 10, 0.05)
})

// Past the gimbal point of the angles (beta over 90) the phone is tilted back toward you: the nod goes negative, continuously.
test('nod is continuous through upright', () => {
  const a = poseOf(95, 0, 0).nod, b = poseOf(85, 0, 0).nod
  near(a, -5, 0.05); near(b, 5, 0.05)
})

test('push: a dead zone, a full push at the range, signs kept', () => {
  assert.deepEqual(pushOf(1, 1, 0, 0), { x: 0, y: 0 })
  near(pushOf(22, 0, 0, 0).x, 1); near(pushOf(-40, 0, 0, 0).x, -1)
  near(pushOf(0, 18, 0, 0).y, 1); near(pushOf(0, -18, 0, 0).y, -1)
  near(pushOf(0, 0, 0, 0).y, 0)
  // measured from the way the phone was held: no push there, a push away from it
  near(pushOf(30, 50, 30, 50).x, 0); near(pushOf(30, 50, 30, 50).y, 0)
  near(pushOf(30, 80, 30, 50).y, 1)
  // across the +-180 seam of the nod
  near(pushOf(0, -175, 0, 175).y, pushOf(0, 185, 0, 175).y)
})
