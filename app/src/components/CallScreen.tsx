import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { css, sx } from '../css'
import type { CallPhase } from '../backend/calls'
import { talkLabel } from '../backend/calls'

// 음성 통화 screen: incoming (거절 / 받기) and the call itself (음소거 / 끊기).

let ac: AudioContext | null = null
/** Ring tones made with Web Audio: 'in' = incoming ring, 'back' = the caller's ringback. */
function useTone(kind: 'in' | 'back' | null) {
  useEffect(() => {
    if (!kind) return
    let stopped = false
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ac = ac || new Ctx()
      if (ac.state === 'suspended') ac.resume().catch(() => {})
    } catch { return }
    const ctx = ac!
    const beep = (t: number, f: number, len: number, vol: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
      g.gain.setValueAtTime(vol, t + len - 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, t + len)
      o.connect(g).connect(ctx.destination)
      o.start(t); o.stop(t + len + 0.02)
    }
    const once = () => {
      if (stopped) return
      const t = ctx.currentTime + 0.05
      if (kind === 'in') { [0, 0.18, 0.36, 0.54].forEach((d, i) => beep(t + d, i % 2 ? 1046 : 784, 0.16, 0.18)); beep(t + 1.0, 784, 0.16, 0.18); beep(t + 1.18, 1046, 0.16, 0.18) }
      else beep(t, 425, 1.0, 0.06)
    }
    once()
    const id = setInterval(once, kind === 'in' ? 2400 : 3000)
    const vib = kind === 'in' && 'vibrate' in navigator ? setInterval(() => navigator.vibrate?.([300, 200, 300]), 2400) : undefined
    return () => { stopped = true; clearInterval(id); clearInterval(vib); navigator.vibrate?.(0) }
  }, [kind])
}

type Props = {
  name: string
  photoCss: string
  phase: CallPhase | 'incoming'
  liveAt: number
  muted: boolean
  /** 영상 통화 */
  video?: boolean
  local?: MediaStream | null
  remote?: MediaStream | null
  camOn?: boolean
  onCam?: () => void
  onMute: () => void
  onHangup: () => void
  onAccept: () => void
  onDecline: () => void
}

/** A video element that always shows the given stream (mirrored when it's my own camera). */
function Video({ stream, mirror = false, style }: { stream: MediaStream; mirror?: boolean; style: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; ref.current.play().catch(() => {}) } }, [stream])
  return <video ref={ref} autoPlay playsInline muted={mirror} style={sx(style, { transform: mirror ? 'scaleX(-1)' : undefined })} />
}

const round = (bg: string) => `width:68px;height:68px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:${bg};color:#fff;transition:transform 150ms,background 200ms`

export function CallScreen({ name, photoCss, phase, liveAt, muted, video = false, local, remote, camOn = true, onCam, onMute, onHangup, onAccept, onDecline }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (phase !== 'live') return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [phase])
  useTone(phase === 'incoming' ? 'in' : phase === 'calling' ? 'back' : null)
  const status = phase === 'incoming' ? '음성 통화가 왔어요' : phase === 'calling' ? '전화 거는 중…' : phase === 'connecting' ? '연결하는 중…' : phase === 'live' ? talkLabel(now - liveAt) : '통화가 끝났어요'
  const label = (t: string) => <span style={css('font-size:13px;color:rgba(255,255,255,0.8);margin-top:8px')}>{t}</span>
  const phone = (rot: number) => <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" style={{ transform: `rotate(${rot}deg)` }}><path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" /></svg>
  const showVideo = video && phase !== 'incoming' && (!!remote || !!local)
  return createPortal(
    <div role="dialog" aria-label={`${name} ${status}`} style={css('position:fixed;inset:0;z-index:600;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:calc(72px + env(safe-area-inset-top)) 24px calc(56px + env(safe-area-inset-bottom));background:linear-gradient(180deg,#1b2333 0%,#0e1320 100%);color:#fff;animation:fade 240ms ease both;overflow:hidden')}>
      {showVideo && remote && <Video stream={remote} style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000" />}
      {showVideo && local && camOn && <Video stream={local} mirror style="position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;width:104px;height:140px;border-radius:14px;object-fit:cover;background:#000;box-shadow:0 0 0 2px rgba(255,255,255,0.3)" />}
      {showVideo && <span style={css('position:absolute;top:calc(20px + env(safe-area-inset-top));left:20px;font-size:14px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.6)')}>{status}</span>}
      <div style={css('position:relative;display:flex;flex-direction:column;align-items:center;gap:14px' + (showVideo ? ';opacity:0;pointer-events:none' : ''))}>
        <span style={css('position:relative;width:112px;height:112px')}>
          {(phase === 'incoming' || phase === 'calling') && <span aria-hidden="true" className="call-pulse" style={css('position:absolute;inset:-14px;border-radius:9999px;border:2px solid rgba(255,255,255,0.25)')} />}
          <span style={sx('position:absolute;inset:0;border-radius:9999px;background:#3a4558 center/cover no-repeat', { backgroundImage: photoCss })} />
        </span>
        <span style={css('font-size:28px;line-height:36px;font-weight:700')}>{name}</span>
        <span style={css('font-size:17px;color:rgba(255,255,255,0.75);font-variant-numeric:tabular-nums')}>{status}</span>
      </div>
      {phase === 'incoming' ? (
        <div style={css('position:relative;z-index:1;width:100%;max-width:320px;display:flex;justify-content:space-between')}>
          <span style={css('display:flex;flex-direction:column;align-items:center')}>
            <button className="pr-96" onClick={onDecline} aria-label="거절" style={css(round('#f04452'))}>{phone(135)}</button>{label('거절')}
          </span>
          <span style={css('display:flex;flex-direction:column;align-items:center')}>
            <button className="pr-96" onClick={onAccept} aria-label="받기" style={css(round('#0bb05a'))}>{phone(0)}</button>{label('받기')}
          </span>
        </div>
      ) : (
        <div style={css('position:relative;z-index:1;width:100%;max-width:320px;display:flex;justify-content:space-between')}>
          <span style={css('display:flex;flex-direction:column;align-items:center')}>
            <button className="pr-96" onClick={onMute} aria-pressed={muted} aria-label="음소거" style={css(round(muted ? '#ffffff' : 'rgba(255,255,255,0.16)') + (muted ? ';color:#191f28' : ''))}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />{muted && <path d="M4 4l16 16" />}</svg>
            </button>{label(muted ? '음소거 중' : '음소거')}
          </span>
          {video && onCam && (
            <span style={css('display:flex;flex-direction:column;align-items:center')}>
              <button className="pr-96" onClick={onCam} aria-pressed={!camOn} aria-label="카메라 끄기" style={css(round(camOn ? 'rgba(255,255,255,0.16)' : '#ffffff') + (camOn ? '' : ';color:#191f28'))}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m15.5 10.5 6-3.5v10l-6-3.5" />{!camOn && <path d="M3 3l18 18" />}</svg>
              </button>{label(camOn ? '카메라 끄기' : '카메라 켜기')}
            </span>
          )}
          <span style={css('display:flex;flex-direction:column;align-items:center')}>
            <button className="pr-96" onClick={onHangup} aria-label="끊기" style={css(round('#f04452'))}>{phone(135)}</button>{label('끊기')}
          </span>
        </div>
      )}
    </div>,
    document.getElementById('overlay-root') ?? document.body,
  )
}
