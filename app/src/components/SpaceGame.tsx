import { useEffect, useRef, useState } from 'react'
import { css } from '../css'

// 인터스텔라: a ship shaped like the rotating ring of the Interstellar ship (boxy modules around a hub, the ring turning)
// flies through a black field of stars. It is played in landscape (fullscreen when the phone allows it). Steering: tilt the
// phone, drag with a finger, or on a computer move the mouse: where the cursor is from the middle of the game is the way the ship goes.

type V2 = { x: number; y: number }
type V3 = { x: number; y: number; z: number }
type Face = { pts: V3[]; n: V3 }
type Rot = { cy: number; sy: number; cp: number; sp: number }
type Star = { x: number; y: number; z: number; p: number; c: string }
type ScreenLock = { lock?: (o: string) => Promise<void>; unlock?: () => void; angle?: number }

const FIELD = 700 // the stars fill a box this wide around the path; it wraps, so the field never ends
const DEPTH = 1000 // and this deep
const STARS = 240
const RING = 60, MODULES = 10 // the ring's radius and how many modules it has (ship units)
const EYE = 900 // the viewer's distance from the ship, for perspective (ship units)
const TILT = 22 // degrees of tilt that is a full push
const TILT_DEAD = 2 // degrees the phone can move without anything happening (a steady hand)
const DEAD = 0.06 // the middle of the mouse / finger range that does nothing

const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z })
const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
const mul = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k)
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(a.x, a.y, a.z))
const LIGHT = norm(v3(-0.5, -0.7, -0.5)) // toward the light: from the top left, in front of the ship
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const dead = (v: number) => (Math.abs(v) < DEAD ? 0 : clamp(v, -1, 1))
const wrap = (v: number) => ((((v + FIELD) % (2 * FIELD)) + 2 * FIELD) % (2 * FIELD)) - FIELD

function newStar(z: number): Star {
  const r = Math.random()
  return { x: (Math.random() * 2 - 1) * FIELD, y: (Math.random() * 2 - 1) * FIELD, z, p: Math.random() * 6.28, c: r < 0.2 ? '190,210,255' : r < 0.32 ? '255,226,190' : '255,255,255' }
}

// one box: its six faces, from its centre, its three axes and its half sizes
function boxFaces(out: Face[], c: V3, axes: [V3, V3, V3], half: [number, number, number]) {
  for (let k = 0; k < 3; k++) {
    const o1 = (k + 1) % 3, o2 = (k + 2) % 3
    for (const s of [-1, 1]) {
      const mid = add(c, mul(axes[k], s * half[k]))
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => add(mid, add(mul(axes[o1], p * half[o1]), mul(axes[o2], q * half[o2]))))
      out.push({ pts, n: mul(axes[k], s) })
    }
  }
}

// the ship in its own units: the ring of modules turns about the hub, four spokes hold it, the hub runs along the flight
function buildShip(spin: number): Face[] {
  const out: Face[] = [], Z = v3(0, 0, 1)
  for (let i = 0; i < MODULES; i++) {
    const a = spin + (i / MODULES) * Math.PI * 2
    const r = v3(Math.cos(a), Math.sin(a), 0), t = v3(-Math.sin(a), Math.cos(a), 0)
    boxFaces(out, mul(r, RING), [t, r, Z], [13, 15, 11])
  }
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * Math.PI) / 2
    const r = v3(Math.cos(a), Math.sin(a), 0), t = v3(-Math.sin(a), Math.cos(a), 0)
    boxFaces(out, mul(r, RING / 2), [t, r, Z], [3, RING / 2, 3])
  }
  boxFaces(out, v3(0, 0, 0), [v3(1, 0, 0), v3(0, 1, 0), Z], [8, 8, 60])
  return out
}

