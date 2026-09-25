import type { CSSProperties } from 'react'

const cache = new Map<string, CSSProperties>()

/**
 * Turns an inline CSS declaration string into a React style object.
 * Lets the static styles stay byte-for-byte identical to the design prototype;
 * results are cached so repeated renders don't re-parse.
 */
export function css(src: string): CSSProperties {
  const hit = cache.get(src)
  if (hit) return hit
  const out: Record<string, string> = {}
  let depth = 0
  let start = 0
  const decls: string[] = []
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ';' && depth === 0) {
      decls.push(src.slice(start, i))
      start = i + 1
    }
  }
  decls.push(src.slice(start))
  for (const d of decls) {
    const idx = d.indexOf(':')
    if (idx < 0) continue
    const prop = d.slice(0, idx).trim()
    const value = d.slice(idx + 1).trim()
    if (!prop) continue
    const key = prop.startsWith('--')
      ? prop
      : prop.replace(/^-webkit-/, 'Webkit-').replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())
    out[key] = value
  }
  cache.set(src, out as CSSProperties)
  return out as CSSProperties
}

/** css() plus dynamic overrides. */
export function sx(src: string, extra?: CSSProperties): CSSProperties {
  return extra ? { ...css(src), ...extra } : css(src)
}
