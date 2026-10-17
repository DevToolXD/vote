// The phone as a controller for 인터스텔라. Two motions steer: turning the phone like a steering wheel (about the screen's
// own normal: the right edge goes down = right) and nodding it (top edge away = down, toward you = up).
//
// beta / gamma are Euler angles in the phone's own frame: held upright in landscape they sit at gamma = ±90, where they are
// ill-conditioned (small tilts swing beta wildly), and which of them is "sideways" depends on how the screen is turned. So they
// are not used as they come. They are turned into the direction of gravity ("up") in the phone's frame, which is smooth for every
// way of holding the phone, and that is put in the screen's own axes (right, up, out of the screen) for the screen's turn. Roll
// and nod are read from it as angles, and measured from the way the phone was held when the game began (or when 가운데로 was
// pressed, or when the screen was turned to another side).

export type Tilt = { x: number; y: number }
type Up = { x: number; y: number; z: number }

const ROLL_FULL = 22 // degrees of wheel-turn that are a full push right or left
const NOD_FULL = 18 // degrees of nod that are a full push up or down
const DEAD = 2 // degrees that count as holding still (a steady hand)
const FRESH_MS = 800 // a reading older than this is no reading (the sensor stopped)
const deg = (r: number) => (r * 180) / Math.PI
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * World "up" in the screen's axes (x right, y up, z out of the screen), from the phone's beta / gamma (degrees) and how the
 * screen is turned (0, 90, 180, 270 / -90: the angle `screen.orientation.angle` reports).
 */
export function upOnScreen(beta: number, gamma: number, angle: number): Up {
  const b = (beta * Math.PI) / 180, g = (gamma * Math.PI) / 180
  // up in the phone's frame (x: its right edge, y: its top edge, z: out of its screen), the same for every way of holding it
  const dx = -Math.sin(g) * Math.cos(b), dy = Math.sin(b), dz = Math.cos(g) * Math.cos(b)
  const a = ((Math.round(angle / 90) * 90) % 360 + 360) % 360
  // the screen's right and up in the phone's frame: turned a quarter, its right is the phone's -y (top to the left) and so on
  if (a === 90) return { x: -dy, y: dx, z: dz }
  if (a === 270) return { x: dy, y: -dx, z: dz }
  if (a === 180) return { x: -dx, y: -dy, z: dz }
  return { x: dx, y: dy, z: dz }
}

/** Roll (right edge down = +) and nod (top edge away = +) of the phone, in degrees, from "up" on the screen. */
export function rollAndNod(u: Up) {
  return { roll: deg(Math.asin(clamp(-u.x, -1, 1))), nod: deg(Math.atan2(u.z, u.y)) }
}

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180
const push = (d: number, full: number) => Math.sign(d) * clamp((Math.abs(d) - DEAD) / (full - DEAD), 0, 1)

/** A push in -1..1 for each way, from the angles and the angles of the neutral way of holding the phone. */
export function pushOf(roll: number, nod: number, roll0: number, nod0: number): Tilt {
  return { x: push(roll - roll0, ROLL_FULL), y: push(wrap180(nod - nod0), NOD_FULL) }
}

type OrientationApi = { requestPermission?: () => Promise<string> }
const api = () => (window as unknown as { DeviceOrientationEvent?: OrientationApi }).DeviceOrientationEvent
const screenAngle = (): number => (screen.orientation as { angle?: number } | undefined)?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0

export type TiltSensor = {
  /** Whether this device can give a tilt at all (a touch screen with the sensor API). */
  available(): boolean
  /** Whether the person has to allow it with a tap first (iPhone). */
  needsPermission(): boolean
  /** Starts listening; ask permission here when needed (call it from a tap). False if it was refused. */
  start(): Promise<boolean>
  stop(): void
  /** The phone's way of being held now becomes the middle. */
  recenter(): void
  /** The latest push (x: right, y: down), or null when nothing is coming. */
  read(): Tilt | null
}

export function createTilt(): TiltSensor {
  let on = false
  let base: { roll: number; nod: number; angle: number } | null = null
  let roll = 0, nod = 0, have = false, at = 0, push2: Tilt = { x: 0, y: 0 }

  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return
    const angle = screenAngle()
    const r = rollAndNod(upOnScreen(e.beta, e.gamma, angle))
    // a little smoothing, so the sensor's noise does not reach the ship
    if (!have) { roll = r.roll; nod = r.nod; have = true } else { roll += (r.roll - roll) * 0.4; nod += wrap180(r.nod - nod) * 0.4 }
    if (!base || base.angle !== angle) base = { roll, nod, angle } // the first reading, or the screen was turned: this is the middle
    push2 = pushOf(roll, nod, base.roll, base.nod)
    at = performance.now()
  }

  return {
    available: () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && navigator.maxTouchPoints > 0,
    needsPermission: () => typeof api()?.requestPermission === 'function',
    async start() {
      if (on) return true
      try {
        const ask = api()?.requestPermission
        if (ask && (await ask.call(api())) !== 'granted') return false
      } catch { return false }
      base = null; have = false
      window.addEventListener('deviceorientation', onOrient)
      on = true
      return true
    },
    stop() { window.removeEventListener('deviceorientation', onOrient); on = false; base = null; have = false },
    recenter() { base = null },
    read: () => (on && performance.now() - at < FRESH_MS ? push2 : null),
  }
}
