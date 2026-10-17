import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { css } from '../css'

// 인터스텔라: a ship shaped like the rotating ring of the Interstellar ship (twelve boxy modules around an eight-sided hub, the
// ring turning, lit from one side with a cool rim light) flies through a black field of stars. It is played in landscape
// (fullscreen when the phone allows it). Steering: tilt the phone, drag with a finger, or on a computer move the mouse: where
// the cursor is from the middle of the game is where the ship goes, and it glides there on a spring, banking into the turn.

type V2 = { x: number; y: number }
type V3 = { x: number; y: number; z: number }
/** One flat piece of the ship: its corners and direction (in the ship's own units); `ring`: it turns with the ring. */
type Face = { p: Float32Array; n: Float32Array; k: number; ring: boolean; gain: number; win: boolean }
type Star = { x: number; y: number; z: number; p: number; c: string }
type ScreenLock = { lock?: (o: string) => Promise<void>; unlock?: () => void; angle?: number }

const FIELD = 700 // the stars fill a box this wide around the path; it wraps, so the field never ends
const DEPTH = 1000 // and this deep
const STARS = 300
const RING = 60, MODULES = 12 // the ring's radius and how many modules it has (ship units)
const EYE = 900 // the viewer's distance from the ship, for perspective (ship units)
const TILT = 22 // degrees of tilt that is a full push
const TILT_DEAD = 2 // degrees the phone can move without anything happening (a steady hand)
const DEAD = 0.06 // the middle of the mouse / finger range that does nothing
const MAXN = 8 // most corners a piece has

const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z })
const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
const mul = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k)
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(a.x, a.y, a.z))
const LIGHT = norm(v3(-0.5, -0.65, -0.55)) // toward the light: from the top left, in front of the ship
const HALF = norm(v3(LIGHT.x, LIGHT.y, LIGHT.z - 1)) // between the light and the viewer (at -z): where the shine is
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const dead = (v: number) => (Math.abs(v) < DEAD ? 0 : clamp(v, -1, 1))
const shape = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 1.3) // finer near the middle
const wrap = (v: number) => ((((v + FIELD) % (2 * FIELD)) + 2 * FIELD) % (2 * FIELD)) - FIELD
const ease = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3)

function newStar(z: number): Star {
  const r = Math.random()
  return { x: (Math.random() * 2 - 1) * FIELD, y: (Math.random() * 2 - 1) * FIELD, z, p: Math.random() * 6.28, c: r < 0.2 ? '190,210,255' : r < 0.32 ? '255,226,190' : '255,255,255' }
}

// ---- the ship's model (built once) ----

function addPoly(out: Face[], pts: V3[], n: V3, ring: boolean, gain: number, win = false) {
  const p = new Float32Array(pts.length * 3)
  pts.forEach((q, i) => { p[i * 3] = q.x; p[i * 3 + 1] = q.y; p[i * 3 + 2] = q.z })
  out.push({ p, n: Float32Array.of(n.x, n.y, n.z), k: pts.length, ring, gain, win })
}

/** A box from its centre, axes and half sizes; `winAxis`: the pair of faces that carries a row of windows. */
function addBox(out: Face[], c: V3, axes: [V3, V3, V3], half: [number, number, number], ring: boolean, gain: number, winAxis = -1) {
  for (let k = 0; k < 3; k++) {
    const o1 = (k + 1) % 3, o2 = (k + 2) % 3
    for (const s of [-1, 1]) {
      const mid = add(c, mul(axes[k], s * half[k]))
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => add(mid, add(mul(axes[o1], p * half[o1]), mul(axes[o2], q * half[o2]))))
      addPoly(out, pts, mul(axes[k], s), ring, gain, k === winAxis)
    }
  }
}

