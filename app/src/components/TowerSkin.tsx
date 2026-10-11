import { css } from '../css'
import type { SkinGeom } from '../data'
import { GEM_GLOW } from './auraArt'
import { MX_FONT, MX_STRIPS, cubeOrbit } from './matrixArt'
import { BAR_TIP_SVG, BLUE, INK, IVORY, SEAM_TILE, barCoinOrbit } from './koreaArt'
import { pauseOffscreen } from '../offscreen'
import { BAR_TILE, BAR_TIP, HELIX_TILE, SILVER_BAR_SPILL, ensureSilverArt } from './silverArt'
import { GA_ARCS, GA_LINES, gaRing } from './gargantuaArt'

const segment = 'display:block;width:100%;flex:none;background-repeat:no-repeat;background-size:100% 100%'

/** Photo-real landmark drawn inside a bar: fixed cap and base, stretching middle. Flipped for negative bars. */
export function TowerSkin({ g, animateSize }: { g: SkinGeom; animateSize?: boolean }) {
  if (g.special === 'aura') return <AuraBar flip={g.tf !== 'none'} />
  if (g.special === 'matrix') return <MatrixBar flip={g.tf !== 'none'} h={g.H} />
  if (g.special === 'korea') return <KoreaBar flip={g.tf !== 'none'} h={g.H} />
  if (g.special === 'silver') return <SilverBar flip={g.tf !== 'none'} h={g.H} />
  if (g.special === 'chroma') return <SilverBar flip={g.tf !== 'none'} h={g.H} chroma />
  if (g.special === 'gargantua') return <GargantuaBar flip={g.tf !== 'none'} />
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

/**
 * The ring pulsing out of the pillar (it was a growing box-shadow, which repaints every frame).
 * Built from pieces that grow out of each edge and corner by transform, fading by opacity, so
 * the GPU runs it: band width 0 → spread and alpha → 0 with the same ease-out, as before.
 */
const ringPieces = (spread: number, color: string) => {
  const s = `${spread}px`, a = 'position:absolute;pointer-events:none;background:' + color + ';'
  const run = (k: string) => `animation:${k} 1.8s ease-out infinite`
  return [
    a + `left:0;right:0;bottom:100%;height:${s};transform-origin:50% 100%;transform:scaleY(0);` + run('auraRingY'),
    a + `left:0;right:0;top:100%;height:${s};transform-origin:50% 0;transform:scaleY(0);` + run('auraRingY'),
    a + `top:0;bottom:0;right:100%;width:${s};transform-origin:100% 50%;transform:scaleX(0);` + run('auraRingX'),
    a + `top:0;bottom:0;left:100%;width:${s};transform-origin:0 50%;transform:scaleX(0);` + run('auraRingX'),
    a + `right:100%;bottom:100%;width:${s};height:${s};border-top-left-radius:100%;transform-origin:100% 100%;transform:scale(0);` + run('auraRingC'),
    a + `left:100%;bottom:100%;width:${s};height:${s};border-top-right-radius:100%;transform-origin:0 100%;transform:scale(0);` + run('auraRingC'),
    a + `right:100%;top:100%;width:${s};height:${s};border-bottom-left-radius:100%;transform-origin:100% 0;transform:scale(0);` + run('auraRingC'),
    a + `left:100%;top:100%;width:${s};height:${s};border-bottom-right-radius:100%;transform-origin:0 0;transform:scale(0);` + run('auraRingC'),
  ]
}
const RING_PIECES = (
  <span className="aura-ringbar" style={css('position:absolute;inset:0;pointer-events:none')}>
    {[...ringPieces(16, 'rgba(34,225,255,0.6)'), ...ringPieces(9, 'rgba(168,85,247,0.85)')].map((st, i) => <span key={i} className="aura-ring" style={css(st)} />)}
  </span>
)

/** 아우라 막대: an energy pillar flowing upward, two tinted afterimages, aura spreading out, sparks rising, a gem on top. */
function AuraBar({ flip }: { flip: boolean }) {
  return (
    <span ref={pauseOffscreen} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: flip ? 'scaleY(-1)' : 'none' }}>
      {/* aura around the bar */}
      <span className="aura-glow" style={css('position:absolute;left:-70%;right:-70%;top:-10px;bottom:-4px;border-radius:40%;background:radial-gradient(closest-side,rgba(123,60,255,0.5),rgba(34,225,255,0.22) 60%,transparent);filter:blur(4px);animation:auraPulse 1.8s ease-in-out infinite')} />
      {RING_PIECES}
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
        <g className="aura-gem" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'auraGem 2s ease-in-out infinite' }} dangerouslySetInnerHTML={{ __html: GEM_GLOW }} />
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
 * 삼겹살 먹고싶다 막대: a black glass column with the particle silk flowing up inside, a double helix of stardust winding up round the whole pillar (its far side behind, its
 * near side in front), light sweeping up it, motes and grains flying off, a lens flare on the tip.
 */
