// 매트릭스 — the 2000P 레전드 set: frame, 이름표 and 막대 스킨 in one look.
// Digital rain (mirrored half-width katakana + digits: white head, fading green trail),
// HUD rings and a targeting reticle, a scan line, glitch flicker and CRT scanlines.
// Everything is drawn from strings/CSS (no SVG ids), so any number of copies can share a page.

const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789Z:.=*+-<>¦|'
// Deterministic "random" so every copy of the art looks the same (and SSR/hydration never differ).
let seed = 20260927
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const glyph = () => GLYPHS[Math.floor(rnd() * GLYPHS.length)]
const esc = (c: string) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : c)
export const MX_FONT = "'MS Gothic','Osaka-Mono','Noto Sans Mono CJK JP','Noto Sans CJK JP','Hiragino Kaku Gothic ProN',monospace"

/** One falling column as SVG text: trail fades in towards the white, glowing head. */
function column(x: number, len: number, size: number, dur: number, delay: number, from: number, to: number, opacity = 1) {
  let t = ''
  for (let i = 0; i < len; i++) {
    const head = i === len - 1
    const a = head ? 1 : 0.12 + 0.78 * (i / (len - 1)) ** 1.6
    t += `<tspan x="0" dy="${i ? size : 0}" fill="${head ? '#eafff0' : i >= len - 3 ? '#7dffa0' : '#00ff41'}" fill-opacity="${a.toFixed(2)}">${esc(glyph())}</tspan>`
  }
  return `<g transform="translate(${x} 0)" opacity="${opacity}"><g class="mx-fall" style="animation:mxFall ${dur.toFixed(2)}s linear ${(-delay).toFixed(2)}s infinite;--mx-from:${from}px;--mx-to:${to}px"><text transform="scale(-1 1)" font-size="${size}" font-family="${MX_FONT.replace(/"/g, '')}" text-anchor="middle" style="filter:drop-shadow(0 0 1.5px #00ff41)">${t}</text></g></g>`
}
const ticks = (cx: number, r1: number, r2: number, n: number, every: number) => {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, long = i % every === 0, rr = long ? r1 - 2 : r1
    d += `M${(cx + Math.cos(a) * rr).toFixed(2)} ${(cx + Math.sin(a) * rr).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)} ${(cx + Math.sin(a) * r2).toFixed(2)}`
  }
  return d
}
const bracket = (x: number, y: number, sx: number, sy: number) => `<path d="M${x} ${y + 9 * sy}V${y}H${x + 9 * sx}" fill="none" stroke="#00ff41" stroke-width="1.6" stroke-linecap="square"></path>`

/** A short column that drips down and fades out (code bleeding off the frame). */
function drip(x: number, y: number, len: number, size: number, dur: number, delay: number) {
  let t = ''
  for (let i = 0; i < len; i++) t += `<tspan x="0" dy="${i ? size : 0}" fill="${i === len - 1 ? '#eafff0' : '#00ff41'}" fill-opacity="${(0.25 + 0.75 * i / (len - 1)).toFixed(2)}">${esc(glyph())}</tspan>`
  return `<g transform="translate(${x} ${y})"><g class="mx-drip" style="animation:mxDrip ${dur}s ease-in ${delay}s infinite;opacity:0"><text transform="scale(-1 1)" font-size="${size}" font-family="${MX_FONT.replace(/"/g, '')}" text-anchor="middle" style="filter:drop-shadow(0 0 1.5px #00ff41)">${t}</text></g></g>`
}
/** Glyphs set around a circle (the group turns, so the code orbits). */
function orbit(cx: number, r: number, n: number, size: number) {
  let t = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360, bright = i % 7 === 0
    t += `<text transform="rotate(${a.toFixed(1)} ${cx} ${cx})" x="${cx}" y="${cx - r}" font-size="${size}" text-anchor="middle" fill="${bright ? '#eafff0' : '#00ff41'}" fill-opacity="${bright ? 1 : (0.35 + 0.5 * ((i * 37) % 10) / 10).toFixed(2)}">${esc(glyph())}</text>`
  }
  return t
}

// ---- frame ----------------------------------------------------------------------------------
let rainFrame = ''
for (let i = 0; i < 13; i++) rainFrame += column(5 + i * 7.5, 7 + Math.floor(rnd() * 5), 7.2, 1.2 + rnd() * 1.5, rnd() * 3, -60, 112)

