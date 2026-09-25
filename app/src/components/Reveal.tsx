import { useCallback, useEffect, useRef, useState } from 'react'
import { css, sx } from '../css'
import type { Person } from '../model'
import { boom, roll } from '../sfx'
import { Avatar } from './Avatar'
import { DRUM_SVG } from './drumArt'
import { CloseIcon } from './icons'

/** [ms, step, boom volume] — one 4.6s drum roll, then 3rd, 2nd, 1st, then done. */
const TIMELINE: [number, number, number][] = [[4600, 1, 0.6], [6600, 2, 0.75], [8800, 3, 1], [10000, 4, 0]]
const SYLLABLES = '두구두구두구두구'.split('')
/** [index into top list, rank, podium height, gradient, fg, glow, avatar size, step that reveals it] */
const PODIUM: [number, number, number, string, string, string, number, number][] = [
  [1, 2, 96, 'linear-gradient(180deg,#f4f6f8,#aab3bc)', '#333d4b', 'rgba(200,210,220,0.45)', 60, 2],
  [0, 1, 132, 'linear-gradient(180deg,#ffe38a,#e0a100)', '#5c3d00', 'rgba(255,195,66,0.6)', 76, 3],
  [2, 3, 72, 'linear-gradient(180deg,#f0bb8f,#b06a3a)', '#4a2a12', 'rgba(224,162,118,0.45)', 56, 1],
]

type Props = { top: Person[]; seasonName: string; sound: boolean; onToggleSound: () => void; onClose: () => void }

