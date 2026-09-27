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

// ---- frame ----------------------------------------------------------------------------------
let rainFrame = ''
for (let i = 0; i < 13; i++) rainFrame += column(5 + i * 7.5, 7 + Math.floor(rnd() * 5), 7.2, 1.2 + rnd() * 1.5, rnd() * 3, -60, 112)

export const MATRIX_AVATAR = {
  before:
    `<div class="mx-glow" style="position:absolute;inset:-24%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,255,65,0.45),rgba(0,120,30,0.22) 55%,transparent 78%);animation:mxBreath 2.4s ease-in-out infinite"></div>` +
    // digital rain as a halo around the photo
    `<div style="position:absolute;inset:-32%;border-radius:50%;background:radial-gradient(closest-side,#000 0 60%,#010a04 80%,rgba(0,8,3,0.85) 90%,transparent 100%);-webkit-mask:radial-gradient(closest-side,transparent 57%,#000 61%,#000 86%,transparent 99%);mask:radial-gradient(closest-side,transparent 57%,#000 61%,#000 86%,transparent 99%)"><svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:hidden">${rainFrame}</svg></div>` +
    `<div style="position:absolute;inset:-32%;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,255,65,0.0);-webkit-mask:radial-gradient(closest-side,transparent 84%,#000 86%,#000 87%,transparent 89%);mask:radial-gradient(closest-side,transparent 84%,#000 86%,#000 87%,transparent 89%);background:#00ff41;opacity:0.55"></div>`,
  after:
    // scan line over the photo
    `<div style="position:absolute;inset:0;border-radius:50%;overflow:hidden"><div class="mx-scan" style="position:absolute;left:0;right:0;height:22%;background:linear-gradient(180deg,transparent,rgba(0,255,65,0.28) 70%,rgba(200,255,215,0.75) 96%,transparent);animation:mxScan 2.6s cubic-bezier(.5,0,.5,1) infinite"></div><div style="position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,0.08) 0 1px,transparent 1px 3px)"></div></div>` +
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
    // blinking cursor + node lights on the ring
    `<rect class="mx-blink" x="56" y="3.5" width="8" height="4.2" fill="#00ff41" style="animation:mxBlink 1s steps(1) infinite;filter:drop-shadow(0 0 3px #00ff41)"></rect>` +
    `<circle cx="110.5" cy="60" r="1.8" fill="#eafff0" class="mx-blink" style="animation:mxBlink 1.4s steps(1) .3s infinite;filter:drop-shadow(0 0 3px #00ff41)"></circle>` +
    `<circle cx="9.5" cy="60" r="1.8" fill="#eafff0" class="mx-blink" style="animation:mxBlink 1.4s steps(1) .9s infinite;filter:drop-shadow(0 0 3px #00ff41)"></circle>` +
    `</svg>`,
}

// ---- 이름표 ------------------------------------------------------------------------------------
let rainPlate = ''
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

export const MATRIX_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:radial-gradient(120% 140% at 85% 50%,#021f0b 0%,#010d05 55%,#000 100%)">` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%">${rainPlate}${reticle}</svg>` +
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
