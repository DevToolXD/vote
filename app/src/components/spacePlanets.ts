// The planets of 인터스텔라: noise on a sphere, painted once into a picture per planet (a few rows a frame, so no frame is held up).
// Sizes are real (a moon 1 700 km across its radius ... Jupiter 70 000 km): a world unit is a metre.

export type Kind = 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'neptune' | 'hole'
  | 'mercury' | 'venus' | 'io' | 'europa' | 'titan' | 'pluto' | 'lava' | 'ocean' | 'desert' | 'jungle' | 'ice' | 'uranus' | 'pink'

/** Radius in metres. */
export const KIND_RADIUS: Record<Kind, [number, number]> = {
  moon: [1.5e6, 2.0e6], mars: [3.2e6, 3.6e6], earth: [6.2e6, 6.6e6],
  neptune: [2.3e7, 2.6e7], jupiter: [6.6e7, 7.2e7], saturn: [5.6e7, 6.2e7], hole: [5.5e7, 6.5e7],
  mercury: [2.3e6, 2.6e6], venus: [5.8e6, 6.2e6], io: [1.7e6, 1.9e6], europa: [1.4e6, 1.7e6], titan: [2.5e6, 2.8e6], pluto: [1.1e6, 1.3e6],
  lava: [4.5e6, 5.5e6], ocean: [5.5e6, 6.5e6], desert: [5.0e6, 6.0e6], jungle: [6.0e6, 7.0e6], ice: [4.0e6, 5.0e6],
  uranus: [2.4e7, 2.6e7], pink: [3.0e7, 5.0e7],
}
/** Worlds with a surface to land on (not the gas giants, not a hole). */
export const LANDABLE: Partial<Record<Kind, true>> = { moon: true, mars: true, earth: true, mercury: true, venus: true, io: true, europa: true, titan: true, pluto: true, lava: true, ocean: true, desert: true, jungle: true, ice: true }
/** The colour of a planet's air at its edge (r, g, b), or null for none. */
export const ATMOSPHERE: Record<Kind, string | null> = { earth: '110,170,255', moon: null, mars: '230,150,100', jupiter: '230,205,170', saturn: '235,215,170', neptune: '110,150,255', hole: null,
  mercury: null, venus: '240,210,140', io: null, europa: null, titan: '230,160,60', pluto: null, lava: '255,110,40', ocean: '120,180,255', desert: '240,190,130', jungle: '130,220,170', ice: '200,230,255', uranus: '150,230,235', pink: '240,170,210' }
/** Saturn's rings, as fractions of the planet's radius: [from, to, opacity]. */
export const SATURN_RINGS: [number, number, number][] = [
  [1.24, 1.38, 0.1], [1.38, 1.52, 0.22], [1.52, 1.66, 0.62], [1.66, 1.8, 0.82], [1.8, 1.95, 0.7],
  [1.95, 2.03, 0.04], [2.03, 2.12, 0.5], [2.12, 2.21, 0.42], [2.21, 2.27, 0.3],
]

// ---- seeded random and noise ----

export function rngOf(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export function hash3(a: number, b: number, c: number) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = smooth(0, 1, x - xi), yf = smooth(0, 1, y - yi), zf = smooth(0, 1, z - zi)
  return lerp(
    lerp(lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf), lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf), yf),
    lerp(lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf), lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf), yf), zf)
}
export function fbm(x: number, y: number, z: number, oct = 4) {
  let a = 0, f = 1, s = 0.5, tot = 0
  for (let i = 0; i < oct; i++) { a += s * vnoise(x * f, y * f, z * f); tot += s; f *= 2; s *= 0.5 }
  return a / tot
}
export type RGB = [number, number, number]
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Craters at one scale: a factor on the brightness, dark on a crater's floor, bright on its rim. */
function craters(X: number, Y: number, Z: number, scale: number, off: number) {
  const px = X * scale + off, py = Y * scale, pz = Z * scale
  const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz)
  let m = 1
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const a = cx + i, b = cy + j, c = cz + k
    if (hash3(a * 3 + 1, b * 7 + 2, c * 5 + 3) > 0.5) continue
    const ox = a + hash3(a + 17, b, c), oy = b + hash3(a, b + 31, c), oz = c + hash3(a, b, c + 53)
    const r = 0.2 + 0.3 * hash3(a + 9, b + 4, c + 1)
    const d = Math.hypot(px - ox, py - oy, pz - oz)
    if (d >= r) continue
    const t = d / r
    m *= t < 0.8 ? 0.78 + 0.12 * (t / 0.8) : 1 + 0.26 * (1 - (t - 0.8) / 0.2)
  }
  return m
}

