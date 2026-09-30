import { css } from '../css'
import type { SkinGeom } from '../data'
import { GEM } from './auraArt'
import { MX_FONT, MX_STRIPS, cubeOrbit } from './matrixArt'
import { BAR_TIP_SVG, BLUE, INK, IVORY, SEAM_TILE, barCoinOrbit } from './koreaArt'
import { pauseOffscreen } from '../offscreen'
import { BAR_SPARKLE_SVG, BAR_TILE, ensureSilverArt } from './silverArt'

const segment = 'display:block;width:100%;flex:none;background-repeat:no-repeat;background-size:100% 100%'

/** Photo-real landmark drawn inside a bar: fixed cap and base, stretching middle. Flipped for negative bars. */
export function TowerSkin({ g, animateSize }: { g: SkinGeom; animateSize?: boolean }) {
  if (g.special === 'aura') return <AuraBar flip={g.tf !== 'none'} />
  if (g.special === 'matrix') return <MatrixBar flip={g.tf !== 'none'} h={g.H} />
  if (g.special === 'korea') return <KoreaBar flip={g.tf !== 'none'} h={g.H} />
  if (g.special === 'silver') return <SilverBar flip={g.tf !== 'none'} h={g.H} />
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
    <span ref={pauseOffscreen} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: flip ? 'scaleY(-1)' : 'none' }}>
      {/* aura around the bar */}
      <span className="aura-glow" style={css('position:absolute;left:-70%;right:-70%;top:-10px;bottom:-4px;border-radius:40%;background:radial-gradient(closest-side,rgba(123,60,255,0.5),rgba(34,225,255,0.22) 60%,transparent);filter:blur(4px);animation:auraPulse 1.8s ease-in-out infinite')} />
      <span className="aura-ringbar" style={css('position:absolute;inset:0;border-radius:6px;animation:auraRing 1.8s ease-out infinite')} />
      {/* afterimages (잔상) */}
      <span className="aura-ghost" style={css('position:absolute;inset:0;border-radius:6px;background:linear-gradient(180deg,rgba(34,225,255,0.95),rgba(34,225,255,0.35));animation:auraGhostL 1.1s ease-in-out infinite')} />
      <span className="aura-ghost" style={css('position:absolute;inset:0;border-radius:6px;background:linear-gradient(180deg,rgba(255,79,216,0.95),rgba(255,79,216,0.35));animation:auraGhostR 1.1s ease-in-out 0.15s infinite')} />
      {/* the pillar */}
      <span style={css('position:absolute;inset:0;border-radius:6px;overflow:hidden;box-shadow:0 0 8px rgba(123,60,255,0.85),0 0 16px rgba(34,225,255,0.5)')}>
        {/* the colours flow by moving a double-height strip (transform), not by repainting the background */}
        <span className="aura-flow" style={{ ...css('position:absolute;left:0;right:0;top:0;height:200%;animation:auraFlowT 1.5s linear infinite'), backgroundImage: FLOW + ',' + FLOW, backgroundSize: '100% 50%' }} />
        <span style={css('position:absolute;inset:0;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.55)')} />
      </span>
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

// Cubes circling the bar: a flat ellipse round the pillar that also drifts up and down it.
const BAR_CUBES = { size: '9px', inset: '0', tilt: -8, squash: 0.3, cubes: 1 }
const barOrbit = (front: boolean) => [
  { top: '12%', html: cubeOrbit({ ...BAR_CUBES, dur: 3.2, front }), drift: 'mxRise 6s ease-in-out infinite alternate' },
  { top: '60%', html: cubeOrbit({ ...BAR_CUBES, dur: 2.6, front }), drift: 'mxRise 7s ease-in-out -3s infinite alternate-reverse' },
  { top: '35%', html: cubeOrbit({ ...BAR_CUBES, dur: 3.8, front }), drift: 'mxRise 8.5s ease-in-out -5s infinite alternate' },
]
const ORBIT_BACK = barOrbit(false), ORBIT_FRONT = barOrbit(true)
const orbitLayer = (list: typeof ORBIT_BACK) => list.map(o => (
  <span key={o.top} className="mx-rise" style={{ position: 'absolute', left: '50%', width: 60, height: 60, marginLeft: -30, marginTop: -30, top: 0, animation: o.drift }} dangerouslySetInnerHTML={{ __html: o.html }} />
))

const RAIN: [string, number, number][] = [['14%', 1.35, 0], ['40%', 2.05, 0.7], ['66%', 1.6, 1.3], ['88%', 2.4, 0.4]]
/** Far layer: smaller, dimmer, slower columns behind the near ones (depth). */
const RAIN_FAR: [string, number, number][] = [['26%', 3.1, 0.3], ['54%', 2.7, 1.9], ['78%', 3.4, 1.1]]