function SilverBar({ flip, h, chroma = false }: { flip: boolean; h: number; chroma?: boolean }) {
  ensureSilverArt()
  // the helix tile is 1.9 × the pillar wide, clipped to its height (fading out at both ends)
  const helix = (cls: string) => (
    <span style={css('position:absolute;top:0;bottom:0;left:-45%;right:-45%;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 10px,#000 calc(100% - 8px),transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 10px,#000 calc(100% - 8px),transparent 100%)')}>
      <span className={'sl-helix ' + cls} style={css(`position:absolute;left:0;right:0;top:0;bottom:-${HELIX_TILE}px;will-change:transform;background-size:100% ${HELIX_TILE}px;background-repeat:repeat-y;--t:${HELIX_TILE}px;animation:slRiseT 2.8s linear infinite`)} />
    </span>
  )
  return (
    <span ref={pauseOffscreen} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: flip ? 'scaleY(-1)' : 'none', ['--bh' as string]: `${h}px` }}>
      <span className="sl-glow" style={css('position:absolute;left:-70%;right:-70%;top:-18px;bottom:-6px;border-radius:40%;background:radial-gradient(closest-side,rgba(225,232,248,0.5),rgba(160,170,190,0.2) 60%,transparent);filter:blur(6px);animation:auraPulse 2.6s ease-in-out infinite')} />
      {/* the helix's far side, behind the pillar */}
      {helix('sl-iHB')}
      {/* the black glass column, the silk flowing up inside (images: silverArt.ts) — no casing */}
      <span style={css('position:absolute;inset:0;border-radius:6px;overflow:hidden;background:#020202;box-shadow:0 0 12px rgba(210,220,240,0.35)')}>
        <span className="sl-rise sl-iBS" style={css(`position:absolute;left:0;right:0;top:0;bottom:-${BAR_TILE}px;will-change:transform;background-size:100% ${BAR_TILE}px;background-repeat:repeat-y;animation:slRise 7s linear infinite`)} />
        <span className="sl-rise sl-iBG" style={css('position:absolute;left:0;right:0;top:0;bottom:-48px;will-change:transform;background-size:100% 48px;background-repeat:repeat-y;opacity:0.85;animation:krSpiral 2.2s linear infinite')} />
        <span style={css('position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,0.14) 0,rgba(255,255,255,0.04) 18%,transparent 30%,transparent 84%,rgba(255,255,255,0.06) 100%)')} />
        <span className="sl-sweep" style={css('position:absolute;top:0;left:0;right:0;height:40px;background:linear-gradient(0deg,transparent,rgba(255,255,255,0.4),transparent);animation:mxScanUp 2.4s ease-in-out infinite')} />
        {/* 크로마틱: a rainbow flowing up the glass (a tile moved by transform, so it loops) */}
        {chroma && <span className="ch-band" style={css(`position:absolute;left:0;right:0;top:0;bottom:-${CH_BAND}px;will-change:transform;background-image:${CH_BAND_BG};background-size:100% ${CH_BAND}px;background-repeat:repeat-y;mix-blend-mode:screen;opacity:0.5;--t:${CH_BAND}px;animation:slRiseT 3.2s linear infinite`)} />}
      </span>
      {/* the helix's near side, in front */}
      {helix('sl-iHF')}
      {SL_MOTES.map(([left, dur, delay, c]) => (
        <span key={left} className="aura-spark" style={{ ...css('position:absolute;bottom:8%;width:2px;height:2px;margin-left:-1px;border-radius:50%;opacity:0'), left, background: c, boxShadow: `0 0 4px ${c},0 0 8px rgba(220,228,245,0.8)`, animation: `auraSpark ${dur}s ease-out ${delay}s infinite` }} />
      ))}
      {/* grains breaking out off its sides */}
      <span style={css('position:absolute;inset:0;pointer-events:none')} dangerouslySetInnerHTML={{ __html: SILVER_BAR_SPILL }} />
      <span style={css('position:absolute;left:50%;top:-5px;width:0;height:0')} dangerouslySetInnerHTML={{ __html: BAR_TIP }} />
    </span>
  )
}

