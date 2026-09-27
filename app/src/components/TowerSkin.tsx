import { css } from '../css'
import type { SkinGeom } from '../data'
import { GEM } from './auraArt'
import { MX_FONT, MX_STRIPS } from './matrixArt'

const segment = 'display:block;width:100%;flex:none;background-repeat:no-repeat;background-size:100% 100%'

/** Photo-real landmark drawn inside a bar: fixed cap and base, stretching middle. Flipped for negative bars. */
export function TowerSkin({ g, animateSize }: { g: SkinGeom; animateSize?: boolean }) {
  if (g.special === 'aura') return <AuraBar flip={g.tf !== 'none'} />
  if (g.special === 'matrix') return <MatrixBar flip={g.tf !== 'none'} />
  return (
    <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: g.tf }}>
      <span
        style={{
          ...css('position:absolute;left:50%;bottom:0;display:flex;flex-direction:column;transform-origin:50% 100%;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,0.18))'),
          ...(animateSize ? css('transition:height 550ms cubic-bezier(0.22,1,0.36,1),transform 550ms cubic-bezier(0.22,1,0.36,1)') : null),
          marginLeft: g.ml, width: g.w, height: g.H, transform: `scale(${g.k})`,
        }}
      >
        <span style={{ ...css(segment), height: g.capH, backgroundImage: g.capUrl }} />
        <span style={{ ...css('display:block;flex:1;min-height:0;background-repeat:no-repeat;background-position:center;background-size:100% 100%'), backgroundImage: g.mid }} />
        {g.hasBase && <span style={{ ...css(segment), height: g.baseH, backgroundImage: g.baseUrl }} />}
      </span>
    </span>
  )
}

const FLOW = 'linear-gradient(180deg,#ffe27a 0%,#ff4fd8 20%,#7b3cff 42%,#22e1ff 64%,#7b3cff 82%,#ffe27a 100%)'
const SPARKS: [string, string, string, number][] = [['22%', '8%', '#ffe27a', 0], ['70%', '30%', '#22e1ff', 0.5], ['40%', '55%', '#ff4fd8', 1.0], ['60%', '4%', '#ffffff', 1.4]]

/** 아우라 막대: an energy pillar flowing upward, two tinted afterimages, aura spreading out, sparks rising, a gem on top. */
function AuraBar({ flip }: { flip: boolean }) {
  return (
    <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: flip ? 'scaleY(-1)' : 'none' }}>
      {/* aura around the bar */}
      <span className="aura-glow" style={css('position:absolute;left:-70%;right:-70%;top:-10px;bottom:-4px;border-radius:40%;background:radial-gradient(closest-side,rgba(123,60,255,0.5),rgba(34,225,255,0.22) 60%,transparent);filter:blur(4px);animation:auraPulse 1.8s ease-in-out infinite')} />
      <span className="aura-ringbar" style={css('position:absolute;inset:0;border-radius:6px;animation:auraRing 1.8s ease-out infinite')} />
      {/* afterimages (잔상) */}
      <span className="aura-ghost" style={css('position:absolute;inset:0;border-radius:6px;background:linear-gradient(180deg,rgba(34,225,255,0.95),rgba(34,225,255,0.35));animation:auraGhostL 1.1s ease-in-out infinite')} />
      <span className="aura-ghost" style={css('position:absolute;inset:0;border-radius:6px;background:linear-gradient(180deg,rgba(255,79,216,0.95),rgba(255,79,216,0.35));animation:auraGhostR 1.1s ease-in-out 0.15s infinite')} />
      {/* the pillar */}
      <span className="aura-flow" style={{ ...css('position:absolute;inset:0;border-radius:6px;background-size:100% 200%;box-shadow:0 0 8px rgba(123,60,255,0.85),0 0 16px rgba(34,225,255,0.5),inset 0 0 0 1px rgba(255,255,255,0.55);animation:auraFlow 1.5s linear infinite'), backgroundImage: FLOW }} />
      <span className="aura-core" style={css('position:absolute;top:4px;bottom:4px;left:36%;right:36%;border-radius:9999px;background:linear-gradient(180deg,#ffffff,rgba(255,255,255,0.25));filter:blur(1px);animation:auraPulse 1.3s ease-in-out infinite')} />
      {SPARKS.map(([left, top, c, delay]) => (
        <span key={left + top} className="aura-spark" style={{ ...css('position:absolute;width:3px;height:3px;margin-left:-1.5px;border-radius:50%;opacity:0'), left, top, background: c, boxShadow: `0 0 4px ${c}`, animation: `auraSpark 1.9s ease-out ${delay}s infinite` }} />
      ))}
      <svg viewBox="-12 -12 24 24" width="18" height="18" style={css('position:absolute;left:50%;top:-15px;margin-left:-9px;overflow:visible')}>
        <g className="aura-gem" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'auraGem 2s ease-in-out infinite' }} dangerouslySetInnerHTML={{ __html: GEM }} />
      </svg>
    </span>
  )
}