/** An eight-sided prism along the flight (z), with both ends closed. */
function addPrism(out: Face[], rad: number, z0: number, z1: number, gain: number) {
  const n = MAXN, ang = (i: number) => (i / n) * Math.PI * 2
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
    const a = (i / MODULES) * Math.PI * 2
    const r = v3(Math.cos(a), Math.sin(a), 0), t = v3(-Math.sin(a), Math.cos(a), 0)
    addBox(out, mul(r, RING), [t, r, Z], [11, 13, 10], true, 1, 2) // the module, windows on the side that looks at the viewer
    addBox(out, mul(r, RING + 16), [t, r, Z], [6, 3, 6], true, 0.55) // docking collar outside
    addBox(out, mul(r, RING - 15), [t, r, Z], [4, 2, 4], true, 0.55) // and inside
    const am = a + Math.PI / MODULES
    const rm = v3(Math.cos(am), Math.sin(am), 0), tm = v3(-Math.sin(am), Math.cos(am), 0)
    addBox(out, mul(rm, RING * Math.cos(Math.PI / MODULES)), [tm, rm, Z], [7, 2, 2], true, 0.6) // the truss to the next module
  }
  for (let k = 0; k < 6; k++) { // six spokes from the hub to every second module
    const a = (k * Math.PI) / 3
    const r = v3(Math.cos(a), Math.sin(a), 0), t = v3(-Math.sin(a), Math.cos(a), 0)
    addBox(out, mul(r, 26.5), [t, r, Z], [1.6, 16.5, 1.6], true, 0.6)
  }
  addPrism(out, 9, -34, 34, 0.85) // the hub
  addPrism(out, 12, -4, 4, 0.55) // its band
  addPrism(out, 6, -41, -34, 0.5) // the engine nozzle, at the back (the side the viewer sees)
  MODEL = out
  return out
}

// ---- input helpers ----

const screenAngle = (): number => (screen.orientation as ScreenLock | undefined)?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0
const tiltPush = (deg: number) => Math.sign(deg) * clamp((Math.abs(deg) - TILT_DEAD) / (TILT - TILT_DEAD), 0, 1)

// The phone's tilt along the screen's own right and down, as the screen shows it: tilting the right side away from the person
// takes the ship right, and tilting the top away (lowering the phone) takes it down. beta / gamma are in the phone's own frame,
// so the screen's turn decides which of them is the sideways one.
function screenTilt(db: number, dg: number, angle: number): V2 {
  const [right, down] =
    angle === 90 ? [db, dg] :
    angle === -90 || angle === 270 ? [-db, -dg] :
    Math.abs(angle) === 180 ? [-dg, db] :
    [dg, -db]
  return { x: tiltPush(right), y: tiltPush(down) }
}

const orientationApi = () => (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent

/** The ship's icon in 게임 (a black tile with the ring). */
export function SpaceIcon({ size = 60 }: { size?: number }) {
  return (
    <span style={css(`flex:none;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${(size * 0.2237).toFixed(1)}px;background:radial-gradient(circle at 50% 45%,#222a40 0%,#000 72%);box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.18)`)}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <rect key={i} x="10.8" y="2.6" width="2.4" height="4.2" rx="0.5" fill="#c9d3e3" transform={`rotate(${i * 30} 12 12)`} />)}
        <circle cx="12" cy="12" r="1.8" fill="#7fb2ff" />
      </svg>
    </span>
  )
}

const BTN = 'height:32px;padding:0 12px;border-radius:9999px;background:rgba(255,255,255,0.14);color:#fff;font-size:13px;font-weight:600;white-space:nowrap'