export const MATRIX_AVATAR: { before: string; after: string } = {
  before:
    `<div class="mx-glow" style="position:absolute;inset:-24%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,255,65,0.45),rgba(0,120,30,0.22) 55%,transparent 78%);animation:mxBreath 2.4s ease-in-out infinite"></div>` +
    // digital rain as a halo around the photo
    `<div style="position:absolute;inset:-32%;border-radius:50%;background:radial-gradient(closest-side,#000 0 60%,#010a04 80%,rgba(0,8,3,0.85) 90%,transparent 100%);-webkit-mask:radial-gradient(closest-side,transparent 57%,#000 61%,#000 86%,transparent 99%);mask:radial-gradient(closest-side,transparent 57%,#000 61%,#000 86%,transparent 99%)"><svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:hidden">${rainFrame}</svg></div>` +
    `<div style="position:absolute;inset:-32%;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,255,65,0.0);-webkit-mask:radial-gradient(closest-side,transparent 84%,#000 86%,#000 87%,transparent 89%);mask:radial-gradient(closest-side,transparent 84%,#000 86%,#000 87%,transparent 89%);background:#00ff41;opacity:0.55"></div>`,
  after:
    // scan line over the photo
    `<div style="position:absolute;inset:0;border-radius:50%;overflow:hidden"><div class="mx-scan" style="position:absolute;left:0;right:0;height:22%;background:linear-gradient(180deg,transparent,rgba(0,255,65,0.28) 70%,rgba(200,255,215,0.75) 96%,transparent);animation:mxScan 2.6s cubic-bezier(.5,0,.5,1) infinite"></div><div style="position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,0.08) 0 1px,transparent 1px 3px)"></div><div class="mx-slice" style="position:absolute;left:0;right:0;top:55%;height:10%;background:linear-gradient(90deg,rgba(0,255,65,0.1),rgba(0,255,65,0.55),rgba(234,255,240,0.6),rgba(0,255,65,0.1));mix-blend-mode:screen;animation:mxSlice 3.7s steps(1) .4s infinite"></div></div>` +
    `<svg viewBox="0 0 120 120" style="position:absolute;inset:-10%;width:120%;height:120%;overflow:visible">` +
    // glitch ghosts of the main ring (flash now and then)
    `<circle class="mx-glitch" cx="61.6" cy="60" r="50.5" fill="none" stroke="#ff2b6a" stroke-width="1.4" style="animation:mxGlitch 3.1s steps(1) infinite"></circle>` +
    `<circle class="mx-glitch" cx="58.4" cy="60" r="50.5" fill="none" stroke="#35f0ff" stroke-width="1.4" style="animation:mxGlitch 3.1s steps(1) .07s infinite"></circle>` +
    // main ring + inner hairline
    `<circle cx="60" cy="60" r="50.5" fill="none" stroke="#00ff41" stroke-width="2.4" style="filter:drop-shadow(0 0 2px #00ff41) drop-shadow(0 0 5px rgba(0,255,65,0.7))"></circle>` +
    `<circle cx="60" cy="60" r="48.3" fill="none" stroke="#b7ffc9" stroke-width="0.5" opacity="0.7"></circle>` +
    // HUD: dotted ring, segmented ring, tick marks — turning at different speeds
    `<g class="mx-spin" style="transform-box:view-box;transform-origin:60px 60px;animation:avSpin 14s linear infinite"><circle cx="60" cy="60" r="54.5" fill="none" stroke="#00ff41" stroke-width="1" stroke-dasharray="1.2 2.6" opacity="0.9"></circle></g>` +
    `<g class="mx-spin" style="transform-box:view-box;transform-origin:60px 60px;animation:avSpin 7s linear infinite reverse"><circle cx="60" cy="60" r="58" fill="none" stroke="#0bd13b" stroke-width="2" stroke-dasharray="22 5 5 5 2 5" style="filter:drop-shadow(0 0 2px #00ff41)"></circle></g>` +
    `<g class="mx-spin" style="transform-box:view-box;transform-origin:60px 60px;animation:avSpin 30s linear infinite"><path d="${ticks(60, 61.5, 64, 60, 5)}" stroke="#00ff41" stroke-width="0.8" opacity="0.75"></path></g>` +
    // targeting brackets
    `<g class="mx-lock" style="transform-box:view-box;transform-origin:60px 60px;animation:mxLock 3.6s ease-in-out infinite">${bracket(2, 2, 1, 1)}${bracket(118, 2, -1, 1)}${bracket(2, 118, 1, -1)}${bracket(118, 118, -1, -1)}</g>` +
    // a streak of light running round the main ring
    `<circle class="mx-dash" cx="60" cy="60" r="50.5" fill="none" stroke="#eafff0" stroke-width="3" stroke-linecap="round" stroke-dasharray="16 301.3" style="animation:mxDash 1.6s linear infinite;filter:drop-shadow(0 0 3px #00ff41) drop-shadow(0 0 6px #00ff41)"></circle>` +
    // digital shockwaves
    `<g style="transform-box:view-box;transform-origin:60px 60px"><circle class="mx-wave" cx="60" cy="60" r="52" fill="none" stroke="#00ff41" stroke-width="1.4" stroke-dasharray="3 3" style="transform-box:view-box;transform-origin:60px 60px;animation:mxWave 2.4s ease-out infinite"></circle><circle class="mx-wave" cx="60" cy="60" r="52" fill="none" stroke="#7dffa0" stroke-width="1" stroke-dasharray="1 4" style="transform-box:view-box;transform-origin:60px 60px;animation:mxWave 2.4s ease-out 1.2s infinite"></circle></g>` +
    // a ring of code orbiting the frame
    `<g class="mx-spin" style="transform-box:view-box;transform-origin:60px 60px;animation:avSpin 18s linear infinite reverse;font-family:${MX_FONT.replace(/"/g, '')};filter:drop-shadow(0 0 1.5px #00ff41)">${orbit(60, 68, 30, 5.2)}</g>` +
    // code dripping off the bottom
    drip(46, 112, 4, 5, 2.2, 0) + drip(60, 116, 5, 5.4, 2.6, 0.9) + drip(74, 112, 4, 5, 2.0, 1.6) +
    // blinking cursor + node lights on the ring
    `<rect class="mx-blink" x="56" y="3.5" width="8" height="4.2" fill="#00ff41" style="animation:mxBlink 1s steps(1) infinite;filter:drop-shadow(0 0 3px #00ff41)"></rect>` +
    `<circle cx="110.5" cy="60" r="1.8" fill="#eafff0" class="mx-blink" style="animation:mxBlink 1.4s steps(1) .3s infinite;filter:drop-shadow(0 0 3px #00ff41)"></circle>` +
    `<circle cx="9.5" cy="60" r="1.8" fill="#eafff0" class="mx-blink" style="animation:mxBlink 1.4s steps(1) .9s infinite;filter:drop-shadow(0 0 3px #00ff41)"></circle>` +
    `</svg>`,
}

