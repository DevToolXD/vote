import { useEffect, useRef, type PointerEvent } from 'react'
import { css } from '../css'

// 공룡 점프: the offline game that shows when Chrome has no connection. A T-Rex runs; jump over
// the cacti, duck under the low birds. The world is 600 × 150 and scales to the screen. The best
// score stays on this device.

const W = 600, H = 150, GROUND = 130
const INK = '#535353', PAPER = '#f7f7f7', CLOUD = '#d9d9d9'
const DINO_X = 44, DINO_H = 47, DUCK_H = 25
const GRAVITY = 0.6, JUMP = 10.5, START_SPEED = 6, MAX_SPEED = 13, ACCEL = 0.002

type Obstacle = { x: number; w: number; h: number; alt: number; bird?: boolean }
type Phase = 'ready' | 'run' | 'over'
type Game = {
  phase: Phase; y: number; vy: number; duck: boolean; holdDuck: boolean
  obs: Obstacle[]; gap: number; speed: number; dist: number; score: number; hi: number
  clouds: { x: number; y: number; s: number }[]; t: number
}

const loadHi = () => { try { return Number(localStorage.getItem('dino-hi') ?? 0) || 0 } catch { return 0 } }
const saveHi = (n: number) => { try { localStorage.setItem('dino-hi', String(n)) } catch { /* private window */ } }
const pad = (n: number) => String(Math.floor(n)).padStart(5, '0')

function fresh(hi: number): Game {
  return {
    phase: 'ready', y: 0, vy: 0, duck: false, holdDuck: false,
    obs: [], gap: 300, speed: START_SPEED, dist: 0, score: 0, hi,
    clouds: [{ x: 120, y: 34, s: 1 }, { x: 380, y: 52, s: 0.8 }, { x: 560, y: 28, s: 1.1 }], t: 0,
  }
}

