import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { css } from '../css'
import { isOpen, songArt } from '../backend/songs'
import { musicTime, nextMusic, playOriginal, prevMusic, seekMusic, stopMusic, toggleMusic, useMusic } from '../music'

// The round music picture that stays on every screen while a song is loaded: drag it anywhere, tap
// it and it opens (smoothly) into the song's title and the controls, tap outside to fold it back.

const SIZE = 58, CARD_H = 156, EDGE = 8, KEY = 'music-bubble'
const EASE = 'cubic-bezier(0.32,0.72,0,1)'

type Pos = { x: number; y: number }
const clampPos = (p: Pos, w: number, h: number): Pos => ({
  x: Math.min(Math.max(EDGE, p.x), Math.max(EDGE, window.innerWidth - w - EDGE)),
  y: Math.min(Math.max(EDGE + 20, p.y), Math.max(EDGE, window.innerHeight - h - EDGE)),
})
function loadPos(): Pos {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v.fx === 'number' && typeof v.fy === 'number') return clampPos({ x: v.fx * window.innerWidth, y: v.fy * window.innerHeight }, SIZE, SIZE)
  } catch { /* no storage */ }
  // first time: at the right, above the tab bar
  return clampPos({ x: window.innerWidth - SIZE - 14, y: window.innerHeight - SIZE - 150 }, SIZE, SIZE)
}
const clock = (s: number) => { const t = Math.max(0, Math.round(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }

const Icon = ({ d, size = 24, fill = true }: { d: string; size?: number; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
const PLAY = 'M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8A.8.8 0 0 0 8 5.2z'
const PAUSE = 'M7 4.5h3.4v15H7zM13.6 4.5H17v15h-3.4z'
const PREV = 'M6 5h2.2v14H6zM19 5.4v13.2a.7.7 0 0 1-1.1.6L9.6 12.6a.7.7 0 0 1 0-1.2l8.3-6.6A.7.7 0 0 1 19 5.4z'
const NEXT = 'M15.8 5H18v14h-2.2zM5 5.4v13.2a.7.7 0 0 0 1.1.6l8.3-6.6a.7.7 0 0 0 0-1.2L6.1 4.8A.7.7 0 0 0 5 5.4z'

export function MusicBubble() {
  const m = useMusic()
  const song = m.queue[m.index]
  const [pos, setPos] = useState<Pos>(loadPos)
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState({ t: 0, d: 0 })
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x0: number; y0: number; px: number; py: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [vw, setVw] = useState(() => window.innerWidth)

  // the phone turned or was resized: keep it on screen
  useEffect(() => {
    const f = () => { setVw(window.innerWidth); setPos(p => clampPos(p, SIZE, SIZE)) }
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  // a new song closes nothing; the end of the music folds the card
  useEffect(() => { if (!song) setOpen(false) }, [song])
  // the bar of the song: read while it is open
  useEffect(() => {
    if (!open) return
    const tick = () => setTime(musicTime())
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [open, song?.id])
  // tap outside: fold it
  useEffect(() => {
    if (!open) return
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', out, true)
    return () => document.removeEventListener('pointerdown', out, true)
  }, [open])
  useLayoutEffect(() => { if (!open) setTime({ t: 0, d: 0 }) }, [open])

  if (!song) return null

  const W = Math.min(330, vw - EDGE * 2)
  // the open card keeps the circle's side: it grows to the left when the circle is on the right half
  const right = pos.x + SIZE / 2 > vw / 2
  const left = open ? Math.min(Math.max(EDGE, right ? pos.x + SIZE - W : pos.x), vw - W - EDGE) : pos.x
  const top = open ? Math.min(Math.max(EDGE + 20, pos.y), window.innerHeight - CARD_H - EDGE) : pos.y
  const playing = m.status === 'playing'

  const down = (e: React.PointerEvent) => {
    if (open) return
    drag.current = { x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    if (!d.moved) { d.moved = true; setDragging(true) }
    setPos(clampPos({ x: d.px + dx, y: d.py + dy }, SIZE, SIZE))
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return
    if (!d.moved) { setOpen(true); return }
    // it settles where it was let go; remembered as fractions of the screen
    setPos(p => {
      try { localStorage.setItem(KEY, JSON.stringify({ fx: p.x / window.innerWidth, fy: p.y / window.innerHeight })) } catch { /* no storage */ }
      return p
    })
  }
  const ratio = time.d > 0 ? Math.min(1, time.t / time.d) : 0

  return (
    <div ref={root} role="region" aria-label="음악 재생"
      style={{
        ...css(`position:fixed;z-index:260;overflow:hidden;background:#181818;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,0.35),0 0 0 1px rgba(255,255,255,0.08);touch-action:${open ? 'auto' : 'none'};font-family:'Toss Product Sans',Pretendard,'Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif;word-break:keep-all`),
        left, top, width: open ? W : SIZE, height: open ? CARD_H : SIZE, borderRadius: open ? 28 : SIZE / 2,
        transition: dragging ? 'none' : `left 360ms ${EASE},top 360ms ${EASE},width 360ms ${EASE},height 360ms ${EASE},border-radius 360ms ${EASE}`,
        cursor: open ? 'default' : dragging ? 'grabbing' : 'grab',
      }}>
      {/* the circle: the song's picture, turning while it plays */}
      <button aria-label="음악 열기" tabIndex={open ? -1 : 0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ ...css('position:absolute;left:0;top:0;padding:0;background:none;border:0;display:block;touch-action:none'), width: SIZE, height: SIZE, opacity: open ? 0 : 1, pointerEvents: open ? 'none' : 'auto', transition: `opacity 200ms ease` }}>
        <span className="music-disc" style={{ ...css('position:absolute;inset:0;border-radius:9999px;background-size:cover;background-position:center'), backgroundImage: `url(${songArt(song)})`, animationPlayState: playing ? 'running' : 'paused' }} />
        <span aria-hidden="true" style={css('position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:9999px;background:#181818;box-shadow:0 0 0 2px rgba(255,255,255,0.25)')} />
        <span aria-hidden="true" style={css('position:absolute;inset:0;border-radius:9999px;box-shadow:inset 0 0 0 2px rgba(255,255,255,0.3)')} />
      </button>

      {/* the open card */}
      <div style={{ ...css('position:absolute;left:0;top:0;right:0;bottom:0;padding:14px 14px 10px;display:flex;flex-direction:column;gap:8px'), opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: open ? `opacity 240ms ease 120ms` : 'opacity 120ms ease' }}>
        <div style={css('display:flex;align-items:center;gap:12px')}>
          <span style={{ ...css('flex:none;width:56px;height:56px;border-radius:12px;background-size:cover;background-position:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)'), backgroundImage: `url(${songArt(song)})` }} />
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
            <span style={css('font-size:15px;line-height:19px;font-weight:700;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden')}>{song.title}</span>
            <span style={css('font-size:13px;line-height:17px;color:#b3b3b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.ad ? '광고가 끝나면 시작돼요 · 소리 꺼짐' : isOpen(song) ? `${m.artist} · 광고 없음` : m.artist ? `${m.artist} 님이 추가` : 'Spotify'}</span>
            {m.adFree && <button className="pr-dim" onClick={playOriginal} aria-label="유튜브 원본으로 듣기" style={css('align-self:flex-start;max-width:100%;padding:0;background:none;color:#1ed760;font-size:12px;line-height:16px;font-weight:600;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>광고 없는 버전 · {m.adFree} ›원본</button>}
          </span>
          <button aria-label="음악 접기" onClick={() => setOpen(false)} style={css('flex:none;align-self:flex-start;width:32px;height:32px;margin:-6px 0 0 0;display:flex;align-items:center;justify-content:center;color:#b3b3b3;background:none')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <button aria-label="음악 끄기" onClick={stopMusic} style={css('flex:none;align-self:flex-start;width:32px;height:32px;margin:-6px -6px 0 0;display:flex;align-items:center;justify-content:center;color:#b3b3b3;background:none')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div style={css('display:flex;align-items:center;gap:8px;font-size:11px;color:#b3b3b3;font-variant-numeric:tabular-nums')}>
          <span style={css('width:32px;text-align:right')}>{clock(time.t)}</span>
          <input type="range" className="music-seek" aria-label="재생 위치" min={0} max={Math.max(1, Math.round(time.d))} value={Math.round(time.t)} onChange={e => { seekMusic(Number(e.target.value)); setTime(t => ({ ...t, t: Number(e.target.value) })) }}
            style={{ ...css('flex:1;min-width:0;height:4px;appearance:none;-webkit-appearance:none;border-radius:2px;outline:none;margin:0'), background: `linear-gradient(90deg,#1ed760 ${ratio * 100}%,#535353 ${ratio * 100}%)` }} />
          <span style={css('width:32px')}>{clock(time.d)}</span>
        </div>
        <div style={css('display:flex;align-items:center;justify-content:center;gap:26px')}>
          <button aria-label="이전 곡" className="pr-94" onClick={prevMusic} style={css('width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:#fff;background:none')}><Icon d={PREV} /></button>
          <button aria-label={playing ? '일시정지' : '재생'} className="pr-94" onClick={toggleMusic} style={css('width:48px;height:48px;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#000;background:#fff')}>
            {m.status === 'loading'
              ? <span aria-label="불러오는 중" style={css('width:20px;height:20px;border-radius:9999px;border:2.5px solid #bbb;border-top-color:#000;animation:avSpin 0.8s linear infinite')} />
              : <Icon d={playing ? PAUSE : PLAY} size={26} />}
          </button>
          <button aria-label="다음 곡" className="pr-94" onClick={nextMusic} style={css('width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:#fff;background:none')}><Icon d={NEXT} /></button>
        </div>
      </div>
    </div>
  )
}