// ---- 이름표 ------------------------------------------------------------------------------------
let rainPlate = ''
// far layer first (small, dim, slow) for depth, then the near layer
for (let i = 0; i < 40; i++) rainPlate += column(2 + i * 8, 6 + Math.floor(rnd() * 5), 5.4, 2.8 + rnd() * 2.6, rnd() * 5, -50, 90, 0.18 + 0.3 * (i / 40))
for (let i = 0; i < 33; i++) {
  const x = 4 + i * 9.8
  rainPlate += column(x, 5 + Math.floor(rnd() * 5), 8.6, 1.4 + rnd() * 2.4, rnd() * 4, -70, 110, (0.22 + 0.78 * (x / 320) ** 1.3))
}
const reticle =
  `<g transform="translate(290 28)">` +
  `<circle r="17" fill="rgba(0,20,6,0.85)" stroke="#00ff41" stroke-width="1.2" style="filter:drop-shadow(0 0 4px #00ff41)"></circle>` +
  `<g class="mx-spin" style="transform-box:fill-box;transform-origin:center;animation:avSpin 6s linear infinite"><circle r="21.5" fill="none" stroke="#00ff41" stroke-width="1.6" stroke-dasharray="10 4 2 4"></circle></g>` +
  `<g class="mx-spin" style="transform-box:fill-box;transform-origin:center;animation:avSpin 10s linear infinite reverse"><circle r="13" fill="none" stroke="#7dffa0" stroke-width="0.8" stroke-dasharray="1 2"></circle></g>` +
  `<path d="M-26 0H-19M19 0H26M0 -26V-19M0 19V26" stroke="#00ff41" stroke-width="1.2"></path>` +
  `<text class="mx-flick" y="5.5" text-anchor="middle" font-size="15" font-family="${MX_FONT.replace(/"/g, '')}" fill="#eafff0" style="filter:drop-shadow(0 0 3px #00ff41);animation:mxFlick 2.2s steps(1) infinite">ﾏ</text>` +
  `</g>`

const TICKER = Array.from({ length: 90 }, (_, i) => (i % 9 === 8 ? ' ' : rnd() > 0.5 ? '1' : '0')).join('') + ' WAKE UP NEO · FOLLOW THE WHITE RABBIT · '

