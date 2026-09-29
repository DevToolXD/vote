// 대한민국 — the 3000P 레전드 set: frame, 이름표 and 막대 스킨 in one look.
// Built from the 태극기 itself, drawn to its real proportions: 한지 ivory, 먹 ink, the flag's
// red and blue, and gold. Gold-rimmed 태극 coins orbit everything in 3D (behind, then in front,
// spinning as they go), gold light rays turn behind, red and blue shockwaves spread, sparks
// twinkle, the four 괘 catch the light in turn. The 태극 itself always stays upright (red on top).
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

/** Gold light rays turning behind something: n wedges, alternating gold / red / blue. */
function rays(cx: number, cy: number, r: number, n: number, dur: number, alpha = 0.5) {
  const cols = ['#ffd66b', RED, '#ffd66b', BLUE]
  // three stacked lengths, so the rays fade out toward their tips (no gradients: no ids)
  let w = ''
  for (const [len, op] of [[1, 0.3], [0.72, 0.35], [0.46, 0.45]]) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI, a1 = a0 + (Math.PI / n) * 0.42, rr = r * len
      w += `<path d="M0 0L${(rr * Math.cos(a0)).toFixed(2)} ${(rr * Math.sin(a0)).toFixed(2)}L${(rr * Math.cos(a1)).toFixed(2)} ${(rr * Math.sin(a1)).toFixed(2)}Z" fill="${cols[i % 4]}" opacity="${op}"></path>`
    }
  }
  return `<g transform="translate(${cx} ${cy})" opacity="${Math.min(1, alpha * 2)}"><g>${w}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${dur}s" repeatCount="indefinite"></animateTransform></g></g>`
}
/** A 4-point twinkle (gold or white), popping in and out. */
const spark = (x: number, y: number, s: number, delay: number, c = '#ffe9a8') =>
  `<g transform="translate(${x} ${y})"><path d="M0 ${-s}Q${s * 0.16} ${-s * 0.16} ${s} 0Q${s * 0.16} ${s * 0.16} 0 ${s}Q${-s * 0.16} ${s * 0.16} ${-s} 0Q${-s * 0.16} ${-s * 0.16} 0 ${-s}Z" fill="${c}" class="kr-spark" style="transform-box:fill-box;transform-origin:center;animation:krTwinkle 2.2s ease-in-out ${delay}s infinite;opacity:0"></path></g>`

/** A 태극 coin (radius s): gold rim, ivory face, the 태극, a glint and a soft halo. */
const coin = (s: number) =>
  `<circle r="${(s * 1.75).toFixed(2)}" fill="#ffd66b" opacity="0.16"></circle><circle r="${(s * 1.4).toFixed(2)}" fill="#ffd66b" opacity="0.24"></circle>` +
  `<circle r="${(s * 1.14).toFixed(2)}" fill="#e6b54a" stroke="#8a5d10" stroke-width="${(s * 0.06).toFixed(2)}"></circle><circle r="${(s * 1.0).toFixed(2)}" fill="${IVORY}"></circle>` +
  taegeuk(s * 0.9) +
  `<ellipse cx="${(-s * 0.35).toFixed(2)}" cy="${(-s * 0.45).toFixed(2)}" rx="${(s * 0.32).toFixed(2)}" ry="${(s * 0.16).toFixed(2)}" fill="#fff" opacity="0.55" transform="rotate(-30 ${(-s * 0.35).toFixed(2)} ${(-s * 0.45).toFixed(2)})"></ellipse>`

/**
 * 태극 coins orbiting cx,cy on a tilted, flattened ellipse (like the 매트릭스 cubes). Draw it
 * twice: layer 'back' before the thing it circles, 'front' after — each coin only shows on its
 * own half, so it really goes behind and comes round in front. Coins spin (squeeze) as they fly
 * and grow as they come near. Pure SVG animation, local coordinates, no ids.
 */
