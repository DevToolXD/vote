// Paints a world's picture (as a map of its whole surface, longitude across and latitude down) off the page's own thread.
import { surfaceTinted } from './spacePlanets'
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
  ctx.postMessage({ id, buf: buf.buffer, avg: [r / n, g / n, b / n] }, [buf.buffer])
}