/** 인터스텔라: fly the ring ship through the stars. */
export function SpaceGame() {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLSpanElement>(null)
  const aim = useRef<V2 | null>(null) // the mouse, or a finger on the screen, from the middle of the game
  const touching = useRef(false)
  const tilt = useRef<V2 | null>(null) // the phone's tilt, from how it was held when the game began (or when it was turned)
  const tiltBase = useRef<{ b: number; g: number; a: number } | null>(null)
  const tiltAt = useRef(0)
  const [tiltOn, setTiltOn] = useState(false)
  const [askTilt, setAskTilt] = useState(false) // iOS: the tilt is allowed with a tap
  const [hint, setHint] = useState(true)
  const [coarse] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) // a touch screen: a phone
  const [portrait, setPortrait] = useState(false)
  const [full, setFull] = useState(false) // the browser's own fullscreen
  const [fake, setFake] = useState(false) // where the browser has no fullscreen (iPhone): the game covers the whole screen instead

  // a phone with sensors: tilt steers from the start (Android), or once the person allows it (iOS asks)
  useEffect(() => {
    if (!('DeviceOrientationEvent' in window) || navigator.maxTouchPoints === 0) return
    if (typeof orientationApi()?.requestPermission === 'function') setAskTilt(true)
    else setTiltOn(true)
  }, [])
  useEffect(() => { const t = setTimeout(() => setHint(false), 6000); return () => clearTimeout(t) }, [])

  // fullscreen: the browser's own where it exists (Android, a computer), else the game covers the whole screen (iPhone)
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      try { (screen.orientation as ScreenLock | undefined)?.unlock?.() } catch { /* not locked */ }
    }
  }, [])
  const toggleFull = async () => {
    const root = rootRef.current
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return }
    if (fake) { setFake(false); return }
    if (!root?.requestFullscreen) { setFake(true); return }
    try {
      await root.requestFullscreen()
      await (screen.orientation as ScreenLock | undefined)?.lock?.('landscape')
    } catch { setFake(true) } // the phone said no: cover the screen instead
  }

  useEffect(() => {
    if (!tiltOn) return
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      const a = screenAngle()
      // turned to the other way round, the phone's angles are measured from the new place
      if (!tiltBase.current || tiltBase.current.a !== a) tiltBase.current = { b: e.beta, g: e.gamma, a }
      tilt.current = screenTilt(e.beta - tiltBase.current.b, e.gamma - tiltBase.current.g, a)
      tiltAt.current = performance.now()
    }
    aim.current = null // with the tilt on, a finger on the screen does not steer (a thumb resting on the edge must not)
    window.addEventListener('deviceorientation', onOrient)
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [tiltOn])

  const allowTilt = async () => {
    const api = orientationApi()
    try {
      if (api?.requestPermission && (await api.requestPermission()) !== 'granted') return
      setAskTilt(false); tiltBase.current = null; setTiltOn(true)
    } catch { setAskTilt(false) }
  }

  const readAim = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current?.getBoundingClientRect()
    if (!r) return
    aim.current = { x: dead((e.clientX - r.left - r.width / 2) / (r.width / 2)), y: dead((e.clientY - r.top - r.height / 2) / (r.height / 2)) }
  }
  const endTouch = () => { touching.current = false; aim.current = null }

  // the game loop starts again when the game moves between the page and the full screen cover (its canvas is a new one)
  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!root || !canvas || !ctx) return
    let W = 1, H = 1, dpr = 1
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = root.clientWidth; H = root.clientHeight
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      setPortrait(W < H)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(root)

    // px, py: where the ship is on the screen (-1..1), flying on a spring toward where it is steered; cam: how far the stars
    // have slid (the ship flies the other way); yaw / pitch / roll: how it leans into the turn
    const ship = { px: 0, py: 0, vx: 0, vy: 0, yaw: 0, pitch: 0, roll: 0, spin: 0 }
    const cam = { x: 0, y: 0 }
    const tn = { x: 0, y: 0 } // the tilt, smoothed so a shaky hand does not shake the ship
    const stars: Star[] = Array.from({ length: STARS }, () => newStar(1 + Math.random() * DEPTH))
    const faces = model()
    const P = new Float32Array(faces.length * MAXN * 2) // each piece's corners on the screen
    const dep = new Float32Array(faces.length)
    const nrm = new Float32Array(faces.length * 3)
    const vis: number[] = []
    const out = [0, 0, 0]
    let elapsed = 0, dist = 0, hudAt = 0, raf = 0, last = -1

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const t = now / 1000
      const dt = last < 0 ? 0 : Math.min(0.05, t - last)
      last = t
      elapsed += dt
      const speed = 230 + 110 * (1 - Math.exp(-elapsed / 25)) // the stars come faster as the trip goes on
      dist += speed * dt * 20

      // steering: the mouse / finger and the tilt add up; with nothing held the ship glides back to the middle
      const fresh = performance.now() - tiltAt.current < 800
      const target = fresh ? tilt.current : null
      const k1 = Math.min(1, dt * 8)
      tn.x += ((target?.x ?? 0) - tn.x) * k1
      tn.y += ((target?.y ?? 0) - tn.y) * k1
      const a = aim.current
      const sx = shape(clamp((a?.x ?? 0) + tn.x, -1, 1)), sy = shape(clamp((a?.y ?? 0) + tn.y, -1, 1))
      ship.vx += ((sx * 0.88 - ship.px) * 22 - ship.vx * 7) * dt // a spring, a little loose: it glides in and settles
      ship.vy += ((sy * 0.8 - ship.py) * 22 - ship.vy * 7) * dt
      ship.px += ship.vx * dt
      ship.py += ship.vy * dt
      if (Math.abs(ship.px) > 0.95) { ship.px = Math.sign(ship.px) * 0.95; ship.vx *= 0.3 }
      if (Math.abs(ship.py) > 0.95) { ship.py = Math.sign(ship.py) * 0.95; ship.vy *= 0.3 }
      const pcx = cam.x, pcy = cam.y
      cam.x += (ship.px * 150 + ship.vx * 30) * dt
      cam.y += (ship.py * 150 + ship.vy * 30) * dt
      const kb = 1 - Math.exp(-dt * 6)
      ship.yaw += (ship.px * 0.4 + ship.vx * 0.12 - ship.yaw) * kb
      ship.pitch += (ship.py * 0.32 + ship.vy * 0.1 - ship.pitch) * kb
      ship.roll += (ship.vx * 0.14 - ship.roll) * kb // leans into the turn
      ship.spin += dt * (0.45 + speed / 900)

      // the stars: black, a few lights, the near ones leave streaks that bend with the turn
      const F = Math.min(W, H) * 0.9
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      const move = speed * dt
      for (const s of stars) {
        s.z -= move
        if (s.z < 1) Object.assign(s, newStar(DEPTH))
        const dx = wrap(s.x - cam.x), dy = wrap(s.y - cam.y)
        const x = W / 2 + (dx * F) / s.z, y = H / 2 + (dy * F) / s.z
        if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue
        const near = 1 - s.z / DEPTH
        const r = 0.35 + near * 1.4
        const alpha = (0.25 + 0.75 * near) * (0.8 + 0.2 * Math.sin(t * 2 + s.p))
        if (near > 0.35 && dt > 0) {
          const zp = s.z + move
          const px = W / 2 + (wrap(s.x - pcx) * F) / zp, py = H / 2 + (wrap(s.y - pcy) * F) / zp
          ctx.strokeStyle = `rgba(${s.c},${alpha * 0.5})`
          ctx.lineWidth = r
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke()
        }
        ctx.fillStyle = `rgba(${s.c},${alpha})`
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }

      // the ship comes in from the distance when the game starts, then rests with a slow bob
      const intro = ease(elapsed / 1.6)
      const cx0 = W / 2 + ship.px * W * 0.2
      const cy0 = H / 2 + ship.py * H * 0.22 + Math.sin(t * 0.9) * H * 0.006
      const S = Math.min(W, H) * 0.0024 * (0.2 + 0.8 * intro)
      const tf = { cs: Math.cos(ship.spin), sn: Math.sin(ship.spin), cy: Math.cos(ship.yaw), sy: Math.sin(ship.yaw), cp: Math.cos(ship.pitch), sp: Math.sin(ship.pitch), cr: Math.cos(ship.roll), sr: Math.sin(ship.roll) }
      // a point (or a direction) of the ship on its way to the screen: the ring's turn, then yaw, pitch and roll
      const xf = (x0: number, y0: number, z0: number, ring: boolean) => {
        let x = x0, y = y0
        if (ring) { x = x0 * tf.cs - y0 * tf.sn; y = x0 * tf.sn + y0 * tf.cs }
        const x1 = x * tf.cy + z0 * tf.sy, z1 = -x * tf.sy + z0 * tf.cy
        const y2 = y * tf.cp - z1 * tf.sp, z2 = y * tf.sp + z1 * tf.cp
        out[0] = x1 * tf.cr - y2 * tf.sr; out[1] = x1 * tf.sr + y2 * tf.cr; out[2] = z2
      }

      vis.length = 0
      for (let fi = 0; fi < faces.length; fi++) {
        const f = faces[fi]
        xf(f.n[0], f.n[1], f.n[2], f.ring)
        if (out[2] >= 0) continue // looks away from the viewer (at -z)
        nrm[fi * 3] = out[0]; nrm[fi * 3 + 1] = out[1]; nrm[fi * 3 + 2] = out[2]
        let sum = 0
        for (let i = 0; i < f.k; i++) {
          xf(f.p[i * 3], f.p[i * 3 + 1], f.p[i * 3 + 2], f.ring)
          const k2 = (S * EYE) / (EYE + out[2])
          P[(fi * MAXN + i) * 2] = cx0 + out[0] * k2
          P[(fi * MAXN + i) * 2 + 1] = cy0 + out[1] * k2
          sum += out[2]
        }
        dep[fi] = sum / f.k
        vis.push(fi)
      }
      vis.sort((p, q) => dep[q] - dep[p]) // far pieces first

      const pulse = 0.8 + 0.2 * Math.sin(t * 7) + (speed - 230) / 900
      const haloR = S * RING * 1.9
      const halo = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, haloR)
      halo.addColorStop(0, `rgba(150,185,255,${0.2 * intro})`)
      halo.addColorStop(1, 'rgba(150,185,255,0)')
      ctx.fillStyle = halo
      ctx.beginPath(); ctx.arc(cx0, cy0, haloR, 0, Math.PI * 2); ctx.fill()

      ctx.lineJoin = 'round'
      for (const fi of vis) {
        const f = faces[fi], o = fi * MAXN * 2
        const nx = nrm[fi * 3], ny = nrm[fi * 3 + 1], nz = nrm[fi * 3 + 2]
        // light: a soft key light from one side, a shine where the light bounces to the viewer, a cool rim at the edges
        const lit = Math.max(0, nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z)
        const spec = Math.pow(Math.max(0, nx * HALF.x + ny * HALF.y + nz * HALF.z), 28)
        const rim = Math.pow(1 - Math.abs(nz), 3)
        const tone = 0.08 + 0.92 * Math.pow(lit, 1.1)
        const shade = (m: number) => {
          const r = clamp(((16 + 220 * tone) * f.gain + spec * 110 + rim * 24) * m, 0, 255)
          const g = clamp(((22 + 210 * tone) * f.gain + spec * 110 + rim * 60) * m, 0, 255)
          const b = clamp(((38 + 184 * tone) * f.gain + spec * 110 + rim * 130) * m, 0, 255)
          return `rgb(${r | 0},${g | 0},${b | 0})`
        }
        ctx.beginPath()
        ctx.moveTo(P[o], P[o + 1])
        for (let i = 1; i < f.k; i++) ctx.lineTo(P[o + i * 2], P[o + i * 2 + 1])
        ctx.closePath()
        const diag = f.k === 4 ? Math.hypot(P[o + 4] - P[o], P[o + 5] - P[o + 1]) : 0
        if (diag > 9) { // a big face: lighter toward the light, darker away from it
          const gr = ctx.createLinearGradient(P[o], P[o + 1], P[o + 4], P[o + 5])
          gr.addColorStop(0, shade(1.18)); gr.addColorStop(1, shade(0.8))
          ctx.fillStyle = gr
        } else ctx.fillStyle = shade(1)
        ctx.fill()
        ctx.strokeStyle = `rgba(225,232,245,${0.16 + 0.5 * lit})`
        ctx.lineWidth = 0.9
        ctx.stroke()
        if (diag > 15) {
          // a panel set into the face: a darker inner square with a thin light edge
          const cx = (P[o] + P[o + 2] + P[o + 4] + P[o + 6]) / 4, cy = (P[o + 1] + P[o + 3] + P[o + 5] + P[o + 7]) / 4
          ctx.beginPath()
          for (let i = 0; i < 4; i++) {
            const x = cx + (P[o + i * 2] - cx) * 0.72, y = cy + (P[o + i * 2 + 1] - cy) * 0.72
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.fillStyle = 'rgba(0,0,0,0.2)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.09)'
          ctx.lineWidth = 0.7
          ctx.stroke()
          if (f.win && diag > 22) { // a row of three lit windows
            const ux = P[o + 2] - P[o], uy = P[o + 3] - P[o + 1], vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1]
            ctx.fillStyle = 'rgba(255,226,160,0.92)'
            for (const u of [0.25, 0.5, 0.75]) {
              const wx = P[o] + ux * u + vx * 0.5, wy = P[o + 1] + uy * u + vy * 0.5
              ctx.beginPath()
              ctx.moveTo(wx - ux * 0.07 - vx * 0.1, wy - uy * 0.07 - vy * 0.1)
              ctx.lineTo(wx + ux * 0.07 - vx * 0.1, wy + uy * 0.07 - vy * 0.1)
              ctx.lineTo(wx + ux * 0.07 + vx * 0.1, wy + uy * 0.07 + vy * 0.1)
              ctx.lineTo(wx - ux * 0.07 + vx * 0.1, wy - uy * 0.07 + vy * 0.1)
              ctx.closePath(); ctx.fill()
            }
          }
        }
      }

      // the engine at the back of the hub glows (it is what the viewer sees), brighter as the ship goes faster
      xf(0, 0, -41, false)
      const ex = cx0 + out[0] * ((S * EYE) / (EYE + out[2])), ey = cy0 + out[1] * ((S * EYE) / (EYE + out[2]))
      const er = S * 30 * pulse
      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, er)
      eg.addColorStop(0, `rgba(215,238,255,${0.95 * intro})`)
      eg.addColorStop(0.25, `rgba(120,175,255,${0.5 * intro})`)
      eg.addColorStop(1, 'rgba(80,130,255,0)')
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = eg
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'

      if (hudRef.current && t - hudAt > 0.2) { hudAt = t; hudRef.current.textContent = `${Math.floor(dist).toLocaleString('ko-KR')} km` }
    }

    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const start = () => { if (!raf) { last = -1; raf = requestAnimationFrame(frame) } }
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [fake])

  // a phone held upright cannot be flown: the game asks for landscape (a computer's window is never upright here)
  const turnPhone = coarse && portrait
  const touchSteers = !tiltOn // with the tilt on, the screen is only touched for the buttons
  const game = (
    <div ref={rootRef} style={css('position:relative;flex:1;min-height:0;overflow:hidden;background:#000;touch-action:none;user-select:none')}
      onPointerMove={e => { if (e.pointerType !== 'touch' || (touching.current && touchSteers)) readAim(e) }}
      onPointerDown={e => { if (e.pointerType === 'touch' && touchSteers) { touching.current = true; readAim(e) } }}
      onPointerUp={e => { if (e.pointerType === 'touch') endTouch() }}
      onPointerCancel={endTouch}
      onPointerLeave={() => { if (!touching.current) aim.current = null }}>
      <canvas ref={canvasRef} style={css('position:absolute;left:0;top:0;width:100%;height:100%;display:block')} />
      <div style={css('position:absolute;left:18px;top:14px;color:#dfe6f3;font-size:13px;line-height:18px;font-variant-numeric:tabular-nums;pointer-events:none')}>
        <b style={css('font-weight:700;color:#fff')}>인터스텔라</b> · <span ref={hudRef}>0 km</span>
      </div>
      <div style={css('position:absolute;right:12px;top:10px;display:flex;gap:8px')}>
        <button className="pr-96" onClick={toggleFull} style={css(BTN)}>{full || fake ? '나가기' : '전체화면'}</button>
        {tiltOn && <button className="pr-96" onClick={() => { tiltBase.current = null }} style={css(BTN)}>가운데로</button>}
      </div>
      {askTilt && (
        <button className="pr-96" onClick={allowTilt} style={css('position:absolute;left:50%;bottom:64px;transform:translateX(-50%);height:40px;padding:0 18px;border-radius:9999px;background:#fff;color:#000;font-size:14px;font-weight:700;white-space:nowrap')}>기울기로 조종 켜기</button>
      )}
      <div style={css(`position:absolute;left:0;right:0;bottom:20px;text-align:center;color:#9aa6ba;font-size:13px;line-height:19px;pointer-events:none;transition:opacity 900ms;opacity:${hint ? 1 : 0}`)}>
        {tiltOn ? '폰을 기울여 조종해요' : '화면을 누르고 끌거나, 마우스를 움직여 조종해요'}
      </div>
      {turnPhone && (
        <div style={css('position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#000;color:#fff;font-size:16px;font-weight:600')}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.4" /><path d="M11.5 18.5h1" /></svg>
          폰을 가로로 돌려 주세요
        </div>
      )}
    </div>
  )
  if (!fake) return game
  return createPortal(<div style={css('position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:#000')}>{game}</div>, document.body)
}