function coinOrbit(o: { cx: number; cy: number; r: number; squash: number; tilt: number; dur: number; n: number; s: number; layer: 'back' | 'front' }) {
  const { cx, cy, r, squash, tilt, dur, n, s, layer } = o
  const vis = layer === 'front' ? '0;1;0' : '1;0;1'
  let out = ''
  for (let i = 0; i < n; i++) {
    const b = `${(-(dur / n) * i).toFixed(2)}s`
    out += `<g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${dur}s" begin="${b}" repeatCount="indefinite"></animateTransform>` +
      `<g transform="translate(0 ${-r})"><g><animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="${dur}s" begin="${b}" repeatCount="indefinite"></animateTransform>` +
      `<g transform="scale(1 ${(1 / squash).toFixed(4)}) rotate(${-tilt})">` +
      `<g opacity="0"><animate attributeName="opacity" calcMode="discrete" values="${vis}" keyTimes="0;0.25;0.75" dur="${dur}s" begin="${b}" repeatCount="indefinite"></animate>` +
      `<g><animateTransform attributeName="transform" type="scale" values="0.62;1;1.3;1;0.62" keyTimes="0;0.25;0.5;0.75;1" dur="${dur}s" begin="${b}" repeatCount="indefinite"></animateTransform>` +
      `<g><animateTransform attributeName="transform" type="scale" values="1 1;0.12 1;1 1" dur="${(1.3 + i * 0.35).toFixed(2)}s" repeatCount="indefinite"></animateTransform>${coin(s)}</g>` +
      `</g></g></g></g></g></g>`
  }
  return `<g transform="translate(${cx} ${cy}) rotate(${tilt})"><g transform="scale(1 ${squash})">${out}</g></g>`
}

// ---- frame ----------------------------------------------------------------------------------
// viewBox 0–120: the photo is the circle r=50 at 60,60.
const FRAME_ORBIT = { cx: 60, cy: 60, r: 76, squash: 0.34, tilt: -16, dur: 5.2, n: 3, s: 9.5 }
const FRAME_SVG = `<svg viewBox="0 0 120 120" style="position:absolute;inset:-10%;width:120%;height:120%;overflow:visible">`
export const KOREA_AVATAR: { before: string; after: string } = {
  before:
    // light through 한지: red from the upper right, blue from the lower left, slowly turning
    `<div class="kr-glow" style="position:absolute;inset:-26%;border-radius:50%;background:conic-gradient(from -56deg,rgba(205,46,58,0.65) 0 50%,rgba(0,71,160,0.65) 50% 100%);filter:blur(9px);-webkit-mask:radial-gradient(closest-side,#000 50%,transparent 76%);mask:radial-gradient(closest-side,#000 50%,transparent 76%);animation:krTurn 12s linear infinite"></div>` +
    // red and blue shockwaves
    `<div class="kr-wave" style="position:absolute;inset:-6%;border-radius:50%;background:radial-gradient(closest-side,transparent 64%,rgba(205,46,58,0.7) 76%,rgba(255,214,107,0.4) 86%,transparent 100%);animation:auraSpread 2.4s ease-out infinite"></div>` +
    `<div class="kr-wave" style="position:absolute;inset:-6%;border-radius:50%;background:radial-gradient(closest-side,transparent 64%,rgba(0,71,160,0.75) 76%,rgba(255,255,255,0.4) 86%,transparent 100%);animation:auraSpread 2.4s ease-out 1.2s infinite"></div>` +
    FRAME_SVG +
    // gold rays turning behind, masked to a halo by the ivory mat
    rays(60, 60, 88, 24, 14, 0.3) +
    coinOrbit({ ...FRAME_ORBIT, layer: 'back' }) +
    `</svg>`,
  after:
    FRAME_SVG +
    // ivory mat and ink hairlines
    `<circle cx="60" cy="60" r="55.4" fill="none" stroke="${IVORY}" stroke-width="9.6"></circle>` +
    `<circle cx="60" cy="60" r="50.6" fill="none" stroke="${INK}" stroke-width="0.8"></circle>` +
    `<circle cx="60" cy="60" r="60.2" fill="none" stroke="${INK}" stroke-width="0.9"></circle>` +
    // the 태극 ring, turning
    `<g class="kr-ring" style="transform-box:view-box;transform-origin:60px 60px;animation:krTurn 8s linear infinite">${taegeukRing(60, 60, 55.4, 5.6)}</g>` +
    // gold and white highlights racing round it
    `<circle class="kr-ring" cx="60" cy="60" r="55.4" fill="none" stroke="#fff6d8" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="14 334" style="transform-box:view-box;transform-origin:60px 60px;animation:krTurn 1.8s linear infinite reverse"></circle>` +
    `<circle class="kr-ring" cx="60" cy="60" r="60.2" fill="none" stroke="#ffd66b" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="22 356" style="transform-box:view-box;transform-origin:60px 60px;animation:krTurn 2.6s linear infinite"></circle>` +
    // the four 괘, still, just outside
    fourGwae(60, 60, 67, 13) +
    // sparks
    spark(12, 18, 4.5, 0) + spark(108, 14, 3.5, 0.7, '#fff') + spark(114, 96, 4, 1.3) + spark(6, 100, 3.2, 1.8, '#fff') + spark(60, -6, 3.8, 1) +
    // coins passing in front
    coinOrbit({ ...FRAME_ORBIT, layer: 'front' }) +
    `</svg>`,
}

