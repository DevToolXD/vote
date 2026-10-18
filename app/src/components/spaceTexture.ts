// A world's map of colours, painted by a worker (or, where there is none, a few rows a frame on the page).
import { surfaceTinted, type Kind, type RGB } from './spacePlanets'

export const TEX_W = 768, TEX_H = 384
export type Tex = { px: Uint32Array | null; avg: RGB; ready: boolean; step?: (ms: number) => void }

const pending = new Map<number, { tex: Tex; kind: Kind; seed: number }>()
let workers: Worker[] | null | undefined, nextId = 1, turn = 0

function pool(): Worker[] | null {
  if (workers !== undefined) return workers
  workers = null
  try {
    if (typeof Worker === 'undefined') return null
    const n = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1))
    const list: Worker[] = []
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./spacePlanetWorker.ts', import.meta.url), { type: 'module' })
      w.onmessage = e => {
        const job = pending.get(e.data.id)
        if (!job) return
        const t = job.tex
        pending.delete(e.data.id)
        t.px = new Uint32Array(e.data.buf)
        t.avg = e.data.avg
        t.ready = true
      }
      w.onerror = () => { // from now on the page paints them itself, the ones asked for already too
        workers = null
        for (const x of list) x.terminate()
        for (const job of pending.values()) paintHere(job.tex, job.kind, job.seed)
        pending.clear()
      }
      list.push(w)
    }
    workers = list
  } catch { workers = null }
  return workers
}

/** Asks for a world's map: it is `ready` when it has come back. */
export function requestTexture(kind: Kind, seed: number): Tex {
  const tex: Tex = { px: null, avg: [110, 110, 116], ready: false }
  const p = pool()
  if (p) {
    const id = nextId++
    pending.set(id, { tex, kind, seed })
    p[turn++ % p.length].postMessage({ id, kind, seed, w: TEX_W, h: TEX_H })
    return tex
  }
  paintHere(tex, kind, seed)
  return tex
}

/** Paints a map on the page itself, row by row (`tex.step` is called a little each frame). */
function paintHere(tex: Tex, kind: Kind, seed: number) {
  const f = surfaceTinted(kind, seed), px = new Uint32Array(TEX_W * TEX_H)
  let row = 0, r = 0, g = 0, b = 0, n = 0
  tex.step = ms => {
    if (tex.ready) return
    const t0 = performance.now()
    while (row < TEX_H && performance.now() - t0 < ms) {
      const lat = (0.5 - (row + 0.5) / TEX_H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat)
      for (let x = 0; x < TEX_W; x++) {
        const lon = ((x + 0.5) / TEX_W - 0.5) * 2 * Math.PI
        const c = f(cl * Math.sin(lon), sl, cl * Math.cos(lon))
        px[row * TEX_W + x] = 0xff000000 | (Math.min(255, c[2]) << 16) | (Math.min(255, c[1]) << 8) | Math.min(255, c[0])
        r += c[0] * cl; g += c[1] * cl; b += c[2] * cl; n += cl
      }
      row++
    }
    if (row >= TEX_H) { tex.px = px; tex.avg = [r / n, g / n, b / n]; tex.ready = true }
  }
}
