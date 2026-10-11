// 가르강튀아: a black hole round the profile photo, drawn the way it's usually shown (Interstellar):
// a pure black core, a thin bright photon ring on the edge of the photo, and an accretion disk seen
// at a slant. Its far half passes over the top of the hole (bent by the gravity) and behind it, its
// near half in front of the bottom edge. Bright on one side (the approaching side), fine streaks
// turn round it. Everything moves by transform and opacity only (the GPU does it).

const rnd = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

/** An annulus mask (percent of the box's half size): the disk shows between a and b. */
export const gaRing = (a: number, b: number) => `radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b - 1}%,transparent ${b}%)`
const ringCss = (a: number, b: number) => `-webkit-mask:${gaRing(a, b)};mask:${gaRing(a, b)}`

/** The disk's light: a bright, warm side and a dimmer one (the approaching side is brighter). */
const DISK = 'conic-gradient(from 0deg,rgba(255,130,40,0) 0deg,rgba(255,196,120,0.95) 22deg,rgba(255,250,235,0.95) 38deg,rgba(255,150,60,0.65) 78deg,rgba(255,110,30,0) 130deg,rgba(255,110,30,0) 215deg,rgba(255,140,60,0.4) 250deg,rgba(255,110,30,0) 290deg,rgba(255,226,170,0.85) 330deg,rgba(255,130,40,0) 360deg)'
/** Fine streaks round the disk, sharp, turning the other way. */
const STREAKS = 'repeating-radial-gradient(closest-side,rgba(255,236,200,0) 0%,rgba(255,236,200,0.9) 1.6%,rgba(255,236,200,0) 3.4%,rgba(255,236,200,0) 6%)'
/** The disk's body: bright just outside the hole, fading outward. */
const BODY = 'radial-gradient(closest-side,rgba(255,170,80,0) 60%,rgba(255,190,110,0.85) 76%,rgba(255,140,50,0.55) 90%,rgba(255,120,40,0) 100%)'
/** The bright part of the disk, for the bar's tip (import name kept). */
export const GA_ARCS = DISK
/** Fine white lines round the disk (the bar's tip). */
export const GA_LINES = STREAKS

// The frame's box: 2.2× the photo across (inset −60%). The photo's edge is at 45% of its half size,
// so the disk runs from just past the photo out to ~2.2× its radius; the photon ring sits on the edge.
const BOX = 'position:absolute;inset:-40%;border-radius:50%'
const PHOTO_EDGE = 71.4

/** The disk, squashed to a slant and clipped to one half (`clip`): 'top' = far side, 'bottom' = near. */
const slantDisk = (clip: 'top' | 'bottom' | 'none', squash: number, tilt: number, spin: number) => {
  const cut = clip === 'top' ? 'clip-path:inset(0 0 50% 0)' : clip === 'bottom' ? 'clip-path:inset(50% 0 0 0)' : ''
  return (
    `<div style="${BOX};transform:rotate(${tilt}deg)"><div style="position:absolute;inset:0;${cut}">` +
    `<div style="position:absolute;inset:0;transform:scaleY(${squash})">` +
    `<div style="position:absolute;inset:0;border-radius:50%;${ringCss(64, 100)};background:${BODY};"></div>` +
    `<div style="position:absolute;inset:0;border-radius:50%;${ringCss(64, 100)};background:${DISK};animation:avSpin ${spin}s linear infinite"></div>` +
    `<div style="position:absolute;inset:0;border-radius:50%;${ringCss(64, 100)};background:${STREAKS};animation:avSpin ${spin * 2}s linear infinite reverse"></div>` +
    `</div></div></div>`
  )
}

export const GARG_AVATAR: { before: string; after: string } = {
  before:
    // the black shadow of the hole, then the far half of the disk, lensed over the top of it
    `<div style="${BOX};background:radial-gradient(closest-side,#000 0,#000 70%,rgba(0,0,0,0.95) 76%,rgba(0,0,0,0) 92%)"></div>` +
    slantDisk('top', 0.42, -12, 9),
  after:
    // the near half of the disk in front of the bottom edge, then the thin bright photon ring on the edge
    slantDisk('bottom', 0.42, -12, 9) +
    `<div class="ga-photon" style="${BOX};background:radial-gradient(closest-side,transparent ${PHOTO_EDGE - 1.2}%,rgba(255,250,235,0.98) ${PHOTO_EDGE + 0.4}%,rgba(255,210,150,0.6) ${PHOTO_EDGE + 1.6}%,transparent ${PHOTO_EDGE + 3}%);animation:gaPulse 2.8s ease-in-out infinite"></div>`,
}

// The 이름표: the hole sits at the right, 150% of the plate's height across, the name over its dark
// left side. Sizes in cqh (the plate is the container). Same shape as the frame, without the photo.
const PLATE_HOLE =
  `<div style="position:absolute;top:50%;left:calc(100% - 40cqh);width:150cqh;height:150cqh;margin:-75cqh 0 0 -75cqh;border-radius:50%">` +
  `<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(closest-side,#000 0,#000 40%,rgba(0,0,0,0.9) 46%,rgba(0,0,0,0) 70%)"></div>` +
  `<div style="position:absolute;inset:0;border-radius:50%;transform:rotate(-10deg)"><div style="position:absolute;inset:0;transform:scaleY(0.4)">` +
  `<div style="position:absolute;inset:0;border-radius:50%;${ringCss(52, 100)};background:${DISK};animation:avSpin 8s linear infinite"></div>` +
  `<div style="position:absolute;inset:0;border-radius:50%;${ringCss(52, 100)};background:${STREAKS};animation:avSpin 14s linear infinite reverse"></div>` +
  `</div></div>` +
  `<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(closest-side,transparent 47%,rgba(255,250,235,0.98) 49%,rgba(255,210,150,0.6) 51%,transparent 54%);animation:gaPulse 2.8s ease-in-out infinite"></div>` +
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