const RAIN: [string, number, number][] = [['14%', 1.35, 0], ['40%', 2.05, 0.7], ['66%', 1.6, 1.3], ['88%', 2.4, 0.4]]

/**
 * 매트릭스 막대: a black glass pillar with digital rain falling inside (always downward, even
 * on minus bars), a scan line, CRT lines, glitch ghosts of its edge, a blinking cursor on its tip
 * and stray glyphs dripping beside it.
 */
function MatrixBar({ flip }: { flip: boolean }) {
  const tip = flip ? 'bottom' : 'top'
  return (
    <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <span className="mx-glow" style={css('position:absolute;left:-60%;right:-60%;top:-12px;bottom:-6px;border-radius:40%;background:radial-gradient(closest-side,rgba(0,255,65,0.35),rgba(0,120,30,0.15) 60%,transparent);animation:mxBreath 2.4s ease-in-out infinite')} />
      <span className="mx-glitch" style={css('position:absolute;inset:0;border-radius:5px;box-shadow:inset 0 0 0 1.5px #ff2b6a;animation:mxJitter 2.9s steps(1) infinite')} />
      <span className="mx-glitch" style={css('position:absolute;inset:0;border-radius:5px;box-shadow:inset 0 0 0 1.5px #35f0ff;animation:mxJitter 2.9s steps(1) .06s infinite')} />
      <span style={css('position:absolute;inset:0;border-radius:5px;overflow:hidden;background:linear-gradient(180deg,#03260f 0%,#010f06 45%,#000 100%);box-shadow:inset 0 0 0 1px #00ff41,inset 0 0 10px rgba(0,255,65,0.35),0 0 8px rgba(0,255,65,0.6),0 0 18px rgba(0,255,65,0.25)')}>
        {RAIN.map(([left, dur, delay], i) => (
          <span key={left} className="mx-drop" style={{ ...css('position:absolute;width:1em;margin-left:-0.5em;display:flex;flex-direction:column;align-items:center;font-size:8px;line-height:9px;transform:scaleX(-1)'), left, fontFamily: MX_FONT, animation: `mxDrop ${dur}s linear ${-delay}s infinite` }}>
            {MX_STRIPS[i].map((c, j, all) => {
              const head = j === all.length - 1
              return <span key={j} style={{ color: head ? '#eafff0' : '#00ff41', opacity: head ? 1 : 0.1 + 0.75 * (j / (all.length - 1)) ** 1.6, textShadow: head ? '0 0 4px #00ff41,0 0 8px #00ff41' : '0 0 3px rgba(0,255,65,0.8)' }}>{c}</span>
            })}
          </span>
        ))}
        <span className="mx-scan" style={css('position:absolute;left:0;right:0;height:26px;background:linear-gradient(0deg,transparent,rgba(0,255,65,0.18) 70%,rgba(200,255,215,0.6) 96%,transparent);animation:mxScanUp 2.2s cubic-bezier(.45,0,.55,1) infinite')} />
        <span style={css('position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,0.3) 0 1px,transparent 1px 3px)')} />
      </span>
      <span className="mx-blink" style={{ ...css('position:absolute;left:50%;width:10px;margin-left:-5px;height:4px;background:#00ff41;box-shadow:0 0 6px #00ff41,0 0 12px #00ff41;animation:mxBlink 1s steps(1) infinite'), [tip]: -7 }} />
      {[['-7px', 2.6, 0.2], ['calc(100% + 1px)', 3.1, 1.4]].map(([left, dur, delay]) => (
        <span key={left as string} className="mx-drop" style={{ ...css('position:absolute;font-size:7px;line-height:8px;color:#00ff41;opacity:0.7;text-shadow:0 0 3px #00ff41;transform:scaleX(-1)'), left: left as string, fontFamily: MX_FONT, animation: `mxDrop ${dur}s linear ${-(delay as number)}s infinite` }}>{MX_STRIPS[3][Math.floor((delay as number) * 5)]}</span>
      ))}
    </span>
  )
}