// ---- the surface of each kind: a colour for a point (X, Y, Z) on the unit sphere (Y up) ----

function surface(kind: Kind, seed: number): (X: number, Y: number, Z: number) => RGB {
  const rnd = rngOf(seed), o = rnd() * 40, o2 = rnd() * 40
  if (kind === 'earth') {
    return (X, Y, Z) => {
      const warp = fbm(X * 1.5 + o, Y * 1.5, Z * 1.5, 3)
      const h = fbm(X * 2.1 + warp * 0.9 + o, Y * 2.1 + warp, Z * 2.1, 6)
      const lat = Math.abs(Y)
      let c: RGB
      if (h < 0.52) {
        c = mix([4, 28, 84], [18, 96, 170], clamp01((0.52 - h) * 3.2)) // deep to shallow
        c = mix([22, 112, 168], c, smooth(0.0, 0.07, 0.52 - h)) // pale water at the shore
      } else {
        const moist = fbm(X * 3 + o2, Y * 3, Z * 3, 4)
        c = lat < 0.62 && moist < 0.44 ? mix([196, 170, 110], [150, 120, 80], moist * 2) : mix([40, 98, 46], [96, 122, 62], clamp01(lat * 1.4 + (moist - 0.4)))
        c = mix(c, [124, 110, 96], smooth(0.64, 0.74, h)) // mountains
        c = mix(c, [244, 246, 250], smooth(0.76, 0.84, h))
      }
      c = mix(c, [246, 249, 253], smooth(0.86, 0.93, lat + (fbm(X * 4, Y * 4, Z * 4 + o, 2) - 0.5) * 0.1)) // polar ice
      // clouds in swirls and bands
      const cl = fbm(X * 3.0 + o2 + warp * 0.7, Y * 5.0 + warp * 0.5, Z * 3.0, 5)
      const dens = smooth(0.5, 0.72, cl) * (0.55 + 0.45 * Math.sin(Y * 6 + warp * 6))
      return mix(c, [252, 252, 255], clamp01(dens) * 0.92)
    }
  }
  if (kind === 'moon') {
    return (X, Y, Z) => {
      const base = 0.78 + 0.22 * fbm(X * 6 + o, Y * 6, Z * 6, 4)
      const mare = smooth(0.52, 0.6, fbm(X * 1.4 + o2, Y * 1.4, Z * 1.4, 4))
      let v = base * lerp(1, 0.55, mare)
      v *= craters(X, Y, Z, 5, o) * craters(X, Y, Z, 12, o2) * (0.9 + 0.1 * craters(X, Y, Z, 28, o))
      const g = 168 * v
      return [g * 1.02, g, g * 0.96]
    }
  }
  if (kind === 'mars') {
    return (X, Y, Z) => {
      const f = fbm(X * 2.4 + o, Y * 2.4, Z * 2.4, 6)
      let c = mix([178, 96, 54], [208, 142, 92], f)
      c = mix(c, [92, 52, 38], smooth(0.5, 0.64, fbm(X * 1.5 + o2, Y * 1.5, Z * 1.5, 4)) * 0.8) // dark plains
      const cr = craters(X, Y, Z, 9, o)
      c = [c[0] * (0.5 + 0.5 * cr), c[1] * (0.5 + 0.5 * cr), c[2] * (0.5 + 0.5 * cr)]
      return mix(c, [244, 240, 236], smooth(0.9, 0.96, Math.abs(Y) + (f - 0.5) * 0.08))
    }
  }
  if (kind === 'jupiter') {
    const spot = { x: 0.3, y: -0.3, lon: Math.atan2(0.3, 0.9) }
    const stops: RGB[] = [[236, 222, 192], [206, 168, 120], [150, 100, 66], [246, 238, 226]]
    return (X, Y, Z) => {
      const turb = fbm(X * 7 + o, Y * 34, Z * 7, 4)
      const b = 0.5 + 0.5 * Math.sin(Y * 24 + 2.2 * fbm(X * 2.4 + o, Y * 7, Z * 2.4, 3) + (turb - 0.5) * 2.4)
      const t = b * 3, i = Math.min(2, Math.floor(t))
      let c = mix(stops[i], stops[i + 1], t - i)
      c = mix(c, [188, 150, 112], 0.25 * smooth(0.45, 0.62, turb))
      // the great red spot: an oval that turns the bands round it
      const dl = Math.atan2(X, Z) - spot.lon, dy = Y - spot.y
      const e = (dl / 0.3) ** 2 + (dy / 0.1) ** 2
      if (e < 1) c = mix(c, mix([188, 74, 46], [214, 120, 80], fbm(X * 12, Y * 12, Z * 12, 3)), smooth(1, 0.3, e) * 0.9)
      return c
    }
  }
  if (kind === 'saturn') {
    return (X, Y, Z) => {
      const b = 0.5 + 0.5 * Math.sin(Y * 18 + 1.6 * fbm(X * 2 + o, Y * 5, Z * 2, 3))
      const turb = fbm(X * 6 + o2, Y * 26, Z * 6, 3)
      return mix(mix([226, 205, 156], [196, 168, 118], b), [238, 222, 184], smooth(0.5, 0.7, turb) * 0.5)
    }
  }
  if (kind === 'mercury') {
    return (X, Y, Z) => {
      let v = (0.74 + 0.26 * fbm(X * 7 + o, Y * 7, Z * 7, 4)) * craters(X, Y, Z, 4, o) * craters(X, Y, Z, 10, o2) * craters(X, Y, Z, 24, o)
      v *= lerp(1, 0.7, smooth(0.5, 0.6, fbm(X * 2 + o2, Y * 2, Z * 2, 3)))
      const g = 150 * v
      return [g * 1.06, g * 0.98, g * 0.9]
    }
  }
  if (kind === 'venus') {
    return (X, Y, Z) => {
      const w = fbm(X * 2 + o, Y * 3, Z * 2, 3)
      const sw = fbm(X * 3 + w * 1.6 + o2, Y * 6 + Math.sin(Y * 9 + w * 5) * 0.4, Z * 3 + w * 1.6, 5)
      return mix(mix([208, 162, 84], [248, 226, 164], sw), [176, 130, 70], smooth(0.62, 0.8, fbm(X * 8, Y * 14, Z * 8 + o, 3)) * 0.5)
    }
  }
  if (kind === 'io') {
    return (X, Y, Z) => {
      let c = mix([228, 196, 66], [240, 226, 130], fbm(X * 4 + o, Y * 4, Z * 4, 4))
      c = mix(c, [206, 104, 36], smooth(0.5, 0.66, fbm(X * 3 + o2, Y * 3, Z * 3, 4)) * 0.8)
      c = mix(c, [244, 244, 236], smooth(0.64, 0.74, fbm(X * 5 + o, Y * 5 + 7, Z * 5, 3)) * 0.7)
      return mix(c, [36, 28, 24], smooth(0.74, 0.78, fbm(X * 11 + o2, Y * 11, Z * 11, 2)) * 0.95) // dark volcanic spots
    }
  }
  if (kind === 'europa') {
    return (X, Y, Z) => {
      let c = mix([214, 224, 234], [238, 242, 246], fbm(X * 5 + o, Y * 5, Z * 5, 4))
      c = mix(c, [190, 206, 226], smooth(0.5, 0.65, fbm(X * 2 + o2, Y * 2, Z * 2, 3)) * 0.6)
      const crack = Math.abs(fbm(X * 6 + o, Y * 6, Z * 6, 3) - 0.5) < 0.014 || Math.abs(fbm(X * 9 + o2, Y * 9, Z * 9, 3) - 0.5) < 0.01
      return crack ? [150, 98, 70] : c
    }
  }
  if (kind === 'titan') {
    return (X, Y, Z) => {
      const b = 0.5 + 0.5 * Math.sin(Y * 8 + fbm(X * 2 + o, Y * 3, Z * 2, 3) * 2)
      return mix(mix([196, 124, 40], [236, 178, 84], fbm(X * 3 + o2, Y * 4, Z * 3, 5)), [150, 90, 36], b * 0.35)
    }
  }
  if (kind === 'pluto') {
    return (X, Y, Z) => {
      let c = mix([200, 172, 140], [120, 88, 68], smooth(0.4, 0.7, fbm(X * 3 + o, Y * 3, Z * 3, 5)))
      const e = ((X - 0.45) / 0.45) ** 2 + (Y / 0.4) ** 2 + (Z < 0 ? 4 : 0)
      if (e < 1) c = mix(c, [246, 238, 230], smooth(1, 0.3, e))
      return mix(c, [0.8 * c[0], 0.8 * c[1], 0.8 * c[2]], 1 - craters(X, Y, Z, 14, o))
    }
  }
  if (kind === 'lava') {
    return (X, Y, Z) => {
      const crust = mix([20, 16, 16], [70, 54, 48], fbm(X * 5 + o, Y * 5, Z * 5, 5))
      const r = Math.min(Math.abs(fbm(X * 3.5 + o, Y * 3.5, Z * 3.5, 4) - 0.5), Math.abs(fbm(X * 7 + o2, Y * 7, Z * 7, 3) - 0.5) * 1.6)
      const glow = smooth(0.05, 0, r)
      return mix(crust, mix([255, 70, 10], [255, 190, 70], glow), glow)
    }
  }
  if (kind === 'ocean') {
    return (X, Y, Z) => {
      const waves = fbm(X * 22 + o, Y * 22, Z * 22, 3)
      let c = mix([6, 40, 100], [34, 112, 168], fbm(X * 3 + o2, Y * 3, Z * 3, 4))
      c = mix(c, [210, 232, 248], smooth(0.64, 0.8, waves) * 0.6)
      return mix(c, [252, 252, 255], smooth(0.66, 0.8, fbm(X * 3 + o, Y * 6, Z * 3 + o2, 4)) * 0.5)
    }
  }
  if (kind === 'desert') {
    return (X, Y, Z) => {
      const dune = 0.5 + 0.5 * Math.sin((X * 1.3 + Z * 0.7) * 22 + fbm(X * 3 + o, Y * 3, Z * 3, 4) * 8)
      let c = mix([200, 142, 84], [240, 200, 130], dune * 0.7 + 0.3 * fbm(X * 6 + o2, Y * 6, Z * 6, 3))
      c = mix(c, [112, 70, 48], smooth(0.56, 0.7, fbm(X * 2.2 + o2, Y * 2.2, Z * 2.2, 5)) * 0.85)
      return mix(c, [246, 240, 232], smooth(0.92, 0.97, Math.abs(Y)))
    }
  }
  if (kind === 'jungle') {
    return (X, Y, Z) => {
      const warp = fbm(X * 1.5 + o, Y * 1.5, Z * 1.5, 3)
      const h = fbm(X * 2 + warp * 0.9 + o, Y * 2 + warp, Z * 2, 6)
      let c: RGB
      if (h < 0.4) c = mix([6, 70, 96], [30, 150, 160], clamp01((0.4 - h) * 3))
      else {
        c = mix([22, 100, 48], [86, 160, 70], fbm(X * 6 + o2, Y * 6, Z * 6, 4))
        c = mix(c, [120, 100, 70], smooth(0.66, 0.74, h))
        c = mix(c, [236, 240, 244], smooth(0.78, 0.84, h))
      }
      const cl = smooth(0.58, 0.76, fbm(X * 3 + o2 + warp, Y * 5, Z * 3, 5))
      return mix(c, [250, 252, 252], cl * 0.7)
    }
  }
  if (kind === 'ice') {
    return (X, Y, Z) => {
      let c = mix([214, 230, 246], [246, 250, 255], fbm(X * 4 + o, Y * 4, Z * 4, 5))
      c = mix(c, [130, 176, 226], smooth(0.5, 0.7, fbm(X * 2 + o2, Y * 2, Z * 2, 4)) * 0.75)
      c = mix(c, [86, 130, 196], smooth(0.012, 0, Math.abs(fbm(X * 7 + o, Y * 7, Z * 7, 3) - 0.5)) * 0.8)
      return [c[0] * craters(X, Y, Z, 9, o), c[1] * craters(X, Y, Z, 9, o), c[2] * craters(X, Y, Z, 9, o)]
    }
  }
  if (kind === 'uranus') {
    return (X, Y, Z) => {
      const b = 0.5 + 0.5 * Math.sin(Y * 9 + fbm(X * 2 + o, Y * 3, Z * 2, 3))
      return mix(mix([126, 206, 216], [170, 232, 236], b * 0.6 + 0.4 * fbm(X * 3 + o2, Y * 12, Z * 3, 3)), [214, 246, 246], smooth(0.7, 0.95, Y) * 0.5)
    }
  }
  if (kind === 'pink') {
    const stops: RGB[] = [[244, 214, 224], [214, 140, 184], [130, 80, 146], [248, 236, 238]]
    return (X, Y, Z) => {
      const turb = fbm(X * 6 + o, Y * 30, Z * 6, 4)
      const b = 0.5 + 0.5 * Math.sin(Y * 20 + 3 * fbm(X * 2.2 + o2, Y * 6, Z * 2.2, 4) + (turb - 0.5) * 3)
      const t = b * 3, i = Math.min(2, Math.floor(t))
      return mix(stops[i], stops[i + 1], t - i)
    }
  }
  // neptune: deep blue with bands, faint streaks of cloud and a dark storm
  return (X, Y, Z) => {
    const b = 0.5 + 0.5 * Math.sin(Y * 12 + 1.2 * fbm(X * 2 + o, Y * 4, Z * 2, 3))
    let c = mix([30, 64, 176], [74, 120, 220], b)
    const streak = smooth(0.62, 0.78, fbm(X * 3 + o2, Y * 16, Z * 3, 4))
    c = mix(c, [226, 236, 252], streak * 0.55)
    const dl = Math.atan2(X, Z) - 0.5, dy = Y + 0.28
    const e = (dl / 0.28) ** 2 + (dy / 0.12) ** 2
    return e < 1 ? mix(c, [14, 28, 96], smooth(1, 0.4, e) * 0.85) : c
  }
}

