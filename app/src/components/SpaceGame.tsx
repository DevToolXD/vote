import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { css } from '../css'
import { createEngine, type Engine } from './spaceEngine'
import { createTilt } from './spaceTilt'

// 인터스텔라: the Ranger 1 in space (the world and the flight are in spaceEngine.ts). It is played in landscape, fullscreen when the
// phone allows it. The phone steers (spaceTilt.ts): turned like a steering wheel the nose goes right or left, its top edge pulled
// toward you the nose goes up, pushed away down; a finger on the screen, the mouse cursor (its place from the middle of the game)
// and the arrow keys do the same. Buttons: 가속 (engine), 감속 (retro), and roll left / right (the roll goes on until it is stopped
// with both together). The only thing written on the screen is the speed.

type V2 = { x: number; y: number }
type ScreenLock = { lock?: (o: string) => Promise<void>; unlock?: () => void; angle?: number }

const DEAD = 0.06 // the middle of the mouse / finger range that does nothing
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const dead = (v: number) => (Math.abs(v) < DEAD ? 0 : clamp(v, -1, 1))
const shape = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 1.6) // fine near the middle: the last degrees of an approach are small pushes

/** A distance in words: metres when near, kilometres when not. */
export function fmtDistance(m: number) {
  if (!Number.isFinite(m)) return '-'
  if (m < 1000) return `${Math.round(m)} m`
  const k = m / 1000
  return `${k < 100 ? k.toFixed(1) : Math.round(k).toLocaleString('ko-KR')} km`
}

/** A speed in words: metres a second when slow, kilometres a second when fast. */
export function fmtSpeed(v: number) {
  if (v < 1000) return `${v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v)} m/s`
  const k = v / 1000
  return `${k < 100 ? k.toFixed(1) : Math.round(k).toLocaleString('ko-KR')} km/s`
}

