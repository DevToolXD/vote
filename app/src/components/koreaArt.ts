// 대한민국 — the 3000P 레전드 set: frame, 이름표 and 막대 스킨 in one look.
// 태극 red and blue on a deep navy night, gold 단청 bands, the four 괘 (건곤감리) circling,
// 무궁화 blossoms and falling petals, and fireworks in red, blue, white and gold.
// Solid fills and CSS only (no SVG ids), so any number of copies can share a page.
import { cubeOrbit } from './matrixArt'

export const RED = '#cd2e3a', BLUE = '#0047a0', GOLD = '#f2c75c'
const ring = (a: number, b: number) => `-webkit-mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b}%,transparent ${b + 1}%);mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b}%,transparent ${b + 1}%)`
const DANCHEONG = '#c8102e 0 7deg,#f6c90e 7deg 10deg,#1f8a70 10deg 17deg,#ffffff 17deg 19deg,#0047a0 19deg 26deg,#f6c90e 26deg 28deg'

/** 태극 (radius 10, centred on 0,0): red above, blue below, tilted like the flag, gold rim. */
export const TAEGEUK = `<g transform="rotate(33.7)"><circle r="10.6" fill="${GOLD}"></circle><circle r="10" fill="${BLUE}"></circle><path d="M-10 0A10 10 0 0 1 10 0A5 5 0 0 1 0 0A5 5 0 0 0 -10 0Z" fill="${RED}"></path></g>`
/** One 괘 as three rows of bars (1 = whole, 0 = broken), centred on 0,0. */
const gwae = (rows: number[], w = 9, h = 1.7, gap = 1.3) => rows.map((r, i) => {
  const y = -((h * 3 + gap * 2) / 2) + i * (h + gap)
  return r ? `<rect x="${-w / 2}" y="${y.toFixed(2)}" width="${w}" height="${h}" fill="#0b0f1a"></rect>` : `<rect x="${-w / 2}" y="${y.toFixed(2)}" width="${w * 0.42}" height="${h}" fill="#0b0f1a"></rect><rect x="${w * 0.08}" y="${y.toFixed(2)}" width="${w * 0.42}" height="${h}" fill="#0b0f1a"></rect>`
}).join('')
export const GWAE = { geon: gwae([1, 1, 1]), gon: gwae([0, 0, 0]), gam: gwae([0, 1, 0]), ri: gwae([1, 0, 1]) }
/** A 괘 on a small white tile with a gold edge (for orbits). */
export const gwaeTile = (g: string) => `<svg viewBox="-8 -8 16 16" width="100%" height="100%" style="overflow:visible;display:block;filter:drop-shadow(0 0 2px rgba(255,255,255,0.8))"><rect x="-7.2" y="-7.2" width="14.4" height="14.4" rx="2.4" fill="#fdfaf2" stroke="${GOLD}" stroke-width="1.1"></rect><g transform="scale(0.72)">${g}</g></svg>`
/** 무궁화: five pink petals, deep red heart, gold stamen. */
const MUGUNGHWA = [0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-6.2" rx="4.6" ry="6.4" fill="#f6a8c4" stroke="#e05b8b" stroke-width="0.8" transform="rotate(${a})"></ellipse><path d="M0 -1.5L0 -8" stroke="#c2185b" stroke-width="0.7" transform="rotate(${a})"></path>`).join('') + '<circle r="2.6" fill="#a3123a"></circle><circle r="1.1" fill="#ffe082"></circle>'
const flower = (x: number, y: number, s: number, dur: number) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="kr-sway" style="transform-box:fill-box;transform-origin:center;animation:avSway ${dur}s ease-in-out infinite">${MUGUNGHWA}</g></g>`
const petal = (x: number, y: number, dur: number, delay: number, c = '#f6a8c4') => `<g transform="translate(${x} ${y})"><ellipse rx="2" ry="3" fill="${c}" class="kr-petal" style="transform-box:fill-box;transform-origin:center;animation:krPetal ${dur}s ease-in ${delay}s infinite;opacity:0"></ellipse></g>`
/** A firework: particles flying out from x,y and fading, then again. */
function firework(x: number, y: number, r: number, n: number, colors: string[], dur: number, delay: number, size = 1.1) {
  let t = ''
  for (let i = 0; i < n; i++) t += `<g transform="rotate(${(i * 360 / n).toFixed(1)})"><circle r="${size}" fill="${colors[i % colors.length]}" class="kr-fw" style="animation:krFw ${dur}s cubic-bezier(.15,.7,.3,1) ${delay}s infinite;--kr-r:${r}px;opacity:0"></circle></g>`
  return `<g transform="translate(${x} ${y})" style="filter:drop-shadow(0 0 1.5px #fff)">${t}<circle r="${size * 1.8}" fill="#fff" class="kr-fw" style="animation:krFlash ${dur}s ease-out ${delay}s infinite;opacity:0"></circle></g>`
}

// ---- frame ----------------------------------------------------------------------------------
export const KOREA_AVATAR: { before: string; after: string } = {
  before:
    // 태극-coloured glow, slowly turning
    `<div class="kr-glow" style="position:absolute;inset:-24%;border-radius:50%;background:conic-gradient(from -90deg,rgba(205,46,58,0.75) 0 50%,rgba(0,71,160,0.75) 50% 100%);filter:blur(7px);-webkit-mask:radial-gradient(closest-side,#000 45%,transparent 72%);mask:radial-gradient(closest-side,#000 45%,transparent 72%);animation:krTurn 9s linear infinite"></div>` +
    // red and blue waves spreading out
    `<div class="kr-wave" style="position:absolute;inset:-8%;border-radius:50%;background:radial-gradient(closest-side,transparent 60%,rgba(205,46,58,0.75) 73%,rgba(242,199,92,0.35) 86%,transparent 100%);animation:auraSpread 2.6s ease-out infinite"></div>` +
    `<div class="kr-wave" style="position:absolute;inset:-8%;border-radius:50%;background:radial-gradient(closest-side,transparent 60%,rgba(0,71,160,0.8) 73%,rgba(255,255,255,0.35) 86%,transparent 100%);animation:auraSpread 2.6s ease-out 1.3s infinite"></div>` +
    // navy base disc for the rings
    `<div style="position:absolute;inset:-12%;border-radius:50%;background:radial-gradient(closest-side,#0b1d4a 70%,#050b1f 100%);${ring(76, 99)}"></div>` +
    // 단청 band (turning one way), gold rims, 태극 swirl ring (turning the other)
    `<div class="kr-ring" style="position:absolute;inset:-12%;border-radius:50%;background:repeating-conic-gradient(${DANCHEONG});${ring(90, 97)};animation:krTurn 40s linear infinite reverse"></div>` +
    `<div style="position:absolute;inset:-12%;border-radius:50%;background:${GOLD};${ring(88.5, 89.8)}"></div><div style="position:absolute;inset:-12%;border-radius:50%;background:${GOLD};${ring(97.2, 98.6)}"></div>` +
    `<div class="kr-ring" style="position:absolute;inset:-12%;border-radius:50%;background:conic-gradient(${RED},#ff7a85 12%,${RED} 25%,#7a0f19 50%,${BLUE} 50%,#4d8cff 62%,${BLUE} 75%,#00255a 100%);${ring(78, 88)};animation:krTurn 3.2s linear infinite;filter:drop-shadow(0 0 3px rgba(255,255,255,0.6))"></div>`,
  after:
    // a gold light running round the frame
    `<div class="kr-ring" style="position:absolute;inset:-15%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 62%,rgba(242,199,92,0.1) 66%,rgba(242,199,92,0.7) 92%,#fffbe8 99%,transparent 100%);${ring(92, 96)};animation:krTurn 1.5s linear infinite"></div>` +
    `<svg viewBox="0 0 120 120" style="position:absolute;inset:-10%;width:120%;height:120%;overflow:visible">` +
    // the four 괘 circling on white tiles
    `<g class="kr-ring" style="transform-box:view-box;transform-origin:60px 60px;animation:krTurn 26s linear infinite">` +
    [['geon', -45], ['gam', 45], ['gon', 135], ['ri', 225]].map(([g, a]) => `<g transform="rotate(${a} 60 60) translate(60 -3.5)"><rect x="-7" y="-6" width="14" height="12" rx="2" fill="#fdfaf2" stroke="${GOLD}" stroke-width="0.9"></rect><g transform="scale(0.85)">${GWAE[g as keyof typeof GWAE]}</g></g>`).join('') + `</g>` +
    // 태극 crest on top, turning, with a halo
    `<g transform="translate(60 2)"><circle r="14" fill="rgba(242,199,92,0.35)" class="kr-halo" style="transform-box:fill-box;transform-origin:center;animation:krHalo 2s ease-in-out infinite"></circle><g class="kr-spin" style="transform-box:fill-box;transform-origin:center;animation:krTurn 7s linear infinite;filter:drop-shadow(0 0 3px rgba(255,255,255,0.9))"><g transform="scale(0.95)">${TAEGEUK}</g></g></g>` +
    // 무궁화 and falling petals
    flower(14, 102, 0.95, 4) + flower(107, 96, 0.7, 5) +
    petal(28, 96, 2.8, 0) + petal(96, 104, 3.2, 1.1) + petal(58, 112, 3, 2, '#fbc8da') +
    // fireworks
    firework(104, 22, 13, 12, [RED, '#ffffff', BLUE, GOLD], 2.4, 0) + firework(14, 30, 10, 10, [GOLD, '#ffffff', RED], 2.4, 1.2, 0.9) +
    `</svg>`,
}

// ---- 이름표 ------------------------------------------------------------------------------------
const ribbon = (d: string, color: string, dur: number, rev = false) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="46 18" class="kr-ribbon" style="filter:drop-shadow(0 0 3px ${color});animation:npDash ${dur}s linear infinite${rev ? ' reverse' : ''}"></path>`
export const KOREA_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:linear-gradient(90deg,#050b1f 0%,#0b1d4a 55%,#13296a 100%)">` +
  // a turning 태극 glow behind the emblem
  `<div class="kr-glow" style="position:absolute;right:-6%;top:-90%;width:44%;height:280%;background:conic-gradient(from -90deg,rgba(205,46,58,0.55) 0 50%,rgba(0,71,160,0.6) 50% 100%);filter:blur(14px);border-radius:50%;animation:krTurn 10s linear infinite"></div>` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%">` +
  `<text x="200" y="40" text-anchor="middle" font-size="34" font-weight="900" fill="${GOLD}" fill-opacity="0.09" style="letter-spacing:6px;font-family:'Nanum Myeongjo','Batang',serif">대한민국</text>` +
  ribbon('M100 44 C140 20 170 20 200 36 S250 54 280 30 S310 12 340 24', RED, 2.6) + ribbon('M110 16 C150 38 176 40 206 22 S256 4 286 26 S316 44 340 34', BLUE, 3.2, true) +
  firework(170, 14, 14, 14, [RED, '#ffffff', GOLD], 2.8, 0) + firework(236, 42, 12, 12, [BLUE, '#ffffff', GOLD], 2.8, 0.9) + firework(140, 40, 10, 10, [GOLD, RED, '#ffffff'], 2.8, 1.8, 0.9) +
  petal(150, -4, 3.4, 0) + petal(205, -6, 3.8, 1.2, '#fbc8da') + petal(255, -4, 3.2, 2.1) + petal(120, -6, 4, 2.9, '#fbc8da') +
  // 태극 emblem with the four 괘 turning round it
  `<g transform="translate(288 28)"><circle r="21" fill="rgba(242,199,92,0.22)" class="kr-halo" style="transform-box:fill-box;transform-origin:center;animation:krHalo 2s ease-in-out infinite"></circle>` +
  `<g class="kr-ring" style="transform-box:fill-box;transform-origin:center;animation:krTurn 16s linear infinite">` +
  [['geon', -45], ['gam', 45], ['gon', 135], ['ri', 225]].map(([g, a]) => `<g transform="rotate(${a}) translate(0 -21)"><g transform="scale(0.7)"><rect x="-7" y="-6" width="14" height="12" rx="2" fill="#fdfaf2" stroke="${GOLD}" stroke-width="1"></rect><g transform="scale(0.85)">${GWAE[g as keyof typeof GWAE]}</g></g></g>`).join('') + `</g>` +
  `<g class="kr-spin" style="transform-box:fill-box;transform-origin:center;animation:krTurn 8s linear infinite;filter:drop-shadow(0 0 4px rgba(255,255,255,0.8))"><g transform="scale(1.25)">${TAEGEUK}</g></g></g>` +
  `</svg>` +
  // gold sweep, 단청 bands top and bottom
  `<div class="kr-sweep" style="position:absolute;top:0;bottom:0;width:26%;background:linear-gradient(90deg,transparent,rgba(255,236,170,0.22),transparent);animation:mxScanX 4.2s ease-in-out infinite"></div>` +
  `<div class="kr-band" style="position:absolute;left:0;right:0;top:0;height:4px;background:repeating-linear-gradient(90deg,#c8102e 0 7px,#f6c90e 7px 9px,#1f8a70 9px 16px,#fff 16px 17px,#0047a0 17px 24px,#f6c90e 24px 26px);background-size:26px 100%;animation:krBand 3s linear infinite;box-shadow:0 1px 0 ${GOLD}"></div>` +
  `<div class="kr-band" style="position:absolute;left:0;right:0;bottom:0;height:4px;background:repeating-linear-gradient(90deg,#0047a0 0 7px,#f6c90e 7px 9px,#1f8a70 9px 16px,#fff 16px 17px,#c8102e 17px 24px,#f6c90e 24px 26px);background-size:26px 100%;animation:krBand 3s linear infinite reverse;box-shadow:0 -1px 0 ${GOLD}"></div>` +
  `</div>` +
  // gold edge with a light running round it
  `<div style="position:absolute;inset:0;border-radius:14px;padding:1.5px;overflow:hidden;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);z-index:3;pointer-events:none;background:${GOLD}">` +
  `<div class="kr-ring" style="position:absolute;left:-25%;top:50%;width:150%;padding-top:150%;margin-top:-75%;background:conic-gradient(from 0deg,transparent 0 35%,${RED} 45%,#fff 50%,${BLUE} 55%,transparent 65%);animation:krTurn 3.4s linear infinite"></div></div>`

// ---- 막대 스킨 --------------------------------------------------------------------------------
export const FIREWORK_SVG = (colors: string[]) => `<svg viewBox="-20 -20 40 40" width="40" height="40" style="overflow:visible">${firework(0, 0, 15, 12, colors, 2.2, 0, 1.3)}</svg>`
export const TAEGEUK_SVG = `<svg viewBox="-12 -12 24 24" width="20" height="20" style="overflow:visible;filter:drop-shadow(0 0 3px rgba(255,255,255,0.9)) drop-shadow(0 0 6px rgba(242,199,92,0.8))"><g class="kr-spin" style="transform-box:fill-box;transform-origin:center;animation:krTurn 6s linear infinite">${TAEGEUK}</g></svg>`
export const PETAL_SVG = `<svg viewBox="-3 -4 6 8" width="6" height="8"><ellipse rx="2.2" ry="3.2" fill="#f6a8c4" stroke="#e05b8b" stroke-width="0.5"></ellipse></svg>`
const GWAE_LIST = [GWAE.geon, GWAE.gam, GWAE.gon, GWAE.ri]
export const barGwaeOrbit = (front: boolean, dur: number, start: number) =>
  cubeOrbit({ size: '11px', inset: '0', tilt: -8, squash: 0.3, cubes: 2, dur, front, inner: i => `<div style="width:11px;height:11px">${gwaeTile(GWAE_LIST[(i * 2 + start) % 4])}</div>` })