/**
 * 매트릭스 막대: a black glass pillar with digital rain falling inside (always downward, even
 * on minus bars), a scan line, CRT lines, glitch ghosts of its edge, a blinking cursor on its tip
 * and stray glyphs dripping beside it.
 */
function MatrixBar({ flip, h }: { flip: boolean; h: number }) {
  const tip = flip ? 'bottom' : 'top'
  return (
    <span ref={pauseOffscreen} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ['--bh' as string]: `${h}px` }}>
      <span className="mx-glow" style={css('position:absolute;left:-60%;right:-60%;top:-12px;bottom:-6px;border-radius:40%;background:radial-gradient(closest-side,rgba(0,255,65,0.35),rgba(0,120,30,0.15) 60%,transparent);animation:mxBreath 2.4s ease-in-out infinite')} />
      {orbitLayer(ORBIT_BACK)}
      <span className="mx-glitch" style={css('position:absolute;inset:0;border-radius:5px;box-shadow:inset 0 0 0 1.5px #ff2b6a;animation:mxJitter 2.9s steps(1) infinite')} />
      <span className="mx-glitch" style={css('position:absolute;inset:0;border-radius:5px;box-shadow:inset 0 0 0 1.5px #35f0ff;animation:mxJitter 2.9s steps(1) .06s infinite')} />
      <span className="mx-shake" style={css('position:absolute;inset:0;border-radius:5px;overflow:hidden;background:linear-gradient(180deg,#03260f 0%,#010f06 45%,#000 100%);box-shadow:inset 0 0 0 1px #00ff41,inset 0 0 10px rgba(0,255,65,0.35),0 0 8px rgba(0,255,65,0.6),0 0 18px rgba(0,255,65,0.25);animation:mxShake 3.3s steps(1) infinite')}>
        {RAIN_FAR.map(([left, dur, delay], i) => (
          <span key={left} className="mx-drop" style={{ ...css('position:absolute;top:0;width:1em;margin-left:-0.5em;display:flex;flex-direction:column;align-items:center;font-size:6px;line-height:7px;opacity:0.45;will-change:transform'), left, fontFamily: MX_FONT, animation: `mxDrop ${dur}s linear ${-delay}s infinite` }}>
            {MX_STRIPS[(i + 2) % 4].map((c, j, all) => <span key={j} style={{ color: '#00ff41', opacity: 0.15 + 0.7 * (j / (all.length - 1)) ** 1.6 }}>{c}</span>)}
          </span>
        ))}
        {RAIN.map(([left, dur, delay], i) => (
          <span key={left} className="mx-drop" style={{ ...css('position:absolute;top:0;width:1em;margin-left:-0.5em;display:flex;flex-direction:column;align-items:center;font-size:8px;line-height:9px;will-change:transform'), left, fontFamily: MX_FONT, animation: `mxDrop ${dur}s linear ${-delay}s infinite` }}>
            {MX_STRIPS[i].map((c, j, all) => {
              const head = j === all.length - 1
              return <span key={j} style={{ color: head ? '#eafff0' : '#00ff41', opacity: head ? 1 : 0.1 + 0.75 * (j / (all.length - 1)) ** 1.6, textShadow: head ? '0 0 4px #00ff41,0 0 8px #00ff41' : '0 0 3px rgba(0,255,65,0.8)' }}>{c}</span>
            })}
          </span>
        ))}
        <span className="mx-scan" style={css('position:absolute;top:0;left:0;right:0;height:26px;background:linear-gradient(0deg,transparent,rgba(0,255,65,0.18) 70%,rgba(200,255,215,0.6) 96%,transparent);animation:mxScanUp 2.2s cubic-bezier(.45,0,.55,1) infinite')} />
        <span style={css('position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,0.3) 0 1px,transparent 1px 3px)')} />
      </span>
      <span className="mx-blink" style={{ ...css('position:absolute;left:50%;width:10px;margin-left:-5px;height:4px;background:#00ff41;box-shadow:0 0 6px #00ff41,0 0 12px #00ff41;animation:mxBlink 1s steps(1) infinite'), [tip]: -7 }} />
      {orbitLayer(ORBIT_FRONT)}
      {/* shockwave off the tip, and glyphs bursting out of it */}
      <span className="mx-wave" style={{ ...css('position:absolute;left:50%;width:30px;height:8px;margin-left:-15px;border-radius:50%;border:1.5px dashed #00ff41;animation:mxWave 2.2s ease-out infinite'), [tip]: -9 }} />
      {[['-6px', 0], ['2px', 0.6], ['-1px', 1.2]].map(([dx, delay]) => (
        <span key={delay as number} className="mx-burst" style={{ ...css('position:absolute;left:50%;font-size:7px;line-height:7px;color:#eafff0;text-shadow:0 0 4px #00ff41,0 0 8px #00ff41;opacity:0'), marginLeft: dx as string, [tip]: -12, fontFamily: MX_FONT, animation: `${flip ? 'mxBurstDown' : 'mxBurst'} 1.8s ease-out ${delay}s infinite` }}>{MX_STRIPS[1][(delay as number) * 5]}</span>
      ))}
      {[['-7px', 2.6, 0.2], ['calc(100% + 1px)', 3.1, 1.4]].map(([left, dur, delay]) => (
        <span key={left as string} className="mx-drop" style={{ ...css('position:absolute;top:0;font-size:7px;line-height:8px;color:#00ff41;opacity:0.7;text-shadow:0 0 3px #00ff41'), left: left as string, fontFamily: MX_FONT, animation: `mxDrop ${dur}s linear ${-(delay as number)}s infinite` }}>{MX_STRIPS[3][Math.floor((delay as number) * 5)]}</span>
      ))}
    </span>
  )
}

