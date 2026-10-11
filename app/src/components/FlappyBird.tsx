import { useEffect, useRef, useState } from 'react'
import { css } from '../css'

// 플래피 버드: tap (or press space) to flap; fly between the pipes. Touching a pipe or the ground ends
// the game. The best score stays on this device. Drawn on a canvas in a fixed 288 × 512 world that
// scales to the screen.

const W = 288, H = 512, GROUND = 84
const GRAVITY = 0.36, FLAP = -6.3, SPEED = 2.5, GAP = 128, SPACING = 176, PIPE_W = 52, BIRD_R = 12

type Pipe = { x: number; gapY: number; passed: boolean }
type Phase = 'ready' | 'play' | 'over'

const loadBest = () => { try { return Number(localStorage.getItem('flappy-best') ?? 0) || 0 } catch { return 0 } }
const saveBest = (n: number) => { try { localStorage.setItem('flappy-best', String(n)) } catch { /* private window */ } }

export function FlappyBird() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(loadBest)
  // game state lives in a ref: the frame loop must not wait for React
  const g = useRef({ y: H * 0.42, vy: 0, pipes: [] as Pipe[], dist: 0, score: 0, phase: 'ready' as Phase, t: 0 })

  // fit the 288 × 512 world into the space (never bigger than the device width)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const reset = () => {
    g.current = { y: H * 0.42, vy: 0, pipes: [], dist: 0, score: 0, phase: 'ready', t: 0 }
    setPhase('ready'); setScore(0)
  }
  const flap = () => {
    const s = g.current
    if (s.phase === 'over') return
    if (s.phase === 'ready') { s.phase = 'play'; setPhase('play') }
    s.vy = FLAP
  }
  const over = () => {
    const s = g.current
    if (s.phase === 'over') return
    s.phase = 'over'; setPhase('over')
    if (s.score > loadBest()) { saveBest(s.score); setBest(s.score) }
  }

  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    c.width = W * 2; c.height = H * 2
    ctx.scale(2, 2)
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(2, (now - last) / (1000 / 60)) // 1 = one 60 Hz frame
      last = now
      const s = g.current
      if (s.phase === 'play') {
        s.vy += GRAVITY * dt
        s.y += s.vy * dt
        s.dist += SPEED * dt
        // a new pipe every SPACING pixels of travel
        if (s.pipes.length === 0 || s.pipes[s.pipes.length - 1].x < W - SPACING) {
          const gapY = 110 + Math.random() * (H - GROUND - 220)
          s.pipes.push({ x: W + 10, gapY, passed: false })
        }
        for (const p of s.pipes) p.x -= SPEED * dt
        s.pipes = s.pipes.filter(p => p.x > -PIPE_W - 10)
        for (const p of s.pipes) {
          if (!p.passed && p.x + PIPE_W < 60) { p.passed = true; s.score++; setScore(s.score) }
          const inX = 60 + BIRD_R > p.x && 60 - BIRD_R < p.x + PIPE_W
          if (inX && (s.y - BIRD_R < p.gapY - GAP / 2 || s.y + BIRD_R > p.gapY + GAP / 2)) over()
        }
        if (s.y + BIRD_R >= H - GROUND || s.y - BIRD_R <= 0) over()
      } else if (s.phase === 'ready') {
        s.t += dt
        s.y = H * 0.42 + Math.sin(s.t / 12) * 8
      }
      draw(ctx, s, s.t)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); if (g.current.phase === 'over') reset(); flap() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onTap = () => { if (phase === 'over') { reset(); return } flap() }

  return (
    <div ref={box} style={css('position:relative;width:100%;height:100%;min-height:0;display:flex;align-items:center;justify-content:center;background:#ded895;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none')}>
      <div style={{ position: 'relative', width: W * scale, height: H * scale, flex: 'none' }} onPointerDown={onTap}>
        <canvas ref={canvas} aria-label="플래피 버드 게임 화면" style={{ width: W * scale, height: H * scale, display: 'block' }} />
        <div style={css(`position:absolute;left:0;right:0;top:${28 * scale}px;text-align:center;color:#fff;font-family:"Arial Black",Arial,sans-serif;font-size:${13 * scale}px;text-shadow:0 2px 0 #3d2b1f;pointer-events:none`)}>Highest Score: {best}</div>
        {phase !== 'over' && (
          <div style={css(`position:absolute;left:0;right:0;top:${70 * scale}px;text-align:center;color:#fff;font-family:"Arial Black",Arial,sans-serif;font-size:${50 * scale}px;line-height:1;text-shadow:0 4px 0 #3d2b1f,0 0 0 #3d2b1f;pointer-events:none`)}>{score}</div>
        )}
        {phase === 'over' && (
          <div style={css(`position:absolute;left:50%;top:${200 * scale}px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:${14 * scale}px;animation:fade 220ms ease both`)}>
            <div style={css(`width:${200 * scale}px;padding:${14 * scale}px 0;border-radius:${10 * scale}px;background:#ded895;border:${3 * scale}px solid #533a1f;text-align:center;font-family:"Arial Black",Arial,sans-serif;color:#533a1f;font-size:${15 * scale}px`)}>
              GAME OVER<br /><span style={css(`font-size:${28 * scale}px`)}>{score}</span><br /><span style={css(`font-size:${11 * scale}px`)}>BEST {best}</span>
            </div>
            <button onClick={e => { e.stopPropagation(); reset() }} style={css(`padding:${10 * scale}px ${26 * scale}px;border-radius:${8 * scale}px;background:#f7a22c;border:${3 * scale}px solid #533a1f;color:#fff;font-family:"Arial Black",Arial,sans-serif;font-size:${16 * scale}px;box-shadow:0 ${4 * scale}px 0 #533a1f`)}>RESTART</button>
          </div>
        )}
        {phase === 'ready' && (
          <div style={css(`position:absolute;left:0;right:0;top:${330 * scale}px;text-align:center;color:#fff;font-family:"Arial Black",Arial,sans-serif;font-size:${13 * scale}px;text-shadow:0 2px 0 #3d2b1f;pointer-events:none`)}>TAP TO FLY</div>
        )}
      </div>
    </div>
  )
}

