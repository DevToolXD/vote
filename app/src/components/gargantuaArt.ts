// 가르강튀아: a black hole round the profile photo. The picture is the black hole itself (public/garg/
// blackhole.jpg: the black core, the photon ring, the disk seen at a slant). It sits behind the photo,
// centred on it, so the hole's dark centre is the photo's edge. The disk runs out past the photo and
// is cut to a circle, so the frame stays round.

/** An annulus mask (percent of the box's half size): kept for the bar's tip (TowerSkin). */
export const gaRing = (a: number, b: number) => `radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1}%,#000 ${b - 1}%,transparent ${b}%)`

/** The bar's tip (TowerSkin) draws its own disk from these. */
export const GA_ARCS = 'conic-gradient(from 0deg,rgba(255,130,40,0) 0deg,rgba(255,196,120,0.95) 22deg,rgba(255,250,235,0.95) 38deg,rgba(255,150,60,0.65) 78deg,rgba(255,110,30,0) 130deg,rgba(255,110,30,0) 215deg,rgba(255,140,60,0.4) 250deg,rgba(255,110,30,0) 290deg,rgba(255,226,170,0.85) 330deg,rgba(255,130,40,0) 360deg)'
export const GA_LINES = 'repeating-radial-gradient(closest-side,rgba(255,236,200,0) 0%,rgba(255,236,200,0.9) 1.6%,rgba(255,236,200,0) 3.4%,rgba(255,236,200,0) 6%)'

// The animated picture (public/garg/gargantua.v3.webp, rendered by scripts/gargantua.py: 40 frames, 481×360, transparent): the
// disk turns round the hole while the hole and the photon ring stay still, the dark centre is clear so the
// profile shows through. Its shadow (the photon ring) has a radius of 62 px. The photo is 55 px of it, so the
// profile (radius 0.5 of the frame) is 55 px of the picture, and the picture is scaled to make that true.
const CUT_IMG = 'url(garg/gargantua.v3.webp)'
const PIC_W = 481, PIC_H = 360, PHOTO_PX = 55, BC_PX = 62 // BC_PX: the shadow's edge (the photon ring)
/** The frame's picture: its width and height in frame sizes (--av), so the photo's edge is at 0.5. */
const PIC_W_S = (PIC_W / PHOTO_PX) * 0.5, PIC_H_S = (PIC_H / PHOTO_PX) * 0.5
const cutBox = `position:absolute;left:50%;top:50%;width:calc(var(--av,52px) * ${PIC_W_S.toFixed(3)});height:calc(var(--av,52px) * ${PIC_H_S.toFixed(3)});margin:calc(var(--av,52px) * ${(-PIC_H_S / 2).toFixed(3)}) 0 0 calc(var(--av,52px) * ${(-PIC_W_S / 2).toFixed(3)});pointer-events:none`
// the edges fade out (an elliptical mask), so no hard border shows where the picture ends
const FADE = '' // (the picture fades out by itself)
const cutFrame = `${cutBox};background-image:${CUT_IMG};background-size:100% 100%;background-repeat:no-repeat;${FADE}`
export const GARG_AVATAR: { before: string; after: string } = {
  // the hole's shadow behind the photo: as wide as the picture's (62 px against the photo's 55)
  before: `<div style="position:absolute;left:50%;top:50%;width:calc(var(--av,52px) * 1.127);height:calc(var(--av,52px) * 1.127);margin:calc(var(--av,52px) * -0.5635) 0 0 calc(var(--av,52px) * -0.5635);border-radius:50%;background:#000"></div>`,
  // the disk and the photon ring over the photo, the front of the disk crossing it
  after: `<div style="${cutFrame}"></div>`,
}

// The 이름표: the hole sits at the right. Its photon ring is 40 cqh from the centre (the picture's
// photon ring is 68 px, so the picture is scaled to put it there). Sizes in cqh (the plate is the container).
const PLATE_PX_CQH = 40
const plateW = (PIC_W / BC_PX) * PLATE_PX_CQH, plateH = (PIC_H / BC_PX) * PLATE_PX_CQH
const PLATE_HOLE =
  `<div style="position:absolute;top:50%;left:calc(100% - 40cqh);width:0;height:0">` +
  `<div style="position:absolute;left:${(-plateW / 2).toFixed(2)}cqh;top:${(-plateH / 2).toFixed(2)}cqh;width:${plateW.toFixed(2)}cqh;height:${plateH.toFixed(2)}cqh;background-image:${CUT_IMG};background-size:100% 100%;background-repeat:no-repeat;${FADE}"></div></div>`
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