// 태극 coins circling the bar (like the 매트릭스 cubes), each drifting up and down it.
const KR_COINS = [
  { dur: 3.4, drift: 'mxRise 6.5s ease-in-out infinite alternate' },
  { dur: 2.8, drift: 'mxRise 7.5s ease-in-out -3s infinite alternate-reverse' },
  { dur: 4, drift: 'mxRise 9s ease-in-out -5s infinite alternate' },
]
const KR_COIN_BACK = KR_COINS.map(c => barCoinOrbit('back', c.dur)), KR_COIN_FRONT = KR_COINS.map(c => barCoinOrbit('front', c.dur))
const krCoins = (list: string[]) => list.map((html, i) => (
  <span key={i} className="kr-rise" style={{ position: 'absolute', left: '50%', width: 64, height: 40, marginLeft: -32, marginTop: -20, top: 0, animation: KR_COINS[i].drift }} dangerouslySetInnerHTML={{ __html: html }} />
))
const KR_SPARKS: [string, number, number, string][] = [['8%', 2.2, 0, '#ffd66b'], ['86%', 2.6, 0.8, '#ffffff'], ['30%', 2.4, 1.5, '#ffd66b'], ['66%', 2.9, 0.4, '#ffe9a8'], ['-18%', 3.1, 1.9, '#ffffff'], ['112%', 2.7, 1.1, '#ffd66b']]

/**
 * 대한민국 막대: the 태극's two colours flowing up the bar, red and blue meeting in its S,
 * ivory 한지 caps with ink lines at both ends, gold-rimmed 태극 coins orbiting it, gold sparks
 * rising, and a small 태극기 (the 태극 upright with light rippling out, the
 * four 괘 catching the light in turn) on its tip.
 */
function KoreaBar({ flip, h }: { flip: boolean; h: number }) {
  const tip = flip ? 'bottom' : 'top', end = flip ? 'top' : 'bottom'
  const cap = `position:absolute;left:-1px;right:-1px;background:${IVORY};box-shadow:inset 0 0 0 0.8px ${INK},0 1px 2px rgba(0,0,0,0.25);border-radius:2px`
  return (
    <span ref={pauseOffscreen} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ['--bh' as string]: `${h}px` }}>
      <span className="kr-glow" style={css(`position:absolute;left:-70%;right:-70%;top:-10px;bottom:-4px;border-radius:40%;background:linear-gradient(${flip ? 0 : 180}deg,rgba(205,46,58,0.6),rgba(255,214,107,0.35),rgba(0,71,160,0.6));filter:blur(8px);animation:auraPulse 2.2s ease-in-out infinite`)} />
      {krCoins(KR_COIN_BACK)}
      <span style={css(`position:absolute;inset:0;border-radius:3px;overflow:hidden;background:${BLUE};box-shadow:0 0 0 1px ${INK},0 2px 8px rgba(0,0,0,0.25)`)}>
        {/* the S seam, flowing up */}
        <span className="kr-spiral" style={{ ...css('position:absolute;left:0;right:0;top:0;bottom:-48px;will-change:transform;background-size:100% 48px;animation:krSpiral 2.4s linear infinite'), backgroundImage: SEAM_TILE }} />
        {/* roundness */}
        <span style={css('position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.3),transparent 28%,rgba(255,255,255,0.22) 46%,transparent 64%,rgba(0,0,0,0.32))')} />
        <span className="kr-sweep" style={css('position:absolute;top:0;left:0;right:0;height:34px;background:linear-gradient(0deg,transparent,rgba(255,255,255,0.28),transparent);animation:mxScanUp 3.2s ease-in-out infinite')} />
      </span>
      {/* 한지 caps */}
      <span style={{ ...css(cap + ';height:7px'), [tip]: -1 }}><span style={{ ...css(`position:absolute;left:2px;right:2px;height:0.8px;background:${INK};opacity:0.6`), [flip ? 'top' : 'bottom']: 2 }} /></span>
      <span style={{ ...css(cap + ';height:5px'), [end]: -1 }} />
      {krCoins(KR_COIN_FRONT)}
      {KR_SPARKS.map(([left, dur, delay, c]) => (
        <span key={left} className="aura-spark" style={{ ...css('position:absolute;width:3px;height:3px;margin-left:-1.5px;border-radius:50%;opacity:0'), left, [flip ? 'top' : 'bottom']: '10%', background: c, boxShadow: `0 0 4px ${c},0 0 8px ${c}`, animation: `${flip ? 'krSparkDown' : 'auraSpark'} ${dur}s ease-out ${delay}s infinite` }} />
      ))}
      <span style={{ ...css('position:absolute;left:50%;margin-left:-32px;width:64px;height:64px'), [tip]: -52 }} dangerouslySetInnerHTML={{ __html: BAR_TIP_SVG }} />
    </span>
  )
}