/** Season TOP 3 reveal: screen darkens, drum zooms in and shakes harder, then 3rd → 2nd → 1st. */
export function Reveal({ top, seasonName, sound, onToggleSound, onClose }: Props) {
  const [run, setRun] = useState(0)
  const [step, setStep] = useState(0)
  const [flash, setFlash] = useState(0)
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => {
    setStep(0)
    if (soundRef.current) roll(4600)
    const timers = TIMELINE.map(([t, st, v]) => setTimeout(() => {
      setStep(st)
      if (v) {
        setFlash(f => f + 1)
        if (soundRef.current) boom(v)
      }
    }, t))
    return () => timers.forEach(clearTimeout)
  }, [run])

  const replay = useCallback(() => setRun(r => r + 1), [])
  const title = ['이번 시즌 TOP 3는…', `3위는 ${top[2].name}님이에요`, `2위는 ${top[1].name}님이에요`, `1위는 ${top[0].name}님이에요`, `1위는 ${top[0].name}님이에요`][step]
  const done = step >= 4

  return (
    <div style={css('position:fixed;inset:0;z-index:400;display:flex;justify-content:center;background:#07080c;animation:fade 300ms ease both')}>
      <div style={css('position:relative;width:100%;max-width:430px;height:100%;display:flex;flex-direction:column;overflow-x:hidden;overflow-y:auto;color:#ffffff;animation:rvDark 1600ms cubic-bezier(.5,0,.2,1) both')}>
        <div style={css('position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 42% at 50% 44%,rgba(255,214,140,0.22),rgba(255,214,140,0) 70%),radial-gradient(120% 80% at 50% 50%,rgba(0,0,0,0) 40%,rgba(0,0,0,0.75) 100%);animation:rvSpot 2400ms ease-in 600ms both')} />
        {/* Alternating keyframe names restart the flash animation on every reveal. */}
        <div style={sx('position:absolute;inset:0;pointer-events:none;z-index:5;background:#ffffff;opacity:0', { animation: `${flash ? (flash % 2 ? 'rvFlashA' : 'rvFlashB') : 'none'} 700ms ease-out both` })} />
        <div style={css('position:relative;z-index:2;height:56px;padding:0 8px;display:flex;align-items:center;justify-content:space-between')}>
          <button className="pr-light" onClick={onToggleSound} aria-label="소리" style={css('height:36px;padding:0 12px;border-radius:10px;font-size:13px;font-weight:600;color:#b0b8c1;display:flex;align-items:center;gap:6px')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              {sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6M21 9l-5 6" />}
            </svg>
            {sound ? '소리 켜짐' : '소리 꺼짐'}
          </button>
          <button className="pr-light" onClick={onClose} aria-label="닫기" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#ffffff')}><CloseIcon size={22} stroke="currentColor" width={2.4} /></button>
        </div>
        <div style={css('position:relative;z-index:2;padding:8px 24px 0;display:flex;flex-direction:column;gap:4px;animation:rvFade 800ms ease 700ms both')}>
          <span style={css('font-size:13px;line-height:19.5px;font-weight:700;color:#64a8ff')}>시즌 {seasonName} 결과</span>
          <span style={css('font-size:26px;line-height:35px;font-weight:700;color:#ffffff;min-height:70px')}>{title}</span>
        </div>
        <div style={css('position:relative;z-index:2;flex:1 0 auto;min-height:220px;padding:12px 0 20px;display:flex;align-items:center;justify-content:center')}>
          {step === 0 && (
            <div style={css('display:flex;flex-direction:column;align-items:center;gap:22px;will-change:transform;animation:rvZoom 4600ms cubic-bezier(.55,0,.85,.4) both')}>
              <div style={css('will-change:transform;animation:rvShake 4600ms linear both')}>
                <svg width="200" height="160" viewBox="0 0 240 190" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: DRUM_SVG }} />
              </div>
              <div style={css('display:flex;gap:2px;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;text-shadow:0 0 18px rgba(255,200,120,0.55)')}>
                {SYLLABLES.map((t, i) => <span key={i} style={{ display: 'inline-block', animation: 'syl 380ms ease-in-out infinite', animationDelay: (i * 0.05).toFixed(2) + 's' }}>{t}</span>)}
              </div>
            </div>
          )}
          {done && <span style={css('padding:0 24px;text-align:center;font-size:15px;line-height:22.5px;color:#b0b8c1;animation:rvFade 600ms ease both')}>응원해주셔서 고마워요. 다음 시즌도 기대해주세요</span>}
        </div>
        <div style={sx('position:relative;z-index:2;flex:none;padding:24px 20px 0;display:flex;align-items:flex-end;gap:8px;transition:opacity 600ms', { opacity: step === 0 ? 0.35 : 1 })}>
          {PODIUM.map(([idx, rk, hh, bg, fg, glow, av, need]) => {
            const d = top[idx], shown = step >= need
            return (
              <div key={rk} style={css('flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:10px')}>
                <div style={css('position:relative;display:flex;flex-direction:column;align-items:center;gap:6px')}>
                  {shown ? (
                    <>
                      <span style={sx('position:absolute;top:-24px;left:50%;margin-left:-70px;width:140px;height:140px;border-radius:9999px;animation:glowPulse 1.8s ease-in-out infinite', { background: `radial-gradient(circle,${glow},rgba(0,0,0,0) 65%)` })} />
                      <span style={sx('position:relative;animation:popIn 620ms cubic-bezier(0.34,1.4,0.64,1) both', { width: av, height: av })}><Avatar frame={d.frame} photo={d.photoCss} size={av} /></span>
                      <span style={css('position:relative;display:flex;flex-direction:column;align-items:center;animation:popIn 620ms cubic-bezier(0.34,1.4,0.64,1) 140ms both')}>
                        <span style={css('font-size:16px;line-height:22px;font-weight:700;color:#ffffff;white-space:nowrap')}>{d.name}</span>
                        <span style={css('font-size:13px;line-height:18px;font-weight:600;color:#b0b8c1;font-variant-numeric:tabular-nums')}>{d.scoreLabel}점</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={sx('border-radius:9999px;background:#1c1f26;color:#4e5968;font-size:26px;font-weight:800;display:flex;align-items:center;justify-content:center', { width: av, height: av })}>?</span>
                      <span style={{ height: 40 }} />
                    </>
                  )}
                </div>
                <div style={sx('width:100%;border-radius:14px 14px 0 0;display:flex;justify-content:center;padding-top:10px;font-size:22px;font-weight:800;transition:background 500ms,box-shadow 500ms', { height: hh, background: shown ? bg : '#1c1f26', color: shown ? fg : '#4e5968', boxShadow: shown ? '0 -8px 40px -6px ' + glow : 'none' })}>{rk}</div>
              </div>
            )
          })}
        </div>
        {done ? (
          <div style={css('position:relative;z-index:2;flex:none;padding:16px 20px calc(16px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:8px;animation:rvFade 500ms ease both')}>
            <button className="pr-96" onClick={replay} style={css('height:56px;border-radius:16px;background:#2c313a;color:#ffffff;font-size:17px;font-weight:600')}>다시 보기</button>
            <button className="pr-96" onClick={onClose} style={css('height:56px;border-radius:16px;background:#3182f6;color:#ffffff;font-size:17px;font-weight:600')}>확인</button>
          </div>
        ) : (
          <div style={css('flex:none;height:calc(88px + env(safe-area-inset-bottom))')} />
        )}
      </div>
    </div>
  )
}
