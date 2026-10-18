// Paints a world's picture (as a map of its whole surface, longitude across and latitude down) off the page's own thread.
import { LANDABLE, surfaceTinted } from './spacePlanets'
import type { Kind } from './spacePlanets'

type Job = { id: number; kind: Kind; seed: number; w: number; h: number }
const ctx = self as unknown as { onmessage: ((e: MessageEvent<Job>) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void }
ctx.onmessage = e => {
  const { id, kind, seed, w, h } = e.data
  const f = surfaceTinted(kind, seed)
  const buf = new Uint8ClampedArray(w * h * 4)
  let r = 0, g = 0, b = 0, n = 0
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat)
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w - 0.5) * 2 * Math.PI
      const c = f(cl * Math.sin(lon), sl, cl * Math.cos(lon))
      const i = (y * w + x) * 4
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255
      r += c[0] * cl; g += c[1] * cl; b += c[2] * cl; n += cl
    }
  }
  if (LANDABLE[kind] && kind !== 'venus' && kind !== 'titan') {
    // relief: the lightness taken as height and lit from one side, so craters, ridges and cracks stand out of the surface
    const L = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) L[i] = buf[i * 4] * 0.3 + buf[i * 4 + 1] * 0.59 + buf[i * 4 + 2] * 0.11
    for (let y = 1; y < h - 1; y++) for (let x = 0; x < w; x++) {
      const xl = (x + w - 1) % w, xr = (x + 1) % w
      const rel = (L[(y - 1) * w + xl] - L[(y + 1) * w + xr]) * 0.012
      const k = 1 + Math.max(-0.28, Math.min(0.28, rel))
      const i = (y * w + x) * 4
      buf[i] *= k; buf[i + 1] *= k; buf[i + 2] *= k
    }
  }
  ctx.postMessage({ id, buf: buf.buffer, avg: [r / n, g / n, b / n] }, [buf.buffer])
}
