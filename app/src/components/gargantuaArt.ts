// 가르강튀아: a black hole around the profile photo. The photo is the event horizon; round it an
// accretion disk of light turns (warm arcs, and a finer set of white lines turning the other way),
// lines of light fall in towards the hole, and the photon ring on the edge breathes. Everything
// turns or fades by transform and opacity only (the GPU does it).

const rnd = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

/** An annulus mask (percent of the box's half size): the disk shows between a and b. */
export const gaRing = (a: number, b: number) => `radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b - 1}%,transparent ${b}%)`
const ringCss = (a: number, b: number) => `-webkit-mask:${gaRing(a, b)};mask:${gaRing(a, b)}`

/** The warm arcs of the disk (the bright part of it). */
export const GA_ARCS = 'conic-gradient(from 0deg,rgba(255,190,110,0) 0deg,rgba(255,206,130,0.95) 24deg,rgba(255,255,255,0) 62deg,rgba(255,150,70,0.8) 120deg,rgba(255,255,255,0) 160deg,rgba(255,214,150,0.9) 205deg,rgba(255,255,255,0) 246deg,rgba(255,140,60,0.75) 300deg,rgba(255,190,110,0) 344deg,rgba(255,190,110,0) 360deg)'
/** Fine white lines round the disk: many of them, sharp, turning the other way. */
export const GA_LINES = 'repeating-conic-gradient(from 0deg,rgba(255,250,240,0.85) 0deg,rgba(255,255,255,0) 1.5deg,rgba(255,255,255,0) 14deg)'
/** Lines falling into the hole (fine radial dashes, moved in by scale). */
export const GA_FALL = 'repeating-conic-gradient(from 7deg,rgba(255,226,180,0) 0deg,rgba(255,226,180,0.9) 1deg,rgba(255,226,180,0) 2.2deg,rgba(255,226,180,0) 9deg)'
/** The glow round the hole: warm, brightest just past the photo's edge. */
const GLOW = 'radial-gradient(closest-side,rgba(255,160,70,0) 70%,rgba(255,170,80,0.16) 80%,rgba(255,120,40,0.06) 92%,rgba(255,120,40,0) 100%)'

const layer = (extra: string) => `position:absolute;inset:0;border-radius:50%;${extra}`

// The frame: a box 1.5× the photo (inset −25%), the photo covers its middle. Masks run from just
// inside the photo's edge (63–66%) out to the box's edge (100%).
const FRAME_BOX = 'position:absolute;inset:-25%;border-radius:50%'
const frameDisk = (bg: string, a: number, b: number, anim: string, cls = '') =>
  `<div class="${cls}" style="${FRAME_BOX};${ringCss(a, b)};background:${bg};animation:${anim}"></div>`

export const GARG_AVATAR: { before: string; after: string } = {
  before:
    // the dark round the hole, the glow breathing out of it
    `<div style="${FRAME_BOX};background:radial-gradient(closest-side,#000 0,#000 68%,rgba(0,0,0,0.92) 78%,rgba(0,0,0,0) 100%)"></div>` +
    `<div class="ga-glow" style="${FRAME_BOX};background:${GLOW};animation:gaPulse 3.6s ease-in-out infinite"></div>` +
    frameDisk(GA_ARCS, 80, 100, 'avSpin 9s linear infinite', 'ga-arcs') +
    frameDisk(GA_LINES, 76, 100, 'avSpin 15s linear infinite reverse') +
    frameDisk(GA_FALL, 74, 100, 'gaFall 2.4s ease-in infinite', 'ga-fall'),
  after:
    // the photon ring on the photo's edge
    `<div class="ga-photon" style="${layer('box-shadow:0 0 0 1px rgba(255,246,230,0.95),0 0 5px rgba(255,190,110,0.95),0 0 12px rgba(255,130,50,0.6);animation:gaPulse 2.8s ease-in-out infinite')}"></div>`,
}

// The 이름표: the hole sits at the right, 150% of the plate's height across, the name over its
// dark left side. Sizes in cqh (the plate is the container).
const PLATE_HOLE =
  `<div style="position:absolute;top:50%;left:calc(100% - 40cqh);width:150cqh;height:150cqh;margin:-75cqh 0 0 -75cqh;border-radius:50%">` +
  `<div class="ga-glow" style="${layer(`background:${GLOW};animation:gaPulse 3.6s ease-in-out infinite`)}"></div>` +
  `<div style="${layer(`background:${GA_ARCS};${ringCss(63, 100)};animation:avSpin 8s linear infinite`)}"></div>` +
  `<div style="${layer(`background:${GA_LINES};${ringCss(64, 100)};animation:avSpin 14s linear infinite reverse`)}"></div>` +
  `<div class="ga-fall" style="${layer(`background:${GA_FALL};${ringCss(64, 100)};animation:gaFall 2.4s ease-in infinite`)}"></div>` +
  `<div style="${layer('background:radial-gradient(closest-side,transparent 64%,rgba(255,240,215,0.95) 66.5%,rgba(255,190,110,0.5) 69%,transparent 72%);animation:gaPulse 2.8s ease-in-out infinite')}"></div>` +
  `</div>`
const PLATE_SPECKS = (() => {
  const r = rnd(29); let out = ''
  for (let i = 0; i < 14; i++) {
    const s = 1.4 + r() * 1.6
    out += `<span class="ga-spk" style="position:absolute;left:${(r() * 100).toFixed(1)}%;top:${(r() * 100).toFixed(1)}%;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;border-radius:50%;background:#fff3e0;box-shadow:0 0 3px #ffd29a;animation:slTw ${(1.8 + r() * 2).toFixed(2)}s ease-in-out ${(-r() * 3).toFixed(2)}s infinite alternate"></span>`
  }
  return out
})()

export const GARG_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px;background:#000;container-type:size">` +
  `<div style="position:absolute;inset:0;pointer-events:none">${PLATE_HOLE}</div>` +
  // the name's side stays dark, so it reads
  `<div style="position:absolute;inset:0;background:linear-gradient(90deg,#000 0%,rgba(0,0,0,0.85) 38%,rgba(0,0,0,0) 72%)"></div>` +
  PLATE_SPECKS +
  `</div>`
