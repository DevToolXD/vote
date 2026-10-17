import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { slowNet } from '../net'

const EASE = 'cubic-bezier(0.22,1,0.36,1)'
const scroller = (el: HTMLElement | null) => {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if (o === 'auto' || o === 'scroll') return p
  }
  return null
}

/**
 * True once the element is within `margin` px of the visible part of its scrolling list (below it or above it): what
 * is about to come into view gets loaded a little early, so it is already there when it arrives. (The margin is
 * set on the list itself: a margin on the page would not reach past a list's own edge.)
 */
export function useNear(ref: RefObject<HTMLElement | null>, margin = 900) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return }
    // on a slow or metered connection only what is about to show is fetched (a third of the usual lead)
    const m = slowNet() ? Math.round(margin / 3) : margin
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setNear(true); io.disconnect() } }, { root: scroller(el), rootMargin: `${m}px 0px ${m}px 0px` })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, near, margin])
  return near
}

/** A picture that loads when it is a screen away, is decoded before it shows, and then fades in. */
export function LazyImg({ src, style, alt = '', margin = 900, onClick }: { src: string; style: CSSProperties; alt?: string; margin?: number; onClick?: () => void }) {
  const ref = useRef<HTMLImageElement>(null)
  const near = useNear(ref, margin)
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(false) }, [src])
  useEffect(() => {
    const img = ref.current
    if (!near || !img) return
    let live = true
    // decode first (off the main thread), so the picture doesn't hitch the scroll when it shows
    img.decode?.().then(() => { if (live) setReady(true) }, () => { if (live) setReady(true) })
    return () => { live = false }
  }, [near, src])
  return <img ref={ref} src={near ? src : undefined} alt={alt} decoding="async" draggable={false} onLoad={() => setReady(true)} onClick={onClick} style={{ ...style, opacity: ready ? 1 : 0, transition: `opacity 320ms ${EASE}` }} />
}