const CH_BAND = 240
const CH_BAND_BG = 'linear-gradient(180deg,rgba(255,95,162,0.9),rgba(255,212,95,0.9),rgba(125,255,154,0.9),rgba(95,212,255,0.9),rgba(157,123,255,0.9),rgba(255,95,162,0.9))'
const GA_TILE_A = 41, GA_TILE_B = 27
const GA_TILE_A_BG = 'linear-gradient(180deg,transparent 0 8px,rgba(255,206,130,0.8) 8px 9px,transparent 9px 27px,rgba(190,150,255,0.6) 27px 28px,transparent 28px 41px)'
const GA_TILE_B_BG = 'linear-gradient(180deg,transparent 0 12px,rgba(255,255,255,0.7) 12px 13px,transparent 13px 27px)'
const GA_MOTES: [string, number, number, string][] = [['12%', 2.2, 0, '#ffd29a'], ['80%', 2.8, 0.6, '#ffffff'], ['40%', 3, 1.2, '#ffb35c'], ['66%', 2.5, 1.8, '#ffffff']]
const gaMask = (a: number, b: number) => ({ WebkitMaskImage: gaRing(a, b), maskImage: gaRing(a, b) })

/**
 * 가르강튀아 막대: a black column with light lines flowing up it, and a black hole at its tip with
 * the disk turning round it (the far half behind the column, the near half in front).
 */
function GargantuaBar({ flip }: { flip: boolean }) {
  // the disk, squashed to a thin ellipse round the tip: two rings of light turning the other way
  const disk = (near: boolean) => (
    <span style={{ position: 'absolute', left: -30, top: -30, width: 60, height: 60, clipPath: near ? 'inset(50% 0 0 0)' : 'inset(0 0 50% 0)' }}>
      <span style={{ position: 'absolute', inset: 0, transform: 'scaleY(0.4) rotate(-6deg)' }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: GA_ARCS, ...gaMask(60, 100), animation: 'avSpin 4s linear infinite' }} />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: GA_LINES, ...gaMask(60, 100), animation: 'avSpin 7s linear infinite reverse' }} />
      </span>
    </span>
  )
  return (
    <span ref={pauseOffscreen} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: flip ? 'scaleY(-1)' : 'none' }}>
      <span className="ga-glow" style={css('position:absolute;left:-70%;right:-70%;top:-18px;bottom:-6px;border-radius:40%;background:radial-gradient(closest-side,rgba(255,160,70,0.5),rgba(255,110,40,0.18) 60%,transparent);filter:blur(6px);animation:gaPulse 3s ease-in-out infinite')} />
      <span style={css('position:absolute;left:50%;top:0;width:0;height:0')}>{disk(false)}</span>
      {/* the black column, the lines of light flowing up it (two speeds) */}
      <span style={css('position:absolute;inset:0;border-radius:6px;overflow:hidden;background:#000;box-shadow:0 0 12px rgba(255,150,70,0.35)')}>
        <span style={css(`position:absolute;left:0;right:0;top:0;bottom:-${GA_TILE_A}px;will-change:transform;background-image:${GA_TILE_A_BG};background-size:100% ${GA_TILE_A}px;background-repeat:repeat-y;--t:${GA_TILE_A}px;animation:slRiseT 2.6s linear infinite`)} />
        <span style={css(`position:absolute;left:0;right:0;top:0;bottom:-${GA_TILE_B}px;will-change:transform;background-image:${GA_TILE_B_BG};background-size:100% ${GA_TILE_B}px;background-repeat:repeat-y;opacity:0.7;--t:${GA_TILE_B}px;animation:slRiseT 1.7s linear infinite`)} />
      </span>
      {/* the hole itself, at the tip, and the near half of the disk in front of it */}
      <span style={css('position:absolute;left:50%;top:0;width:0;height:0')}>
        <span style={css('position:absolute;left:-6px;top:-6px;width:12px;height:12px;border-radius:50%;background:#000;box-shadow:0 0 0 1px rgba(255,220,170,0.9),0 0 8px rgba(255,150,60,0.9)')} />
      </span>
      <span style={css('position:absolute;left:50%;top:0;width:0;height:0')}>{disk(true)}</span>
      {GA_MOTES.map(([left, dur, delay, c]) => (
        <span key={left} className="aura-spark" style={{ ...css('position:absolute;bottom:8%;width:2px;height:2px;margin-left:-1px;border-radius:50%;opacity:0'), left, background: c, boxShadow: `0 0 4px ${c},0 0 8px rgba(255,190,120,0.8)`, animation: `auraSpark ${dur}s ease-out ${delay}s infinite` }} />
      ))}
    </span>
  )
}
