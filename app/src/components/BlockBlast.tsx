import { useRef, useState } from 'react'
import { playSound } from '../sound'
import { css } from '../css'

// 블록 블라스트: drop the three pieces on an 8 × 8 board. A full row or column clears. Drag a piece
// (it lifts above your finger); it lands only where every cell is free. No space for the pieces left
// in the tray means the game is over. The best score stays on this device. Looks like the original:
// a blue board with glossy, bevelled blocks and a big score on top.

const N = 8
// the glossy palette of the original: [light, dark]
const COLORS: [string, string][] = [
  ['#ff6b6b', '#c4161c'], ['#ffd84a', '#c98a00'], ['#5fd3ff', '#0a7fbf'], ['#4f8bff', '#1a3fb0'],
  ['#ff9d3c', '#c25400'], ['#c77dff', '#6a2bb8'], ['#5be08a', '#14813f'],
]
const SHAPES: [number, number][][] = [
  [[0, 0]],
  [[0, 0], [0, 1]], [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 1], [1, 1], [2, 1], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 0]], [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 1], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
]
const LIFT = 84 // px above the finger, so the piece is seen while it is dragged

type Cell = number | null // the palette index of a placed block
type Board = Cell[][]
type Piece = { cells: [number, number][]; color: number; id: number }
type Drag = { i: number; x: number; y: number }

let nextId = 1
const emptyBoard = (): Board => Array.from({ length: N }, () => Array<Cell>(N).fill(null))
const randomPiece = (): Piece => ({ cells: SHAPES[Math.floor(Math.random() * SHAPES.length)], color: Math.floor(Math.random() * COLORS.length), id: nextId++ })
const freshTray = (): (Piece | null)[] => [randomPiece(), randomPiece(), randomPiece()]
const size = (p: Piece) => ({ h: Math.max(...p.cells.map(c => c[0])) + 1, w: Math.max(...p.cells.map(c => c[1])) + 1 })

function fits(b: Board, p: Piece, r0: number, c0: number) {
  return p.cells.every(([r, c]) => r0 + r >= 0 && r0 + r < N && c0 + c >= 0 && c0 + c < N && b[r0 + r][c0 + c] === null)
}
function anyFits(b: Board, tray: (Piece | null)[]) {
  return tray.some(p => p && Array.from({ length: N }).some((_, r) => Array.from({ length: N }).some((_, c) => fits(b, p, r, c))))
}
/** Places the piece, clears full rows and columns, and returns the new board with the points won. */
function place(b: Board, p: Piece, r0: number, c0: number) {
  const next = b.map(row => [...row])
  for (const [r, c] of p.cells) next[r0 + r][c0 + c] = p.color
  const rows = next.map((row, r) => (row.every(x => x !== null) ? r : -1)).filter(r => r >= 0)
  const cols = Array.from({ length: N }, (_, c) => (next.every(row => row[c] !== null) ? c : -1)).filter(c => c >= 0)
  for (const r of rows) for (let c = 0; c < N; c++) next[r][c] = null
  for (const c of cols) for (let r = 0; r < N; r++) next[r][c] = null
  const lines = rows.length + cols.length
  return { board: next, points: p.cells.length + (lines ? lines * 10 * lines : 0) }
}

const loadBest = () => { try { return Number(localStorage.getItem('block-best') ?? 0) || 0 } catch { return 0 } }
const saveBest = (n: number) => { try { localStorage.setItem('block-best', String(n)) } catch { /* private window */ } }

/** A glossy block: a gradient, a bright top edge and a dark bottom edge (the original's bevel). */
const blockStyle = (color: number, size: number | '100%') => {
  const [light, dark] = COLORS[color]
  const px = size === '100%' ? 40 : size
  return {
    position: 'absolute' as const, width: size, height: size, borderRadius: Math.max(4, px * 0.18),
    background: `linear-gradient(160deg, ${light} 0%, ${dark} 100%)`,
    boxShadow: `inset 0 ${Math.max(2, px * 0.08)}px 0 rgba(255,255,255,0.45), inset 0 -${Math.max(3, px * 0.1)}px 0 rgba(0,0,0,0.28), 0 2px 4px rgba(0,0,0,0.25)`,
  }
}