const BTN = 'height:32px;padding:0 12px;border-radius:9999px;background:rgba(255,255,255,0.14);color:#fff;font-size:13px;font-weight:600;white-space:nowrap'
const STEER_KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] }
const OTHER_KEYS = ['KeyU', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyX', 'KeyC', 'ControlLeft', 'KeyQ', 'KeyE']

/** A round button that is held down (a finger, or a mouse button). */
function Hold({ label, size, style, on, children }: { label: string; size: number; style: string; on: (down: boolean) => void; children: ReactNode }) {
  const [down, setDown] = useState(false)
  const set = (d: boolean) => { setDown(d); on(d) }
  return (
    <button aria-label={label} onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); set(true) }} onPointerUp={e => { e.stopPropagation(); set(false) }} onPointerCancel={() => set(false)} onContextMenu={e => e.preventDefault()}
      style={css(`position:absolute;${style};width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;background:${down ? 'rgba(90,150,255,0.55)' : 'rgba(255,255,255,0.13)'};box-shadow:inset 0 0 0 1.5px ${down ? 'rgba(160,200,255,0.95)' : 'rgba(255,255,255,0.32)'};transition:background 160ms,box-shadow 160ms;touch-action:none`)}>{children}</button>
  )
}
const Arrow = ({ flip }: { flip?: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></svg>
)

/** 인터스텔라: fly the Ranger 1. */
export function SpaceGame({ speedPass = false }: { speedPass?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLCanvasElement>(null)
  const frontRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const speedRef = useRef<HTMLDivElement>(null)
  const [action, setAction] = useState('') // what the button in the middle does: 분리 (undock), 내리기 (get out), 타기 (get in)
  const hullRef = useRef<HTMLDivElement>(null)
  const speedMulRef = useRef(1)
  speedMulRef.current = speedPass ? 3 : 1 // the 최대속도 3배 패스
  const noteRef = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  const aim = useRef<V2 | null>(null) // the mouse, or a finger on the screen, from the middle of the game
  const touching = useRef(false)
  const [sensor] = useState(() => createTilt()) // the phone's tilt (spaceTilt.ts)
  const keys = useRef({ x: 0, y: 0, held: new Set<string>() })
  const btn = useRef({ thrust: false, brake: false, cw: false, ccw: false, mouse: false, undock: false })
  const [tiltOn, setTiltOn] = useState(false)
  const [askTilt, setAskTilt] = useState(false) // iOS: the tilt is allowed with a tap
  const [coarse] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) // a touch screen: a phone
  const [box, setBox] = useState({ w: 0, h: 0 }) // the area the game has, as the page gives it
  // On a phone held upright the game is drawn turned a quarter, so it is in landscape from the first moment, whatever the phone's rotation lock
  // says, and nothing stops when the phone is turned. (A computer's window is never turned.)
  const rotated = coarse && box.h > box.w
  useEffect(() => { sensor.setAngle(rotated ? 90 : null) }, [rotated, sensor]) // the content's top is the phone's right edge: the same as the screen turned to 90
  const [full, setFull] = useState(false) // the browser's own fullscreen
  const [fake, setFake] = useState(false) // where the browser has no fullscreen (iPhone): the game covers the whole screen instead

  // a phone with sensors: tilt steers from the start (Android), or once the person allows it with a tap (iOS asks)
  useEffect(() => {
    if (!sensor.available()) return
    if (sensor.needsPermission()) setAskTilt(true)
    else sensor.start().then(ok => { if (ok) setTiltOn(true) })
    return () => sensor.stop()
  }, [sensor])

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

  useEffect(() => { if (tiltOn) aim.current = null }, [tiltOn]) // with the tilt on, a finger on the screen does not steer (a thumb resting on the edge must not)

  // the keyboard: arrows or WASD steer, Q / E roll, Space or Shift push, X or Ctrl brake
  useEffect(() => {
    const k = keys.current
    const apply = () => {
      k.x = 0; k.y = 0
      for (const c of k.held) { const s = STEER_KEYS[c]; if (s) { k.x += s[0]; k.y += s[1] } }
    }
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
    const down = (e: KeyboardEvent) => {
      if (typing(e) || !(e.code in STEER_KEYS || OTHER_KEYS.includes(e.code))) return
      e.preventDefault(); k.held.add(e.code); apply()
    }
    const up = (e: KeyboardEvent) => { k.held.delete(e.code); apply() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); k.held.clear(); apply() }
  }, [])

  const allowTilt = async () => { if (await sensor.start()) { setAskTilt(false); setTiltOn(true) } }

  const readAim = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current?.getBoundingClientRect()
    if (!r) return
    if (rotated) { // the game's right is the screen's down, its down the screen's left
      const u = e.clientY - r.top, v = r.width - (e.clientX - r.left)
      aim.current = { x: dead((u - r.height / 2) / (r.height / 2)), y: dead((v - r.width / 2) / (r.width / 2)) }
    } else aim.current = { x: dead((e.clientX - r.left - r.width / 2) / (r.width / 2)), y: dead((e.clientY - r.top - r.height / 2) / (r.height / 2)) }
  }
  const endTouch = () => { touching.current = false; aim.current = null }

  // the game loop starts again when the game moves between the page and the full screen cover (its canvases are new ones)
  useEffect(() => {
    const root = rootRef.current, back = backRef.current, front = frontRef.current, layer = layerRef.current
    if (!root || !back || !front || !layer) return
    const eng = engine.current ?? (engine.current = createEngine(import.meta.env.BASE_URL, {
      hud: h => {
        if (speedRef.current) speedRef.current.textContent = `속도 ${fmtSpeed(h.speed)}`
        setAction(a => (a === h.action ? a : h.action))
        if (noteRef.current) noteRef.current.textContent = h.note
        if (hullRef.current) { // shown once the hull is hurt
          hullRef.current.textContent = h.hull < 100 ? `내구도 ${Math.max(0, Math.ceil(h.hull))}%` : ''
          hullRef.current.style.color = h.hull < 35 ? '#ff6b5e' : '#fff'
        }
      },
      haptic: p => { try { navigator.vibrate?.(p) } catch { /* no vibration */ } },
    }))
    eng.attach(back, front, layer)
    if (new URLSearchParams(location.search).has('spacedebug')) (window as unknown as { __space?: Engine }).__space = eng // for testing
    const fit = () => {
      const w = root.clientWidth, h = root.clientHeight, turned = coarse && h > w
      eng.resize(turned ? h : w, turned ? w : h, Math.min(window.devicePixelRatio || 1, 3)) // (the game turns its own picture down when the phone cannot keep up)
      setBox(b => (b.w === w && b.h === h ? b : { w, h }))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(root)

    const tn = { x: 0, y: 0 } // the tilt, smoothed so a shaky hand does not shake the ship
    let raf = 0, last = -1
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const t = now / 1000
      const dt = last < 0 ? 0 : Math.min(0.05, t - last)
      last = t
      // the mouse / finger, the tilt and the keys add up
      const target = sensor.read()
      const k1 = Math.min(1, dt * 8)
      tn.x += ((target?.x ?? 0) - tn.x) * k1
      tn.y += ((target?.y ?? 0) - tn.y) * k1
      const a = aim.current, k = keys.current, b = btn.current
      const cw = b.cw || k.held.has('KeyE'), ccw = b.ccw || k.held.has('KeyQ')
      eng.frame(now, {
        yaw: shape(clamp((a?.x ?? 0) + tn.x + k.x, -1, 1)),
        pitch: shape(clamp((a?.y ?? 0) + tn.y + k.y, -1, 1)),
        roll: (cw ? 1 : 0) - (ccw ? 1 : 0),
        rollStop: cw && ccw,
        thrust: b.thrust || b.mouse || k.held.has('Space') || k.held.has('ShiftLeft') || k.held.has('ShiftRight'),
        brake: b.brake || k.held.has('KeyX') || k.held.has('KeyC') || k.held.has('ControlLeft'),
        speedMul: speedMulRef.current,
        undock: b.undock || k.held.has('KeyU'),
      })
    }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const start = () => { if (!raf) { last = -1; raf = requestAnimationFrame(frame) } }
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); eng.detach() }
  }, [fake, sensor, coarse])

  const touchSteers = !tiltOn // with the tilt on, the screen is only touched for the buttons
  const game = (
    <div ref={rootRef} style={css('position:relative;flex:1;min-height:0;overflow:hidden;background:#000;touch-action:none;user-select:none')}
      onPointerMove={e => { if (e.pointerType !== 'touch' || (touching.current && touchSteers)) readAim(e) }}
      onPointerDown={e => {
        if (e.pointerType === 'touch' && touchSteers) { touching.current = true; readAim(e) }
        if (e.pointerType === 'mouse' && e.button === 0) btn.current.mouse = true
      }}
      onPointerUp={e => { if (e.pointerType === 'touch') endTouch(); if (e.pointerType === 'mouse') btn.current.mouse = false }}
      onPointerCancel={() => { endTouch(); btn.current.mouse = false }}
      onPointerLeave={e => { if (!touching.current) aim.current = null; if (e.pointerType === 'mouse') btn.current.mouse = false }}>
      <div style={css(rotated ? `position:absolute;left:100%;top:0;width:${box.h}px;height:${box.w}px;transform-origin:0 0;transform:rotate(90deg);overflow:hidden` : 'position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden')}>
      <canvas ref={backRef} style={css('position:absolute;left:0;top:0;width:100%;height:100%;display:block')} />
      <div ref={layerRef} style={css('position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none')} />
      <canvas ref={frontRef} style={css('position:absolute;left:0;top:0;width:100%;height:100%;display:block')} />
      <div style={css('position:absolute;left:16px;top:12px;color:#fff;font-size:14px;font-weight:600;line-height:19px;font-variant-numeric:tabular-nums;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,0.8)')}>
        <div ref={speedRef}>속도 0.00 m/s</div>
        <div ref={hullRef} />
        <div ref={noteRef} style={css('color:#8ecbff')} />
      </div>
      <div style={css('position:absolute;right:12px;top:10px;display:flex;gap:8px')}>
        <button className="pr-96" onClick={toggleFull} style={css(BTN)}>{full || fake ? '나가기' : '전체화면'}</button>
        {tiltOn && <button className="pr-96" onClick={() => sensor.recenter()} style={css(BTN)}>가운데로</button>}
      </div>
      <Hold label="왼쪽으로 구르기" size={56} style="left:16px;bottom:18px" on={d => { btn.current.ccw = d }}><Arrow flip /></Hold>
      <Hold label="오른쪽으로 구르기" size={56} style="left:80px;bottom:18px" on={d => { btn.current.cw = d }}><Arrow /></Hold>
      <Hold label="감속" size={56} style="right:100px;bottom:18px" on={d => { btn.current.brake = d }}>감속</Hold>
      {action && <Hold label={action} size={64} style="left:50%;margin-left:-32px;bottom:18px" on={d => { btn.current.undock = d }}>{action}</Hold>}
      <Hold label="가속" size={72} style="right:18px;bottom:18px" on={d => { btn.current.thrust = d }}>가속</Hold>
      {askTilt && (
        <button className="pr-96" onClick={allowTilt} style={css('position:absolute;left:50%;bottom:64px;transform:translateX(-50%);height:40px;padding:0 18px;border-radius:9999px;background:#fff;color:#000;font-size:14px;font-weight:700;white-space:nowrap')}>기울기로 조종 켜기</button>
      )}
      </div>
    </div>
  )
  if (!fake) return game
  return createPortal(<div style={css('position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:#000')}>{game}</div>, document.body)
}