function draw(ctx: CanvasRenderingContext2D, s: { y: number; vy: number; pipes: Pipe[] }, t: number) {
  // sky
  ctx.fillStyle = '#4ec0ca'
  ctx.fillRect(0, 0, W, H)
  // clouds drift slowly
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < 4; i++) {
    const x = ((i * 110 - (t * 0.25) % 440) + 440) % 440 - 60
    ctx.beginPath(); ctx.ellipse(x, H - GROUND - 110 + (i % 2) * 18, 46, 18, 0, 0, Math.PI * 2); ctx.fill()
  }
  // pipes
  for (const p of s.pipes) {
    const top = p.gapY - GAP / 2, bottom = p.gapY + GAP / 2
    pipe(ctx, p.x, 0, PIPE_W, top, false)
    pipe(ctx, p.x, bottom, PIPE_W, H - GROUND - bottom, true)
  }
  // ground: grass strip with diagonal stripes, then the dirt
  ctx.fillStyle = '#ded895'
  ctx.fillRect(0, H - GROUND + 26, W, GROUND - 26)
  ctx.fillStyle = '#73bf2e'
  ctx.fillRect(0, H - GROUND, W, 26)
  ctx.fillStyle = '#5aa02a'
  for (let x = -((t * SPEED) % 24); x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, H - GROUND); ctx.lineTo(x + 12, H - GROUND); ctx.lineTo(x + 2, H - GROUND + 26); ctx.lineTo(x - 10, H - GROUND + 26); ctx.fill() }
  ctx.fillStyle = '#533a1f'
  ctx.fillRect(0, H - GROUND, W, 3)
  // bird
  const angle = Math.max(-0.5, Math.min(1.2, s.vy * 0.07))
  ctx.save()
  ctx.translate(60, s.y)
  ctx.rotate(angle)
  ctx.fillStyle = '#533a1f'
  ctx.beginPath(); ctx.ellipse(0, 0, BIRD_R + 2, BIRD_R, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#f7d130'
  ctx.beginPath(); ctx.ellipse(0, 0, BIRD_R, BIRD_R - 1, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.ellipse(4, -4, 6, 6, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#533a1f'
  ctx.beginPath(); ctx.arc(6, -4, 2.4, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#e04a2f'
  ctx.fillRect(4, 3, 12, 4)
  ctx.fillStyle = '#f7a22c'
  ctx.beginPath(); ctx.moveTo(BIRD_R - 2, -2); ctx.lineTo(BIRD_R + 6, 2); ctx.lineTo(BIRD_R - 2, 5); ctx.fill()
  ctx.restore()
}

function pipe(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bottom: boolean) {
  if (h <= 0) return
  ctx.fillStyle = '#73bf2e'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#9ce05e'
  ctx.fillRect(x + 4, y, 6, h)
  ctx.fillStyle = '#533a1f'
  ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h)
  // the cap
  const capH = 24
  const cy = bottom ? y : y + h - capH
  ctx.fillStyle = '#73bf2e'
  ctx.fillRect(x - 4, cy, w + 8, capH)
  ctx.fillStyle = '#9ce05e'
  ctx.fillRect(x - 4, cy, 6, capH)
  ctx.fillStyle = '#533a1f'
  ctx.fillRect(x - 4, cy, w + 8, 3); ctx.fillRect(x - 4, cy + capH - 3, w + 8, 3); ctx.fillRect(x - 4, cy, 2, capH); ctx.fillRect(x + w + 2, cy, 2, capH)
}