/** A planet's picture, painted a few rows at a time. */
export type Sprite = { cv: HTMLCanvasElement; done: boolean; avg: RGB; step(ms: number): void }

export function planetSprite(kind: Kind, seed: number, N = 256): Sprite {
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const cx = cv.getContext('2d')
  const img = cx?.createImageData(N, N)
  const f = surface(kind, seed)
  const tr = rngOf(seed + 99), tint: RGB = [0.9 + 0.2 * tr(), 0.9 + 0.2 * tr(), 0.9 + 0.2 * tr()] // every world a little its own colour
  let row = 0, n = 0
  const sum: RGB = [0, 0, 0]
  const sp: Sprite = {
    cv, done: !cx || !img, avg: [120, 120, 120],
    step(ms) {
      if (sp.done || !cx || !img) return
      const t0 = performance.now(), d = img.data
      while (row < N && performance.now() - t0 < ms) {
        for (let px = 0; px < N; px++) {
          const nx = ((px + 0.5) / N) * 2 - 1, ny = ((row + 0.5) / N) * 2 - 1, rr = nx * nx + ny * ny
          if (rr > 1) continue
          const nz = Math.sqrt(1 - rr)
          const c = f(nx, -ny, nz)
          c[0] *= tint[0]; c[1] *= tint[1]; c[2] *= tint[2]
          sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2]; n++
          // limb darkening: the edge is a little darker
          const limb = 0.62 + 0.38 * Math.pow(nz, 0.55)
          const a = clamp01((1 - Math.sqrt(rr)) * N * 0.5)
          const i = (row * N + px) * 4
          d[i] = c[0] * limb; d[i + 1] = c[1] * limb; d[i + 2] = c[2] * limb; d[i + 3] = a * 255
        }
        row++
      }
      if (row >= N) { cx.putImageData(img, 0, 0); sp.avg = n ? [sum[0] / n, sum[1] / n, sum[2] / n] : sp.avg; sp.done = true }
    },
  }
  return sp
}