function Preview({ p, cell }: { p: Piece; cell: number }) {
  const { h, w } = size(p)
  return (
    <div style={{ position: 'relative', width: w * cell, height: h * cell }}>
      {p.cells.map(([r, c], k) => (
        <span key={k} style={{ ...blockStyle(p.color, cell - 3), left: c * cell, top: r * cell }} />
      ))}
    </div>
  )
}

export function BlockBlast() {
  const [board, setBoard] = useState<Board>(emptyBoard)
  const [tray, setTray] = useState<(Piece | null)[]>(freshTray)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(loadBest)
  const [over, setOver] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  /** The top-left cell where the dragged piece would land (its centre sits over the lifted point). */
  const target = (d: Drag, p: Piece) => {
    const rootEl = root.current, g = grid.current
    if (!rootEl || !g) return null
    const rr = rootEl.getBoundingClientRect(), gr = g.getBoundingClientRect()
    const s = rr.width / rootEl.offsetWidth || 1
    const cell = gr.width / s / N
    const fx = (d.x - gr.left) / s / cell, fy = (d.y - LIFT - gr.top) / s / cell
    const { h, w } = size(p)
    return { r: Math.round(fy - h / 2), c: Math.round(fx - w / 2) }
  }

  const startDrag = (e: React.PointerEvent, i: number) => {
    if (!tray[i] || over) return
    e.preventDefault()
    const d = { i, x: e.clientX, y: e.clientY }
    dragRef.current = d
    setDrag(d)
    playSound('pick')
    const move = (ev: PointerEvent) => {
      const cur = { ...dragRef.current!, x: ev.clientX, y: ev.clientY }
      dragRef.current = cur
      setDrag(cur)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const cur = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (cur) drop(cur)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const drop = (d: Drag) => {
    const p = tray[d.i]
    if (!p) return
    const t = target(d, p)
    if (!t || !fits(board, p, t.r, t.c)) return
    const res = place(board, p, t.r, t.c)
    // a clear adds more than the piece's own cells (see place)
    playSound(res.points > p.cells.length ? 'clear' : 'place')
    const nextTray = tray.map((x, k) => (k === d.i ? null : x))
    const refilled = nextTray.every(x => x === null) ? freshTray() : nextTray
    const total = score + res.points
    setBoard(res.board)
    setTray(refilled)
    setScore(total)
    if (total > best) { setBest(total); saveBest(total) }
    if (!anyFits(res.board, refilled)) { setOver(true); playSound('over') }
  }

  const restart = () => { setBoard(emptyBoard()); setTray(freshTray()); setScore(0); setOver(false) }

  // the ghost: where the dragged piece would land right now
  let ghost: { r: number; c: number; p: Piece; ok: boolean } | null = null
  if (drag && tray[drag.i]) {
    const p = tray[drag.i]!
    const t = target(drag, p)
    if (t) ghost = { r: t.r, c: t.c, p, ok: fits(board, p, t.r, t.c) }
  }
  const ghostOn = (r: number, c: number) => !!ghost && ghost.ok && ghost.p.cells.some(([pr, pc]) => ghost!.r + pr === r && ghost!.c + pc === c)

  // the lifted piece, in the game's own coordinates (the phone may be scaled)
  let lifted: { left: number; top: number; cell: number; p: Piece } | null = null
  if (drag && tray[drag.i] && root.current && grid.current) {
    const rr = root.current.getBoundingClientRect(), gr = grid.current.getBoundingClientRect()
    const s = rr.width / root.current.offsetWidth || 1
    const cell = gr.width / s / N
    const p = tray[drag.i]!
    const { h, w } = size(p)
    lifted = { left: (drag.x - rr.left) / s - (w * cell) / 2, top: (drag.y - LIFT - rr.top) / s - (h * cell) / 2, cell, p }
  }

  return (
    <div ref={root} style={css('position:relative;min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;background:linear-gradient(180deg,#4a6fc4 0%,#2f4f9f 55%,#2a4790 100%);color:#fff;padding:24px 14px 36px;touch-action:none;user-select:none;-webkit-user-select:none;font-family:-apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif')}>
      {/* the best score with a crown, and the score in big figures in the middle */}
      <div style={css('width:100%;max-width:360px;display:flex;align-items:center;justify-content:space-between;height:40px')}>
        <span style={css('display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:#ffb84a;text-shadow:0 1px 0 rgba(0,0,0,0.3)')}>
          <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true"><path d="M2 6l5 5 6-9 6 9 5-5-2 12H4z" fill="#ffb84a" stroke="#7a3b00" strokeWidth="1.2" strokeLinejoin="round" /></svg>
          {best.toLocaleString()}
        </span>
      </div>
      <div style={css('margin-top:4px;font-size:72px;line-height:78px;font-weight:800;letter-spacing:-1px;text-shadow:0 4px 0 rgba(20,30,70,0.45);font-variant-numeric:tabular-nums')}>{score.toLocaleString()}</div>

      <div ref={grid} style={css('margin-top:18px;width:100%;max-width:360px;aspect-ratio:1;position:relative;display:grid;grid-template-columns:repeat(8,1fr);gap:4px;padding:8px;box-sizing:border-box;border-radius:18px;background:#1d3a80;box-shadow:inset 0 3px 8px rgba(0,0,0,0.45),0 0 0 3px #3e62b8')}>
        {board.map((row, r) => row.map((cell, c) => {
          const g = ghostOn(r, c)
          const color = cell ?? (g && ghost ? ghost.p.color : null)
          return (
            <span key={`${r}-${c}`} style={{ position: 'relative', borderRadius: 6, background: '#2a4a94', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.35)' }}>
              {color !== null && (
                <span style={{ ...blockStyle(color, '100%'), top: 0, left: 0, opacity: cell === null ? 0.45 : 1 }} />
              )}
            </span>
          )
        }))}
      </div>

      <div style={css('margin-top:34px;width:100%;max-width:360px;display:grid;grid-template-columns:repeat(3,1fr);align-items:center;justify-items:center;min-height:120px')}>
        {tray.map((p, i) => (
          <div key={i} onPointerDown={e => startDrag(e, i)} style={css(`height:120px;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:grab;opacity:${p && !(drag && drag.i === i) ? 1 : 0}`)}>
            {p && <Preview p={p} cell={26} />}
          </div>
        ))}
      </div>

      {lifted && (
        <div style={{ position: 'absolute', left: lifted.left, top: lifted.top, pointerEvents: 'none', zIndex: 10, filter: 'drop-shadow(0 12px 14px rgba(0,0,0,0.4))' }}>
          {lifted.p.cells.map(([r, c], k) => (
            <span key={k} style={{ ...blockStyle(lifted!.p.color, lifted!.cell - 3), left: c * lifted!.cell, top: r * lifted!.cell }} />
          ))}
        </div>
      )}

      {over && (
        <div style={css('position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(10,20,50,0.6);animation:fade 240ms ease both')}>
          <div style={css('width:260px;padding:28px 24px;border-radius:24px;background:#2f4f9f;box-shadow:0 0 0 2px #5a7fd0,0 12px 30px rgba(0,0,0,0.4);display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center')}>
            <span style={css('font-size:22px;font-weight:800')}>게임 끝</span>
            <span style={css('font-size:17px;color:rgba(255,255,255,0.85)')}>점수 {score.toLocaleString()}{score >= best && score > 0 ? ' · 최고 점수!' : ''}</span>
            <button className="pr-96" onClick={restart} style={css('margin-top:10px;height:48px;width:100%;border-radius:14px;background:#ffb84a;color:#4a2a00;font-size:17px;font-weight:800;box-shadow:0 4px 0 #b97a1f')}>다시 하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
