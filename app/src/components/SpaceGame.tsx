import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { css } from '../css'
import { createEngine, type Engine, type Hud } from './spaceEngine'

// 인터스텔라: a free 3D flight in space (the world is in spaceEngine.ts). It is played in landscape, fullscreen when the phone
// allows it. The phone's tilt steers like a plane's stick: raised, the ship climbs, lowered, it dives; tilted right or left it
// banks and turns. A finger on the screen, the mouse cursor (its place from the middle of the game) and the arrow keys do the same;
// the 가속 button, the mouse button held down, or Space / Shift speed the ship up to reach what is far away.

type V2 = { x: number; y: number }
type ScreenLock = { lock?: (o: string) => Promise<void>; unlock?: () => void; angle?: number }

const TILT = 22 // degrees of tilt that is a full push
const TILT_DEAD = 2 // degrees the phone can move without anything happening (a steady hand)
const DEAD = 0.06 // the middle of the mouse / finger range that does nothing

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const dead = (v: number) => (Math.abs(v) < DEAD ? 0 : clamp(v, -1, 1))
const shape = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 1.3) // finer near the middle
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
const STEER_KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] }

/** 인터스텔라: fly the ring ship through space. */
export function SpaceGame() {
  const rootRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLCanvasElement>(null)
  const frontRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  const aim = useRef<V2 | null>(null) // the mouse, or a finger on the screen, from the middle of the game
  const touching = useRef(false)
  const tilt = useRef<V2 | null>(null) // the phone's tilt, from how it was held when the game began (or when it was turned)
  const tiltBase = useRef<{ b: number; g: number; a: number } | null>(null)
  const tiltAt = useRef(0)
  const keys = useRef({ x: 0, y: 0, boost: false, held: new Set<string>() })
  const boostHeld = useRef(false) // the 가속 button or the mouse button
  const toastId = useRef(0)
  const [tiltOn, setTiltOn] = useState(false)
  const [askTilt, setAskTilt] = useState(false) // iOS: the tilt is allowed with a tap
  const [hint, setHint] = useState(true)
  const [coarse] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) // a touch screen: a phone
  const [portrait, setPortrait] = useState(false)
  const [full, setFull] = useState(false) // the browser's own fullscreen
  const [fake, setFake] = useState(false) // where the browser has no fullscreen (iPhone): the game covers the whole screen instead
  const [hud, setHud] = useState<Hud | null>(null)
  const [toasts, setToasts] = useState<{ id: number; icon: string; text: string }[]>([])
  const [boosting, setBoosting] = useState(false)

  // a phone with sensors: tilt steers from the start (Android), or once the person allows it (iOS asks)
  useEffect(() => {
    if (!('DeviceOrientationEvent' in window) || navigator.maxTouchPoints === 0) return
    if (typeof orientationApi()?.requestPermission === 'function') setAskTilt(true)
    else setTiltOn(true)
  }, [])
  useEffect(() => { const t = setTimeout(() => setHint(false), 9000); return () => clearTimeout(t) }, [])

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

  // the keyboard: arrows or WASD steer, Space or Shift speed up
  useEffect(() => {
    const k = keys.current
    const apply = () => {
      k.x = 0; k.y = 0; k.boost = k.held.has('Space') || k.held.has('ShiftLeft') || k.held.has('ShiftRight')
      for (const c of k.held) { const s = STEER_KEYS[c]; if (s) { k.x += s[0]; k.y += s[1] } }
    }
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
    const down = (e: KeyboardEvent) => {
      if (typing(e) || !(e.code in STEER_KEYS || e.code === 'Space' || e.code.startsWith('Shift'))) return
      e.preventDefault(); k.held.add(e.code); apply()
    }
    const up = (e: KeyboardEvent) => { k.held.delete(e.code); apply() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); k.held.clear(); apply() }
  }, [])

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
  const setBoost = (on: boolean) => { boostHeld.current = on; setBoosting(on) }

  // the game loop starts again when the game moves between the page and the full screen cover (its canvases are new ones)
  useEffect(() => {
    const root = rootRef.current, back = backRef.current, front = frontRef.current, layer = layerRef.current
    if (!root || !back || !front || !layer) return
    const eng = engine.current ?? (engine.current = createEngine(import.meta.env.BASE_URL, {
      hud: setHud,
      toast: t => {
        const id = ++toastId.current
        setToasts(l => [...l.slice(-2), { id, ...t }])
        setTimeout(() => setToasts(l => l.filter(x => x.id !== id)), 4200)
      },
    }))
    eng.attach(back, front, layer)
    if (new URLSearchParams(location.search).has('spacedebug')) (window as unknown as { __space?: Engine }).__space = eng // for testing
    const fit = () => {
      eng.resize(root.clientWidth, root.clientHeight, Math.min(window.devicePixelRatio || 1, 2))
      setPortrait(root.clientWidth < root.clientHeight)
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
      const fresh = performance.now() - tiltAt.current < 800
      const target = fresh ? tilt.current : null
      const k1 = Math.min(1, dt * 8)
      tn.x += ((target?.x ?? 0) - tn.x) * k1
      tn.y += ((target?.y ?? 0) - tn.y) * k1
      const a = aim.current, k = keys.current
      eng.frame(now, {
        sx: shape(clamp((a?.x ?? 0) + tn.x + k.x, -1, 1)),
        sy: shape(clamp((a?.y ?? 0) + tn.y + k.y, -1, 1)),
        boost: boostHeld.current || k.boost,
      })
    }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const start = () => { if (!raf) { last = -1; raf = requestAnimationFrame(frame) } }
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); eng.detach() }
  }, [fake])

  // a phone held upright cannot be flown: the game asks for landscape (a computer's window is never upright here)
  const turnPhone = coarse && portrait
  const touchSteers = !tiltOn // with the tilt on, the screen is only touched for the buttons
  const game = (
    <div ref={rootRef} style={css('position:relative;flex:1;min-height:0;overflow:hidden;background:#000;touch-action:none;user-select:none')}
      onPointerMove={e => { if (e.pointerType !== 'touch' || (touching.current && touchSteers)) readAim(e) }}
      onPointerDown={e => {
        if (e.pointerType === 'touch' && touchSteers) { touching.current = true; readAim(e) }
        if (e.pointerType === 'mouse' && e.button === 0) setBoost(true)
      }}
      onPointerUp={e => { if (e.pointerType === 'touch') endTouch(); if (e.pointerType === 'mouse') setBoost(false) }}
      onPointerCancel={() => { endTouch(); setBoost(false) }}
      onPointerLeave={e => { if (!touching.current) aim.current = null; if (e.pointerType === 'mouse') setBoost(false) }}>
      <canvas ref={backRef} style={css('position:absolute;left:0;top:0;width:100%;height:100%;display:block')} />
      <div ref={layerRef} style={css('position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none')} />
      <canvas ref={frontRef} style={css('position:absolute;left:0;top:0;width:100%;height:100%;display:block')} />
      <div style={css('position:absolute;left:16px;top:12px;color:#dfe6f3;font-size:12px;line-height:17px;font-variant-numeric:tabular-nums;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,0.8)')}>
        <div><b style={css('font-weight:700;color:#fff;font-size:13px')}>인터스텔라</b> · 이동 {Math.floor(hud?.dist ?? 0).toLocaleString('ko-KR')} 만km</div>
        <div>속도 광속 ×{Math.round(hud?.c ?? 14)} · 발견 {hud?.found ?? 0}</div>
        {hud?.near && <div style={css('color:#aebbd0')}>{hud.near.name} · {hud.near.kind} · {Math.round(hud.near.d).toLocaleString('ko-KR')} 만km</div>}
        {hud?.warn && <div style={css('color:#ffb35a;font-weight:600')}>{hud.warn}</div>}
      </div>
      <div style={css('position:absolute;left:0;right:0;top:12px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none')}>
        {toasts.map(t => (
          <div key={t.id} style={css('max-width:70%;padding:7px 14px;border-radius:9999px;background:rgba(20,24,36,0.78);color:#fff;font-size:13px;font-weight:600;animation:pageIn 320ms cubic-bezier(0.32,0.72,0,1) both;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)')}>{t.icon} {t.text}</div>
        ))}
      </div>
      <div style={css('position:absolute;right:12px;top:10px;display:flex;gap:8px')}>
        <button className="pr-96" onClick={toggleFull} style={css(BTN)}>{full || fake ? '나가기' : '전체화면'}</button>
        {tiltOn && <button className="pr-96" onClick={() => { tiltBase.current = null }} style={css(BTN)}>가운데로</button>}
      </div>
      <button aria-label="가속" onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setBoost(true) }} onPointerUp={e => { e.stopPropagation(); setBoost(false) }} onPointerCancel={() => setBoost(false)}
        style={css(`position:absolute;right:22px;bottom:22px;width:68px;height:68px;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;background:${boosting ? 'rgba(90,150,255,0.55)' : 'rgba(255,255,255,0.14)'};box-shadow:inset 0 0 0 1.5px ${boosting ? 'rgba(160,200,255,0.95)' : 'rgba(255,255,255,0.35)'};transition:background 180ms,box-shadow 180ms;touch-action:none`)}>가속</button>
      {askTilt && (
        <button className="pr-96" onClick={allowTilt} style={css('position:absolute;left:50%;bottom:64px;transform:translateX(-50%);height:40px;padding:0 18px;border-radius:9999px;background:#fff;color:#000;font-size:14px;font-weight:700;white-space:nowrap')}>기울기로 조종 켜기</button>
      )}
      <div style={css(`position:absolute;left:0;right:100px;bottom:20px;text-align:center;color:#9aa6ba;font-size:13px;line-height:19px;pointer-events:none;transition:opacity 900ms;opacity:${hint ? 1 : 0};text-shadow:0 1px 3px rgba(0,0,0,0.8)`)}>
        {tiltOn ? '폰을 위로 들면 위로, 내리면 아래로 · 좌우로 기울이면 방향이 바뀌어요' : '마우스를 움직여 방향을 바꾸고, 누르고 있으면 가속해요 (방향키·Space도 돼요)'}
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