const SL_MOTES: [string, number, number, string][] = [['4%', 2.4, 0, '#ffffff'], ['90%', 2.9, 0.7, '#dcdcdc'], ['34%', 2.6, 1.4, '#ffffff'], ['68%', 3.1, 0.3, '#bdbdbd'], ['-20%', 3.4, 1.9, '#ffffff'], ['116%', 2.8, 1.1, '#e8e8e8'], ['-8%', 3.6, 2.5, '#cfcfcf'], ['106%', 3.3, 2.9, '#ffffff'], ['18%', 2.2, 0.9, '#f2f2f2'], ['52%', 3.8, 2.1, '#ffffff'], ['-32%', 4.1, 1.6, '#d8d8d8'], ['128%', 3.9, 0.5, '#ffffff']]
/**
 * 삼겹살 먹고싶다 막대: a black liquid-metal pillar with a silver edge, a sheet of particle silk
 * flowing up inside it with fine grains rising over it, light sweeping up it, silver motes floating
 * up around it, and the sparkle on its tip.
 */
function SilverBar({ flip, h }: { flip: boolean; h: number }) {
  ensureSilverArt()
  return (
    <span ref={pauseOffscreen} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: flip ? 'scaleY(-1)' : 'none', ['--bh' as string]: `${h}px` }}>
      <span className="sl-glow" style={css('position:absolute;left:-60%;right:-60%;top:-12px;bottom:-4px;border-radius:40%;background:radial-gradient(closest-side,rgba(220,228,245,0.45),rgba(160,170,190,0.18) 60%,transparent);filter:blur(5px);animation:auraPulse 2.6s ease-in-out infinite')} />
      <span style={css('position:absolute;inset:0;border-radius:5px;overflow:hidden;background:linear-gradient(90deg,#030303 0%,#1e1e1e 30%,#4a4a4a 50%,#1e1e1e 70%,#030303 100%);box-shadow:inset 0 0 0 1px rgba(198,198,198,0.6),0 0 10px rgba(200,210,230,0.3),0 2px 8px rgba(0,0,0,0.35)')}>
        {/* the silk flowing up, and fine grains rising faster over it (images: silverArt.ts) */}
        <span className="sl-rise sl-iBS" style={css(`position:absolute;left:0;right:0;top:0;bottom:-${BAR_TILE}px;will-change:transform;background-size:100% ${BAR_TILE}px;background-repeat:repeat-y;animation:slRise 7s linear infinite`)} />
        <span className="sl-rise sl-iBG" style={css('position:absolute;left:0;right:0;top:0;bottom:-48px;will-change:transform;background-size:100% 48px;background-repeat:repeat-y;opacity:0.8;animation:krSpiral 2.2s linear infinite')} />
        <span className="sl-sweep" style={css('position:absolute;top:0;left:0;right:0;height:36px;background:linear-gradient(0deg,transparent,rgba(255,255,255,0.35),transparent);animation:mxScanUp 2.4s ease-in-out infinite')} />
        <span style={css('position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.12) 50%,transparent 70%)')} />
      </span>
      {SL_MOTES.map(([left, dur, delay, c]) => (
        <span key={left} className="aura-spark" style={{ ...css('position:absolute;bottom:8%;width:2px;height:2px;margin-left:-1px;border-radius:50%;opacity:0'), left, background: c, boxShadow: `0 0 4px ${c},0 0 8px rgba(220,228,245,0.8)`, animation: `auraSpark ${dur}s ease-out ${delay}s infinite` }} />
      ))}
      <span style={css('position:absolute;left:50%;top:-24px;margin-left:-16px;width:32px;height:32px')} dangerouslySetInnerHTML={{ __html: BAR_SPARKLE_SVG }} />
    </span>
  )
}