export const MATRIX_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:radial-gradient(120% 140% at 85% 50%,#021f0b 0%,#010d05 55%,#000 100%)">` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%">${rainPlate}${reticle}</svg>` +
  // binary ticker along the bottom
  `<div style="position:absolute;left:0;right:0;bottom:1px;height:8px;overflow:hidden;opacity:0.55"><div class="mx-ticker" style="white-space:nowrap;font:600 7px/8px ui-monospace,Menlo,monospace;color:#00ff41;text-shadow:0 0 3px #00ff41;animation:mxTicker 9s linear infinite">${TICKER}${TICKER}</div></div>` +
  // glitch slice: a band that jumps sideways now and then
  `<div class="mx-slice" style="position:absolute;left:0;right:0;top:38%;height:9%;background:linear-gradient(90deg,transparent,rgba(0,255,65,0.35),rgba(234,255,240,0.5),rgba(0,255,65,0.35),transparent);mix-blend-mode:screen;animation:mxSlice 4.2s steps(1) infinite"></div>` +
  // scan line + CRT lines + vignette
  `<div class="mx-scanx" style="position:absolute;top:0;bottom:0;width:18%;background:linear-gradient(90deg,transparent,rgba(0,255,65,0.16) 70%,rgba(200,255,215,0.45) 97%,transparent);animation:mxScanX 3.8s cubic-bezier(.45,0,.55,1) infinite"></div>` +
  `<div style="position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,0.28) 0 1px,transparent 1px 3px)"></div>` +
  `<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.35) 38%,transparent 60%)"></div>` +
  `</div>` +
  // data running around the border
  `<div style="position:absolute;inset:0;border-radius:14px;padding:1.5px;overflow:hidden;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);z-index:3;pointer-events:none;background:rgba(0,255,65,0.28)">` +
  `<div class="mx-spin" style="position:absolute;left:-25%;top:50%;width:150%;padding-top:150%;margin-top:-75%;background:conic-gradient(from 0deg,transparent 0 30%,#00ff41 45%,#eafff0 50%,transparent 52% 80%,#00ff41 95%,#eafff0 99%,transparent 100%);animation:avSpin 3.2s linear infinite"></div></div>`

// ---- 막대 스킨 --------------------------------------------------------------------------------
/** Glyph strips for the bar's rain columns (HTML, top to bottom; the last one is the head). */
export const MX_STRIPS = Array.from({ length: 4 }, () => Array.from({ length: 14 }, glyph))

// ---- orbiting cubes ---------------------------------------------------------------------------
// A glowing green cube spinning in 3D, carried round an ellipse. Each orbit is drawn twice: once
// behind the photo/bar (whole orbit) and once in front, clipped to the near half — so the cubes
// really pass behind and in front. They also grow on the near side and shrink on the far side.
function cube(s: string) {
  const half = `calc(${s} / 2)`
  const face = (t: string) => `<div style="position:absolute;inset:0;border:1px solid #7dffa0;background:rgba(0,255,65,0.16);box-shadow:inset 0 0 ${'calc(' + s + ' / 3)'} rgba(0,255,65,0.75),0 0 4px rgba(0,255,65,0.9);transform:${t} translateZ(${half})"></div>`
  return `<div style="width:${s};height:${s};perspective:calc(${s} * 6)"><div class="mx-cube" style="position:relative;width:100%;height:100%;transform-style:preserve-3d;animation:mxCube 2.6s linear infinite">` +
    face('rotateY(0deg)') + face('rotateY(90deg)') + face('rotateY(180deg)') + face('rotateY(-90deg)') + face('rotateX(90deg)') + face('rotateX(-90deg)') +
    `</div></div>`
}
/**
 * One orbit layer. `inset` sizes the orbit around the host, `tilt` turns the ellipse, `squash`
 * flattens it (0.3 = seen from the side). `front` keeps only the near half.
 */
export function cubeOrbit({ size, inset, tilt, squash, dur, cubes, front }: { size: string; inset: string; tilt: number; squash: number; dur: number; cubes: number; front: boolean }) {
  let out = ''
  for (let i = 0; i < cubes; i++) {
    const delay = -(dur / cubes) * i
    out += `<div class="mx-orbit" style="position:absolute;inset:0;animation:avSpin ${dur}s linear ${delay}s infinite"><div style="position:absolute;left:50%;top:0;width:0;height:0"><div class="mx-orbit" style="animation:avSpin ${dur}s linear ${delay}s infinite reverse"><div style="transform:scaleY(${(1 / squash).toFixed(3)})"><div class="mx-depth" style="transform:translate(-50%,-50%);animation:mxDepth ${dur}s ease-in-out ${delay}s infinite">${cube(size)}</div></div></div></div></div>`
  }
  return `<div style="position:absolute;inset:${inset};transform:rotate(${tilt}deg);pointer-events:none;${front ? '-webkit-clip-path:inset(50% -40% -40% -40%);clip-path:inset(50% -40% -40% -40%)' : ''}"><div style="position:absolute;inset:0;transform:scaleY(${squash})">${out}</div></div>`
}
const FRAME_CUBES = { size: 'calc(var(--av, 52px) * 0.14)', inset: '-26%', tilt: -18, squash: 0.36, dur: 4.2, cubes: 2 }
MATRIX_AVATAR.before += cubeOrbit({ ...FRAME_CUBES, front: false })
MATRIX_AVATAR.after += cubeOrbit({ ...FRAME_CUBES, front: true })