// ---- 이름표 ------------------------------------------------------------------------------------
// viewBox 320×56, the art on the right (the name sits on the left). The 이름표 plays a short
// scene when it appears (opening a profile): the four 괘 start circling the 태극 and speed up
// to full speed at 1.4s; at that instant the 태극 shakes like a fusion core, the plate flashes and
// a red and blue aura bursts out, with shockwaves — and then stays trapped inside the plate,
// crackling along every edge, while the 괘 keep whirling and the 태극 keeps trembling.
const BURST = 1.4
const SEAM = (y: number, c: string, dur: number, rev: boolean) =>
  `<path d="M172 ${y} C192 ${y - 12} 212 ${y + 12} 232 ${y} S 256 ${y - 8} 264 ${y - 2}" fill="none" stroke="${c}" stroke-opacity="0.6" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="40 20" class="kr-ribbon" style="animation:krFlow ${dur}s linear infinite${rev ? ' reverse' : ''}"></path>`
/** Shown from the burst on (hidden before it). */
const afterBurst = (delay = 0, dur = 0.3) => `animation:krAppear ${dur}s ease-out ${(BURST + delay).toFixed(2)}s both`

/** A jagged line round the plate's edge (in the stretched 320×56 box): one frame of the crackle. */
function bolt(seed: number) {
  let x = seed * 9301 + 49297
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
  const pts: string[] = []
  const e = 1.6, j = () => (rnd() * 2.6).toFixed(2)
  for (let px = 6; px <= 314; px += 7 + rnd() * 6) pts.push(`${px.toFixed(1)} ${(e + +j()).toFixed(2)}`)
  for (let py = 5; py <= 51; py += 4 + rnd() * 3) pts.push(`${(320 - e - +j()).toFixed(2)} ${py.toFixed(1)}`)
  for (let px = 314; px >= 6; px -= 7 + rnd() * 6) pts.push(`${px.toFixed(1)} ${(56 - e - +j()).toFixed(2)}`)
  for (let py = 51; py >= 5; py -= 4 + rnd() * 3) pts.push(`${(e + +j()).toFixed(2)} ${py.toFixed(1)}`)
  return 'M' + pts.join('L') + 'Z'
}
const BOLTS = [
  [bolt(1), '#ff5a6e'], [bolt(2), '#5c9dff'], [bolt(3), '#ffffff'],
  [bolt(4), '#5c9dff'], [bolt(5), '#ff5a6e'], [bolt(6), '#fff3c4'],
].map(([d, c], i) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.3" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="kr-bolt" style="animation:krBolt 0.3s steps(1) ${(i * 0.05).toFixed(2)}s infinite;opacity:0"></path>`).join('')

// The aura is HTML (soft blurred gradients) centred on the emblem. The emblem sits at viewBox x=284
// of a right-aligned, cover-scaled 320×56 box, so its centre is 36 units in from the right edge,
// one unit being max(width/320, height/56) — worked out with container units.
const U = 'var(--u)'
const at = (w: number, h: number) => `position:absolute;left:calc(${-w / 2} * ${U});top:calc(${-h / 2} * ${U});width:calc(${w} * ${U});height:calc(${h} * ${U})`
const AURA =
  `<div style="position:absolute;inset:0;container-type:size;pointer-events:none">` +
  `<div style="--u:max(calc(100cqw / 320),calc(100cqh / 56));position:absolute;left:calc(100cqw - 36 * var(--u));top:50%;width:0;height:0">` +
  // the burst: red and blue clouds swirling round each other, breathing
  `<div class="kr-burst" style="${at(0, 0)};animation:krBurst 0.8s cubic-bezier(.2,.9,.3,1.15) ${BURST}s both">` +
  `<div class="kr-glow" style="${at(0, 0)};animation:krTurn 6s linear infinite">` +
  `<div class="kr-breath" style="${at(0, 0)};animation:krBreath 1.8s ease-in-out ${BURST + 0.8}s infinite">` +
  `<div style="${at(330, 190)};border-radius:50%;background:radial-gradient(closest-side at 36% 40%,rgba(255,86,104,0.95) 0%,rgba(205,46,58,0.62) 28%,rgba(205,46,58,0.16) 55%,transparent 72%);filter:blur(6px)"></div>` +
  `<div style="${at(330, 190)};border-radius:50%;background:radial-gradient(closest-side at 64% 60%,rgba(80,146,255,0.9) 0%,rgba(0,71,160,0.5) 28%,rgba(0,71,160,0.12) 55%,transparent 72%);filter:blur(6px);mix-blend-mode:normal;opacity:0.85"></div>` +
  `</div></div>` +
  // white-gold heat at the core
  `<div style="${at(90, 90)};border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,0.95),rgba(255,226,150,0.6) 45%,transparent 75%);animation:krBreath 0.9s ease-in-out infinite"></div>` +
  `</div>` +
  // shockwaves at the burst, then a smaller one now and then
  [0, 0.14, 0.3].map(d => `<div class="kr-shock" style="${at(340, 340)};border-radius:50%;box-shadow:0 0 0 2px rgba(255,255,255,0.95),0 0 12px 3px rgba(205,46,58,0.8),inset 0 0 12px 3px rgba(0,71,160,0.8);animation:krShock 0.9s cubic-bezier(.15,.7,.3,1) ${(BURST + d).toFixed(2)}s both"></div>`).join('') +
  `<div class="kr-shock" style="${at(150, 150)};border-radius:50%;box-shadow:0 0 0 1.5px rgba(255,240,200,0.9),0 0 8px 2px rgba(205,46,58,0.6),inset 0 0 8px 2px rgba(0,71,160,0.6);animation:krShock 2.2s ease-out ${BURST + 1.2}s infinite;opacity:0"></div>` +
  `</div></div>`

/** The four 괘 as they whirl: the set itself plus two fading ghosts trailing behind (motion blur). */
const WHIRL =
  `<g class="kr-whirl" style="transform-box:view-box;transform-origin:284px 28px;animation:krSpinUp ${BURST}s cubic-bezier(.5,0,.9,.7) both,krSpinFast 0.31s linear ${BURST}s infinite">` +
  `<circle cx="284" cy="28" r="23.5" fill="none" stroke="${INK}" stroke-width="7" class="kr-ghost" style="animation:krGhost ${BURST}s ease-in both;opacity:0" stroke-opacity="0.07"></circle>` +
  `<g transform="rotate(-24 284 28)"><g class="kr-ghost" style="animation:krGhost ${BURST}s ease-in both" opacity="0.18">${fourGwae(284, 28, 23.5, 9)}</g></g>` +
  `<g transform="rotate(-12 284 28)"><g class="kr-ghost" style="animation:krGhost ${BURST}s ease-in both" opacity="0.4">${fourGwae(284, 28, 23.5, 9)}</g></g>` +
  fourGwae(284, 28, 23.5, 9) +
  `</g>`

export const KOREA_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:linear-gradient(90deg,${IVORY} 0%,#f7f2e8 55%,${HANJI} 100%)">` +
  // 한지 fibres
  `<div style="position:absolute;inset:0;background:repeating-linear-gradient(112deg,rgba(120,96,52,0.035) 0 1px,transparent 1px 6px),repeating-linear-gradient(28deg,rgba(120,96,52,0.025) 0 1px,transparent 1px 9px)"></div>` +
  // the flag's colours as a wash behind the emblem (before the burst)
  `<div class="kr-glow" style="position:absolute;right:-6%;top:-70%;width:40%;height:240%;border-radius:50%;background:conic-gradient(from -56deg,rgba(205,46,58,0.4) 0 50%,rgba(0,71,160,0.4) 50% 100%);filter:blur(12px);animation:krTurn 10s linear infinite"></div>` +
  AURA +
  // the 태극's S drawn out long, red over blue, flowing toward the emblem (faded out on the left, clear of the name)
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%;-webkit-mask-image:linear-gradient(90deg,transparent 52%,#000 76%);mask-image:linear-gradient(90deg,transparent 52%,#000 76%)">` +
  SEAM(24, RED, 5, false) + SEAM(32, BLUE, 6, true) + `</svg>` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">` +
  `<g style="${afterBurst(0, 0.5)}">${rays(284, 28, 56, 18, 7, 0.22)}</g>` +
  // the 태극: charging up, then the fusion shake, then trembling for good
  `<g transform="translate(284 28)">${ripple(18, 0)}${ripple(18, 1.2)}${ripple(18, 2.4)}` +
  `<g class="kr-core" style="transform-box:fill-box;transform-origin:center;animation:krCharge ${BURST}s ease-in both,krFusion 0.8s linear ${BURST}s,krTremble 0.12s linear ${BURST + 0.8}s infinite">` +
  `<circle r="18.8" fill="#e6b54a"></circle><circle r="17.6" fill="${IVORY}" stroke="${INK}" stroke-width="0.6"></circle>${taegeuk(16.4)}` +
  `<circle r="17.6" fill="#ffffff" class="kr-core" style="transform-box:fill-box;transform-origin:center;animation:krCoreFlash 0.7s ease-out ${BURST}s both;opacity:0"></circle>` +
  `</g></g>` +
  `<circle class="kr-ring" cx="284" cy="28" r="18.8" fill="none" stroke="#fff6d8" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="12 106" style="transform-box:fill-box;transform-origin:center;animation:krTurn 1.6s linear infinite"></circle>` +
  WHIRL +
  `<g style="${afterBurst(0.2, 0.6)}">` +
  spark(250, 10, 3.4, 0) + spark(312, 50, 3, 0.8, '#fff') + spark(236, 44, 2.6, 1.5) + spark(306, 8, 2.8, 1.1) + spark(200, 18, 2.4, 0.4, '#fff') + spark(180, 40, 2.2, 1.9) + spark(222, 6, 2.6, 0.2, '#fff') +
  `</g>` +
  `</svg>` +
  // the flash
  `<div class="kr-flash" style="position:absolute;inset:0;background:radial-gradient(120% 140% at 88% 50%,#ffffff 0%,rgba(255,250,235,0.9) 40%,rgba(255,255,255,0.5) 100%);animation:krFlashBang 0.6s ease-out ${BURST}s both;opacity:0"></div>` +
  // the aura trapped inside: glowing against every edge, crackling
  `<div style="position:absolute;inset:0;border-radius:14px;pointer-events:none;${afterBurst(0.15)}">` +
  `<div class="kr-sizzle" style="position:absolute;inset:0;border-radius:14px;box-shadow:inset 0 0 10px 2px rgba(255,70,90,0.8),inset 0 0 22px 5px rgba(0,71,160,0.55),inset 0 0 3px 1px rgba(255,255,255,0.9);animation:krFlicker 0.22s steps(1) infinite"></div>` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 2px rgba(255,90,110,0.9)) drop-shadow(0 0 2px rgba(80,146,255,0.9))">${BOLTS}</svg>` +
  `</div>` +
  `</div>` +
  // 표구-style inner border: a thin gold line just inside the edge
  `<div style="position:absolute;inset:3px;border-radius:11px;box-shadow:inset 0 0 0 0.8px rgba(160,128,72,0.6);pointer-events:none"></div>` +
  `<div style="position:absolute;inset:0;border-radius:14px;box-shadow:inset 0 0 0 1px rgba(26,26,26,0.16);pointer-events:none"></div>`

// ---- 막대 스킨 --------------------------------------------------------------------------------
/** A repeating 48px tile: red on the left, blue on the right, the seam the 태극's S (flows up the bar). */
export const SEAM_TILE = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 48' preserveAspectRatio='none'><rect width='20' height='48' fill='${BLUE}'/><path d='M0 0H10C17 6 17 18 10 24C3 30 3 42 10 48H0Z' fill='${RED}'/><path d='M10 0C17 6 17 18 10 24C3 30 3 42 10 48' fill='none' stroke='${IVORY}' stroke-width='0.9' vector-effect='non-scaling-stroke'/></svg>`)}")`
/** The tip: a 태극 on a gold-rimmed disc, the four 괘 round it, rays turning behind (64×64). */
export const BAR_TIP_SVG =
  `<svg viewBox="-32 -32 64 64" width="64" height="64" style="overflow:visible;display:block">` +
  rays(0, 0, 34, 14, 8, 0.5) +
  ripple(11, 0) + ripple(11, 1.2) + ripple(11, 2.4) +
  `<circle r="12" fill="#e6b54a" stroke="#8a5d10" stroke-width="0.5"></circle><circle r="10.6" fill="${IVORY}"></circle>` + taegeuk(9.4) +
  `<circle class="kr-ring" r="12" fill="none" stroke="#fff6d8" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="9 67" style="transform-box:fill-box;transform-origin:center;animation:krTurn 1.4s linear infinite"></circle>` +
  fourGwae(0, 0, 17, 7.5) +
  spark(-22, -18, 3, 0) + spark(22, -20, 2.6, 0.9, '#fff') + spark(0, -30, 2.8, 1.6) +
  `</svg>`
/** 태극 coins circling the bar (64×40 box centred on the bar); 'back' goes before the bar, 'front' after. */
export const barCoinOrbit = (layer: 'back' | 'front', dur: number) =>
  `<svg viewBox="-32 -20 64 40" width="64" height="40" style="overflow:visible;display:block">${coinOrbit({ cx: 0, cy: 0, r: 26, squash: 0.3, tilt: -8, dur, n: 1, s: 6.6, layer })}</svg>`
