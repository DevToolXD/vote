// 가르강튀아: a black hole round the profile photo. The picture is the black hole itself (public/garg/
// blackhole.jpg: the black core, the photon ring, the disk seen at a slant). It sits behind the photo,
// centred on it, so the hole's dark centre is the photo's edge. The disk runs out past the photo and
// is cut to a circle, so the frame stays round.

/** An annulus mask (percent of the box's half size): kept for the bar's tip (TowerSkin). */
export const gaRing = (a: number, b: number) => `radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b - 1}%,transparent ${b}%)`

/** The bar's tip (TowerSkin) draws its own disk from these. */
export const GA_ARCS = 'conic-gradient(from 0deg,rgba(255,130,40,0) 0deg,rgba(255,196,120,0.95) 22deg,rgba(255,250,235,0.95) 38deg,rgba(255,150,60,0.65) 78deg,rgba(255,110,30,0) 130deg,rgba(255,110,30,0) 215deg,rgba(255,140,60,0.4) 250deg,rgba(255,110,30,0) 290deg,rgba(255,226,170,0.85) 330deg,rgba(255,130,40,0) 360deg)'
export const GA_LINES = 'repeating-radial-gradient(closest-side,rgba(255,236,200,0) 0%,rgba(255,236,200,0.9) 1.6%,rgba(255,236,200,0) 3.4%,rgba(255,236,200,0) 6%)'

// The picture: 641 px wide, the hole's centre at its middle. Its dark centre is about 8.6% of the
// width across (a radius of 27.8% of the width at 324%): the photo's radius is 0.5 of the frame's
// size, and the frame box is 1.8× the photo, so the hole's radius lands on the photo's edge.
const HOLE_IMG = 'url(garg/blackhole.jpg)'
const holeBox = (inset: string) =>
  `position:absolute;inset:${inset};border-radius:50%;overflow:hidden;background-image:${HOLE_IMG};background-repeat:no-repeat;background-position:center;background-size:270% auto`

export const GARG_AVATAR: { before: string; after: string } = {
  before: `<div style="${holeBox('-40%')}"></div>`,
  after: '',
}

// The 이름표: the hole sits at the right, 150% of the plate's height across, the name over its dark
// left side. Sizes in cqh (the plate is the container).
const PLATE_HOLE =
  `<div style="position:absolute;top:50%;left:calc(100% - 40cqh);width:150cqh;height:150cqh;margin:-75cqh 0 0 -75cqh"><div style="${holeBox('0')}"></div></div>`
const PLATE_SPECKS = (() => {
  let seed = 29
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  let out = ''
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
