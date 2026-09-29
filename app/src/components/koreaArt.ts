// 대한민국 — the 3000P 레전드 set: frame, 이름표 and 막대 스킨 in one look.
// Built from the 태극기 itself, drawn to its real proportions: 한지 ivory, 먹 ink, and the
// flag's red and blue as the only colours. Few elements, precise geometry, calm motion:
// the ring of the frame turns, light ripples out from the 태극 (always upright, red on top),
// the four 괘 catch the light one after another.
// Solid fills and CSS only (no SVG ids), so any number of copies can share a page.

export const RED = '#cd2e3a', BLUE = '#0047a0'
export const INK = '#1a1a1a', IVORY = '#fbf8f1', HANJI = '#f3ede1'

/** 태극 (radius r, centred on 0,0) as on the flag: red above, blue below, red's round head on the left, blue's on the right, the S tilted along the diagonal. */
/** A thin ring of light that swells out and fades behind an upright 태극. */
const ripple = (r: number, delay = 0) => `<circle r="${r}" fill="none" stroke="#c9a24a" stroke-width="1.2" class="kr-ripple" style="transform-box:fill-box;transform-origin:center;animation:krRipple 3.6s ease-out ${delay}s infinite;opacity:0"></circle>`
export const taegeuk = (r: number) =>
  `<g transform="rotate(33.69)"><circle r="${r}" fill="${BLUE}"></circle><path d="M${-r} 0A${r} ${r} 0 0 1 ${r} 0A${r / 2} ${r / 2} 0 0 0 0 0A${r / 2} ${r / 2} 0 0 1 ${-r} 0Z" fill="${RED}"></path></g>`

/**
 * One 괘 (rows top to bottom, 1 = whole bar, 0 = broken), width w, centred on 0,0.
 * Flag proportions: bar = w/6 thick, w/12 apart, a broken bar's gap w/12.
 * Ink with an ivory edge, so it reads on light and dark alike; `glint` = seconds of delay
 * for the gold shine that runs through the four in turn.
 */
function gwae(rows: number[], w: number, glint?: number) {
  const h = w / 6, gap = w / 12, half = (w - gap) / 2
  const y0 = -(3 * h + 2 * gap) / 2
  const anim = glint === undefined ? '' : ` class="kr-glint" style="animation:krGlint 6s ease-in-out ${glint}s infinite"`
  const bar = (x: number, y: number, bw: number) => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}"></rect>`
  const bars = rows.map((r, i) => {
    const y = y0 + i * (h + gap)
    return r ? bar(-w / 2, y, w) : bar(-w / 2, y, half) + bar(gap / 2, y, half)
  }).join('')
  return `<g fill="${INK}" stroke="${IVORY}" stroke-width="${(w / 14).toFixed(2)}" paint-order="stroke" stroke-linejoin="round"${anim}>${bars}</g>`
}
const GWAE_ROWS = { geon: [1, 1, 1], gam: [0, 1, 0], gon: [0, 0, 0], ri: [1, 0, 1] }
/** The four 괘 where the flag has them: 건 upper left, 감 upper right, 곤 lower right, 리 lower left. */
const FOUR: [keyof typeof GWAE_ROWS, number][] = [['geon', -45], ['gam', 45], ['gon', 135], ['ri', 225]]
const fourGwae = (cx: number, cy: number, dist: number, w: number) =>
  FOUR.map(([g, a], i) => `<g transform="translate(${cx} ${cy}) rotate(${a}) translate(0 ${-dist})">${gwae(GWAE_ROWS[g], w, i * 1.5)}</g>`).join('')

/**
 * A ring in the 태극's two colours: a red and a blue half chasing each other, each with a
 * round head that tucks into the other's tail (the 태극 S, bent round a circle).
 */
function taegeukRing(cx: number, cy: number, r: number, w: number) {
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => `${(cx + r * Math.cos(a * Math.PI / 180)).toFixed(2)} ${(cy + r * Math.sin(a * Math.PI / 180)).toFixed(2)}`
    return `M${p(a0)}A${r} ${r} 0 0 1 ${p(a1)}`
  }
  const head = (a: number, c: string) => `<circle cx="${(cx + r * Math.cos(a * Math.PI / 180)).toFixed(2)}" cy="${(cy + r * Math.sin(a * Math.PI / 180)).toFixed(2)}" r="${(w / 2).toFixed(2)}" fill="${c}"></circle>`
  return `<path d="${arc(180, 360)}" fill="none" stroke="${RED}" stroke-width="${w}"></path>` +
    `<path d="${arc(0, 180)}" fill="none" stroke="${BLUE}" stroke-width="${w}"></path>` +
    head(0, RED) + head(180, BLUE) +
    // hairlines between the halves and along both edges keep it crisp
    `<circle cx="${cx}" cy="${cy}" r="${r + w / 2}" fill="none" stroke="${IVORY}" stroke-width="0.7"></circle>` +
    `<circle cx="${cx}" cy="${cy}" r="${r - w / 2}" fill="none" stroke="${IVORY}" stroke-width="0.7"></circle>`
}