// turns a point (or a direction) by the ship's yaw (about its up axis) and then its pitch (about its side axis)
function turn(v: V3, R: Rot): V3 {
  const x1 = v.x * R.cy + v.z * R.sy, z1 = -v.x * R.sy + v.z * R.cy
  return v3(x1, v.y * R.cp - z1 * R.sp, v.y * R.sp + z1 * R.cp)
}

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
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <rect key={i} x="10.6" y="2.4" width="2.8" height="4.6" rx="0.6" fill="#c9d3e3" transform={`rotate(${i * 45} 12 12)`} />)}
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
  const [full, setFull] = useState(false)
  const [canFull, setCanFull] = useState(false)

  // a phone with sensors: tilt steers from the start (Android), or once the person allows it (iOS asks)
  useEffect(() => {
    if (!('DeviceOrientationEvent' in window) || navigator.maxTouchPoints === 0) return
    if (typeof orientationApi()?.requestPermission === 'function') setAskTilt(true)
    else setTiltOn(true)
  }, [])
  useEffect(() => { const t = setTimeout(() => setHint(false), 6000); return () => clearTimeout(t) }, [])

  // fullscreen where the phone allows it (Android, a computer); the game is played turned, so it is locked to landscape there
  useEffect(() => {
    setCanFull(!!rootRef.current && typeof rootRef.current.requestFullscreen === 'function')
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
    if (!root) return
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return }
      await root.requestFullscreen()
      await (screen.orientation as ScreenLock | undefined)?.lock?.('landscape')
    } catch { /* the phone said no: the game still plays turned */ }
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

    // ox, oy: where the ship is on the screen (-1..1); cam: how far the stars have slid (the ship flies the other way)
    const ship = { ox: 0, oy: 0, vx: 0, vy: 0, yaw: 0, pitch: 0, spin: 0 }
    const cam = { x: 0, y: 0 }
    const tn = { x: 0, y: 0 } // the tilt, smoothed so a shaky hand does not shake the ship
    const stars: Star[] = Array.from({ length: STARS }, () => newStar(1 + Math.random() * DEPTH))
    let elapsed = 0, dist = 0, hudAt = 0, raf = 0, last = -1

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const t = now / 1000
      const dt = last < 0 ? 0 : Math.min(0.05, t - last)
      last = t
      elapsed += dt
      const speed = 230 + 110 * (1 - Math.exp(-elapsed / 25)) // the stars come faster as the trip goes on
      dist += speed * dt * 20

      // steering: the mouse / finger and the tilt add up; with nothing held the ship drifts back to the middle
      const fresh = performance.now() - tiltAt.current < 800
      const target = fresh ? tilt.current : null
      const k1 = Math.min(1, dt * 8)
      tn.x += ((target?.x ?? 0) - tn.x) * k1
      tn.y += ((target?.y ?? 0) - tn.y) * k1
      const a = aim.current
      const sx = clamp((a?.x ?? 0) + tn.x, -1, 1), sy = clamp((a?.y ?? 0) + tn.y, -1, 1)
      const k = Math.min(1, dt * 4)
      ship.vx += (sx * 1.1 - ship.ox * 0.4 - ship.vx) * k
      ship.vy += (sy * 0.9 - ship.oy * 0.4 - ship.vy) * k
      ship.ox = clamp(ship.ox + ship.vx * dt, -0.92, 0.92)
      ship.oy = clamp(ship.oy + ship.vy * dt, -0.92, 0.92)
      cam.x += ship.ox * 150 * dt
      cam.y += ship.oy * 150 * dt
      ship.yaw += (ship.ox * 0.5 - ship.yaw) * Math.min(1, dt * 3)
      ship.pitch += (ship.oy * 0.4 - ship.pitch) * Math.min(1, dt * 3) // the nose goes down as the ship goes down
      ship.spin += dt * (0.8 + speed / 500)

      // the stars: black, a few lights, the near ones leave short streaks
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
        if (near > 0.5) {
          const px = W / 2 + (dx * F) / (s.z + move), py = H / 2 + (dy * F) / (s.z + move)
          ctx.strokeStyle = `rgba(${s.c},${alpha * 0.45})`
          ctx.lineWidth = r
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke()
        }
        ctx.fillStyle = `rgba(${s.c},${alpha})`
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }

      // the ship: the ring of modules around the hub, with perspective, the far faces first
      const cx0 = W / 2 + ship.ox * W * 0.2, cy0 = H / 2 + ship.oy * H * 0.22
      const S = Math.min(W, H) * 0.0024
      const R: Rot = { cy: Math.cos(ship.yaw), sy: Math.sin(ship.yaw), cp: Math.cos(ship.pitch), sp: Math.sin(ship.pitch) }
      const faces = buildShip(ship.spin)
        .map(f => ({ pts: f.pts.map(p => turn(p, R)), n: turn(f.n, R) }))
        .filter(f => f.n.z < 0) // only the faces that look at the viewer (the viewer is at -z)
      const depth = (f: Face) => f.pts.reduce((sum, p) => sum + p.z, 0) / f.pts.length
      faces.sort((p, q) => depth(q) - depth(p))

      const glow = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, S * RING * 1.8)
      glow.addColorStop(0, 'rgba(150,185,255,0.22)')
      glow.addColorStop(1, 'rgba(150,185,255,0)')
      ctx.fillStyle = glow
      ctx.beginPath(); ctx.arc(cx0, cy0, S * RING * 1.8, 0, Math.PI * 2); ctx.fill()

      for (const f of faces) {
        const lit = Math.max(0, dot(f.n, LIGHT))
        const g = Math.round(20 + 150 * Math.pow(lit, 1.3))
        ctx.beginPath()
        f.pts.forEach((p, i) => {
          const k2 = (S * EYE) / (EYE + p.z)
          const x = cx0 + p.x * k2, y = cy0 + p.y * k2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.fillStyle = `rgb(${g},${g + 3},${g + 10})`
        ctx.fill()
        ctx.strokeStyle = `rgba(210,220,235,${0.2 + 0.55 * lit})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      if (hudRef.current && t - hudAt > 0.2) { hudAt = t; hudRef.current.textContent = `${Math.floor(dist).toLocaleString('ko-KR')} km` }
    }

    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const start = () => { if (!raf) { last = -1; raf = requestAnimationFrame(frame) } }
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // a phone held upright cannot be flown: the game asks for landscape (a computer's window is never upright here)
  const turnPhone = coarse && portrait

  return (
    <div ref={rootRef} style={css('position:relative;flex:1;min-height:0;overflow:hidden;background:#000;touch-action:none;user-select:none')}
      onPointerMove={e => { if (e.pointerType !== 'touch' || touching.current) readAim(e) }}
      onPointerDown={e => { if (e.pointerType === 'touch') { touching.current = true; readAim(e) } }}
      onPointerUp={e => { if (e.pointerType === 'touch') endTouch() }}
      onPointerCancel={endTouch}
      onPointerLeave={() => { if (!touching.current) aim.current = null }}>
      <canvas ref={canvasRef} style={css('position:absolute;left:0;top:0;width:100%;height:100%;display:block')} />
      <div style={css('position:absolute;left:18px;top:14px;color:#dfe6f3;font-size:13px;line-height:18px;font-variant-numeric:tabular-nums;pointer-events:none')}>
        <b style={css('font-weight:700;color:#fff')}>인터스텔라</b> · <span ref={hudRef}>0 km</span>
      </div>
      <div style={css('position:absolute;right:12px;top:10px;display:flex;gap:8px')}>
        {canFull && <button className="pr-96" onClick={toggleFull} style={css(BTN)}>{full ? '나가기' : '전체화면'}</button>}
        {tiltOn && <button className="pr-96" onClick={() => { tiltBase.current = null }} style={css(BTN)}>가운데로</button>}
      </div>
      {askTilt && (
        <button className="pr-96" onClick={allowTilt} style={css('position:absolute;left:50%;bottom:64px;transform:translateX(-50%);height:40px;padding:0 18px;border-radius:9999px;background:#fff;color:#000;font-size:14px;font-weight:700;white-space:nowrap')}>기울기로 조종 켜기</button>
      )}
      <div style={css(`position:absolute;left:0;right:0;bottom:20px;text-align:center;color:#9aa6ba;font-size:13px;line-height:19px;pointer-events:none;transition:opacity 900ms;opacity:${hint ? 1 : 0}`)}>
        기울이거나, 화면을 누르고 끌거나, 마우스를 움직여 조종해요
      </div>
      {turnPhone && (
        <div style={css('position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#000;color:#fff;font-size:16px;font-weight:600')}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.4" /><path d="M11.5 18.5h1" /></svg>
          폰을 가로로 돌려 주세요
        </div>
      )}
    </div>
  )
}