export function DinoGame() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const g = useRef<Game>(fresh(loadHi()))

  // fit the 600 × 150 world into the space
  useEffect(() => {
    const el = box.current, f = frame.current
    if (!el || !f) return
    const fit = () => {
      const k = Math.min(el.clientWidth / W, el.clientHeight / H)
      f.style.width = `${W * k}px`
      f.style.height = `${H * k}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const restart = () => {
    const s = g.current
    g.current = { ...fresh(s.hi), phase: 'run' }
  }
  const jump = () => {
    const s = g.current
    if (s.phase === 'over') return restart()
    if (s.phase === 'ready') s.phase = 'run'
    if (s.y === 0 && !s.duck) s.vy = -JUMP
  }

  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    c.width = W * 2; c.height = H * 2
    ctx.scale(2, 2)
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(2, (now - last) / (1000 / 60)) // 1 = one 60 Hz frame
      last = now
      step(g.current, dt)
      draw(ctx, g.current)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) jump() }
      if (e.code === 'ArrowDown') { e.preventDefault(); g.current.holdDuck = true }
    }
    const up = (e: KeyboardEvent) => { if (e.code === 'ArrowDown') g.current.holdDuck = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a tap in the upper part jumps; holding the lower part ducks (until released)
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    if ((e.clientY - r.top) / r.height > 0.6) g.current.holdDuck = true
    else jump()
  }
  const onUp = () => { g.current.holdDuck = false }

  return (
    <div ref={box} style={css('position:relative;width:100%;height:100%;min-height:0;display:flex;align-items:center;justify-content:center;background:#ffffff;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none')}>
      <div ref={frame} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp} style={css('position:relative;flex:none;background:' + PAPER)}>
        <canvas ref={canvas} aria-label="공룡 점프 게임 화면" style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  )
}

/** One step of the game: the T-Rex, the cacti and birds, the clouds and the score. */
function step(s: Game, dt: number) {
  s.t += dt
  if (s.phase === 'over') return
  if (s.phase === 'ready') return // the dino waits for the first tap
  s.speed = Math.min(MAX_SPEED, s.speed + ACCEL * dt)
  s.dist += s.speed * dt
  s.score += s.speed * dt * 0.1
  // the dino: gravity, a fast fall when ducking in the air
  s.duck = s.holdDuck && s.y === 0
  s.vy += GRAVITY * dt * (s.holdDuck && s.y > 0 ? 3 : 1)
  s.y = Math.max(0, s.y - s.vy * dt)
  if (s.y === 0) s.vy = 0
  // the world moves towards the dino
  for (const o of s.obs) o.x -= s.speed * dt
  s.obs = s.obs.filter(o => o.x + o.w > -10)
  s.gap -= s.speed * dt
  if (s.gap <= 0) {
    spawn(s)
    s.gap = 240 + Math.random() * 220 + s.speed * 8
  }
  for (const c of s.clouds) c.x -= s.speed * 0.3 * c.s * dt
  for (const c of s.clouds) if (c.x < -40) { c.x = W + 40 + Math.random() * 120; c.y = 20 + Math.random() * 40 }
  // collisions: boxes shrunk a little, as the original does
  const h = s.duck ? DUCK_H : DINO_H
  const dl = DINO_X + 6, dr = DINO_X + 34, dtop = GROUND - s.y - h + 4, dbot = GROUND - s.y - 3
  for (const o of s.obs) {
    const top = GROUND - o.alt - o.h, bottom = GROUND - o.alt
    if (o.x + 3 < dr && o.x + o.w - 3 > dl && top + 3 < dbot && bottom - 3 > dtop) {
      s.phase = 'over'
      if (Math.floor(s.score) > s.hi) { s.hi = Math.floor(s.score); saveHi(s.hi) }
      return
    }
  }
}

/** A cactus (on the ground), or a bird at one of three heights: low (jump), middle (duck), high (run under). */
function spawn(s: Game) {
  const r = Math.random()
  if (s.score > 200 && r < 0.25) {
    const alt = [10, 30, 60][Math.floor(Math.random() * 3)]
    s.obs.push({ x: W + 10, w: 40, h: 24, alt, bird: true })
    return
  }
  const big = Math.random() < 0.4
  const w = big ? 24 : 17, h = big ? 50 : 35
  const count = Math.random() < 0.3 ? 2 : 1
  for (let i = 0; i < count; i++) s.obs.push({ x: W + 10 + i * (w + 6), w, h, alt: 0 })
}

function draw(ctx: CanvasRenderingContext2D, s: Game) {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  // clouds
  ctx.fillStyle = CLOUD
  for (const c of s.clouds) {
    ctx.beginPath()
    ctx.arc(c.x, c.y, 9 * c.s, 0, Math.PI * 2)
    ctx.arc(c.x + 10 * c.s, c.y - 4 * c.s, 12 * c.s, 0, Math.PI * 2)
    ctx.arc(c.x + 22 * c.s, c.y, 9 * c.s, 0, Math.PI * 2)
    ctx.fill()
  }
  // ground: a line and pebbles that scroll past
  ctx.fillStyle = INK
  ctx.fillRect(0, GROUND, W, 1.2)
  for (let i = 0; i < 12; i++) {
    const x = ((i * 53 - s.dist) % W + W) % W
    ctx.fillRect(x, GROUND + 6 + (i % 3) * 3, 2 + (i % 4), 1)
  }
  // obstacles
  for (const o of s.obs) {
    const top = GROUND - o.alt - o.h
    if (o.bird) drawBird(ctx, o.x, top, s.t)
    else drawCactus(ctx, o.x, GROUND - o.h, o.w, o.h)
  }
  // the dino: legs alternate while running
  drawDino(ctx, GROUND - s.y, s.duck, Math.floor(s.dist / 6) % 2, s.phase === 'over')
  // score, the best score, and the game-over plate
  ctx.fillStyle = INK
  ctx.font = 'bold 13px "Courier New", monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`HI ${pad(s.hi)}  ${pad(s.score)}`, W - 12, 22)
  if (s.phase === 'over') {
    ctx.textAlign = 'center'
    ctx.font = 'bold 16px "Courier New", monospace'
    ctx.fillText('G A M E   O V E R', W / 2, 62)
    // the restart mark: a circle with an arrow head
    ctx.lineWidth = 3
    ctx.strokeStyle = INK
    ctx.beginPath(); ctx.arc(W / 2, 90, 11, 0.6, Math.PI * 2 - 0.6); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W / 2 + 7, 76); ctx.lineTo(W / 2 + 12, 84); ctx.lineTo(W / 2 + 4, 85); ctx.fill()
  }
  if (s.phase === 'ready') {
    ctx.textAlign = 'center'
    ctx.font = 'bold 13px "Courier New", monospace'
    ctx.fillText('TAP OR SPACE TO START', W / 2, 62)
  }
}

function drawDino(ctx: CanvasRenderingContext2D, bottom: number, duck: boolean, leg: number, dead: boolean) {
  const h = duck ? DUCK_H : DINO_H
  const L = DINO_X, T = bottom - h
  ctx.fillStyle = INK
  if (duck) {
    ctx.fillRect(L, T + 8, 36, 10)        // long low body
    ctx.fillRect(L + 26, T + 2, 16, 10)   // head
    ctx.fillRect(L + 38, T + 5, 6, 3)     // snout
    ctx.fillRect(L - 4, T + 8, 6, 4)      // tail
  } else {
    ctx.fillRect(L + 6, T + 14, 26, 20)   // body
    ctx.fillRect(L + 16, T, 24, 16)       // head
    ctx.fillRect(L + 34, T + 6, 8, 5)     // snout
    ctx.fillRect(L - 2, T + 12, 10, 6)    // tail
  }
  // legs: one lifted in turns
  const legTop = T + (duck ? 16 : 32)
  ctx.fillRect(L + (duck ? 12 : 10), legTop, 7, bottom - legTop - (leg && !duck ? 4 : 0))
  ctx.fillRect(L + (duck ? 24 : 22), legTop, 7, bottom - legTop - (!leg || duck ? 0 : 4))
  // the eye: open, or crossed out when dead
  if (dead) {
    ctx.strokeStyle = PAPER; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(L + 31, T + 3); ctx.lineTo(L + 35, T + 7); ctx.moveTo(L + 35, T + 3); ctx.lineTo(L + 31, T + 7); ctx.stroke()
  } else {
    ctx.fillStyle = PAPER
    ctx.fillRect(L + 31, T + 3, 4, 4)
    ctx.fillStyle = INK
    ctx.fillRect(L + 33, T + 4, 2, 2)
  }
}

function drawCactus(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, h: number) {
  ctx.fillStyle = INK
  ctx.fillRect(x + w * 0.3, top, w * 0.4, h)
  if (h >= 50) {
    ctx.fillRect(x, top + h * 0.4, w * 0.3, h * 0.18)
    ctx.fillRect(x, top + h * 0.2, w * 0.3, h * 0.2)
    ctx.fillRect(x + w * 0.7, top + h * 0.25, w * 0.3, h * 0.18)
    ctx.fillRect(x + w * 0.7, top + h * 0.05, w * 0.3, h * 0.2)
  }
}

function drawBird(ctx: CanvasRenderingContext2D, x: number, top: number, t: number) {
  ctx.fillStyle = INK
  ctx.fillRect(x + 8, top + 8, 24, 9)      // body
  ctx.fillRect(x + 28, top + 10, 10, 4)    // beak
  ctx.fillRect(x + 8, top + 11, 4, 3)      // tail
  // the wing beats between up and down
  const up = Math.floor(t / 10) % 2 === 0
  ctx.beginPath()
  if (up) { ctx.moveTo(x + 14, top + 8); ctx.lineTo(x + 20, top); ctx.lineTo(x + 26, top + 8) }
  else { ctx.moveTo(x + 14, top + 17); ctx.lineTo(x + 20, top + 24); ctx.lineTo(x + 26, top + 17) }
  ctx.fill()
}