// ---- frame ----------------------------------------------------------------------------------
// viewBox 0–120: the photo is the circle r=50 at 60,60.
export const KOREA_AVATAR: { before: string; after: string } = {
  before:
    // light through 한지: red from the upper right, blue from the lower left, slowly turning
    `<div class="kr-glow" style="position:absolute;inset:-22%;border-radius:50%;background:conic-gradient(from -56deg,rgba(205,46,58,0.5) 0 50%,rgba(0,71,160,0.5) 50% 100%);filter:blur(9px);-webkit-mask:radial-gradient(closest-side,#000 50%,transparent 76%);mask:radial-gradient(closest-side,#000 50%,transparent 76%);animation:krTurn 18s linear infinite"></div>`,
  after:
    `<svg viewBox="0 0 120 120" style="position:absolute;inset:-10%;width:120%;height:120%;overflow:visible">` +
    // ivory mat and ink hairlines
    `<circle cx="60" cy="60" r="55.4" fill="none" stroke="${IVORY}" stroke-width="9.6"></circle>` +
    `<circle cx="60" cy="60" r="50.6" fill="none" stroke="${INK}" stroke-width="0.8"></circle>` +
    `<circle cx="60" cy="60" r="60.2" fill="none" stroke="${INK}" stroke-width="0.9"></circle>` +
    // the 태극 ring, turning
    `<g class="kr-ring" style="transform-box:view-box;transform-origin:60px 60px;animation:krTurn 16s linear infinite">${taegeukRing(60, 60, 55.4, 5.6)}</g>` +
    // a soft highlight gliding round it the other way
    `<circle class="kr-ring" cx="60" cy="60" r="55.4" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="2" stroke-linecap="round" stroke-dasharray="10 338" style="transform-box:view-box;transform-origin:60px 60px;animation:krTurn 4.5s linear infinite reverse"></circle>` +
    // the four 괘, still, just outside
    fourGwae(60, 60, 67, 13) +
    `</svg>`,
}

// ---- 이름표 ------------------------------------------------------------------------------------
// viewBox 320×56, the art on the right (the name sits on the left).
const SEAM = (y: number, c: string, dur: number, rev: boolean) =>
  `<path d="M172 ${y} C192 ${y - 12} 212 ${y + 12} 232 ${y} S 256 ${y - 8} 264 ${y - 2}" fill="none" stroke="${c}" stroke-opacity="0.5" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="40 20" class="kr-ribbon" style="animation:krFlow ${dur}s linear infinite${rev ? ' reverse' : ''}"></path>`
export const KOREA_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:linear-gradient(90deg,${IVORY} 0%,#f7f2e8 55%,${HANJI} 100%)">` +
  // 한지 fibres
  `<div style="position:absolute;inset:0;background:repeating-linear-gradient(112deg,rgba(120,96,52,0.035) 0 1px,transparent 1px 6px),repeating-linear-gradient(28deg,rgba(120,96,52,0.025) 0 1px,transparent 1px 9px)"></div>` +
  // the flag's colours as a faint wash behind the emblem
  `<div class="kr-glow" style="position:absolute;right:-4%;top:-60%;width:34%;height:220%;border-radius:50%;background:conic-gradient(from -56deg,rgba(205,46,58,0.22) 0 50%,rgba(0,71,160,0.22) 50% 100%);filter:blur(12px);animation:krTurn 18s linear infinite"></div>` +
  // the 태극's S drawn out long, red over blue, flowing toward the emblem (faded out on the left, clear of the name)
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%;-webkit-mask-image:linear-gradient(90deg,transparent 52%,#000 76%);mask-image:linear-gradient(90deg,transparent 52%,#000 76%)">` +
  SEAM(24, RED, 7, false) + SEAM(32, BLUE, 8, true) + `</svg>` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%">` +
  // a small 태극기: the 태극 (upright) and the four 괘 at its corners
  `<g transform="translate(284 28)">${ripple(18, 0)}${ripple(18, 1.8)}<circle r="17.6" fill="${IVORY}" stroke="${INK}" stroke-width="0.6"></circle>${taegeuk(16.4)}</g>` +
  fourGwae(284, 28, 23.5, 9) +
  `</svg>` +
  `</div>` +
  // 표구-style inner border: a thin gold-brown line just inside the edge
  `<div style="position:absolute;inset:3px;border-radius:11px;box-shadow:inset 0 0 0 0.8px rgba(160,128,72,0.55);pointer-events:none"></div>` +
  `<div style="position:absolute;inset:0;border-radius:14px;box-shadow:inset 0 0 0 1px rgba(26,26,26,0.14);pointer-events:none"></div>`

// ---- 막대 스킨 --------------------------------------------------------------------------------
/** A repeating 48px tile: red on the left, blue on the right, the seam the 태극's S (flows up the bar). */
export const SEAM_TILE = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 48' preserveAspectRatio='none'><rect width='20' height='48' fill='${BLUE}'/><path d='M0 0H10C17 6 17 18 10 24C3 30 3 42 10 48H0Z' fill='${RED}'/><path d='M10 0C17 6 17 18 10 24C3 30 3 42 10 48' fill='none' stroke='${IVORY}' stroke-width='0.9' vector-effect='non-scaling-stroke'/></svg>`)}")`
/** The tip: a 태극 on an ivory disc with the four 괘 round it — a 태극기 in miniature (48×48). */
export const BAR_TIP_SVG =
  `<svg viewBox="-24 -24 48 48" width="48" height="48" style="overflow:visible;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35))">` +
  ripple(11, 0) + ripple(11, 1.8) + `<circle r="10.6" fill="${IVORY}" stroke="${INK}" stroke-width="0.7"></circle>` + taegeuk(9.4) +
  fourGwae(0, 0, 16, 7.5) +
  `</svg>`
