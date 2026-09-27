import { css } from '../css'
import type { SkinGeom } from '../data'
import { GEM } from './auraArt'

const segment = 'display:block;width:100%;flex:none;background-repeat:no-repeat;background-size:100% 100%'

/** Photo-real landmark drawn inside a bar: fixed cap and base, stretching middle. Flipped for negative bars. */
export function TowerSkin({ g, animateSize }: { g: SkinGeom; animateSize?: boolean }) {
  if (g.special === 'aura') return <AuraBar flip={g.tf !== 'none'} />
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
