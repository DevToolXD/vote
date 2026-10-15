import { useLayoutEffect, type MutableRefObject, type RefObject } from 'react'
import { readView, typing, watchView, type View } from './viewport'

// A full-screen room (a chat) pinned to the visible part of the screen, above the on-screen keyboard.
// The room's size is written straight onto its element, so the keyboard moving never re-renders the
// room (with a long chat that was a heavy render on every step). When the keyboard opens or closes,
// the parts of the room slide to their new place instead of jumping there.
//
// Phones tell a page about the keyboard late, most only once it has finished moving. So where it is
// safe (not iPhone, whose browser moves the page by itself while the keyboard comes up), the room
// starts moving as soon as the input is tapped, by the keyboard height seen last time on this phone,
// and the real number then only corrects it.

const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const KB_KEY = 'vote.kbh'
/** A keyboard is at least this tall; smaller changes are the browser's own bars. */
const KB_MIN = 120
/** Smaller moves than this just happen (no slide). */
const SLIDE_MIN = 40
const SLIDE_MS = 300
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

const kbStore = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(KB_KEY) || '{}') } catch { return {} } }
const screenKey = (full: number) => `${Math.round(window.innerWidth)}x${Math.round(full)}`

/** The vertical offset an element is drawn at right now (in the middle of a slide too). */
function drawnY(el: HTMLElement) {
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return 0
  try { return new DOMMatrixReadOnly(t).m42 } catch { return 0 }
}

type Parts = {
  /** position:fixed; gets top/height, and --kb-safe-top / --kb-safe-bottom (the notch and home-bar room, 0 while the keyboard is open). */
  box: RefObject<HTMLElement>
  /** moves with the room's bottom edge (the input bar) */
  composer: RefObject<HTMLElement>
  /** the message list: slides with the input bar while it follows the newest message */
  list: RefObject<HTMLElement>
  pinned: MutableRefObject<boolean>
}

// Only the bottom edge slides. When the browser moves the page itself (iPhone, while the keyboard
// comes up, and sometimes Android), the room's top follows the visible area in the same frame, so
// the bar at the top stays where it is.
export function useKeyboardRoom({ box, composer, list, pinned }: Parts) {
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    // lock the page behind (opening the keyboard must not scroll whatever is underneath)
    const y = window.scrollY
    const b = document.body.style
    const prev = { position: b.position, top: b.top, width: b.width, overflow: b.overflow }
    Object.assign(b, { position: 'fixed', top: `-${y}px`, width: '100%', overflow: 'hidden' })

    let cur: View = readView()
    let full = cur.inset ? window.innerHeight : cur.height // the height with no keyboard
    let fullW = window.innerWidth
    let predictUntil = 0, predicted = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    const write = (v: View) => {
      el.style.top = `${v.top}px`
      el.style.height = `${v.height}px`
      el.style.setProperty('--kb-safe-top', v.top > 0 ? '0px' : 'env(safe-area-inset-top)')
      el.style.setProperty('--kb-safe-bottom', v.top > 0 || v.height < full - KB_MIN ? '0px' : 'env(safe-area-inset-bottom)')
    }
    const pin = () => { const l = list.current; if (l && pinned.current) l.scrollTop = l.scrollHeight }
    const slideFrom = (p: HTMLElement | null, from: number, ms: number) => {
      if (!p || Math.abs(from) < SLIDE_MIN) return
      p.getAnimations().forEach(a => a.cancel())
      p.animate([{ transform: `translateY(${from}px)` }, { transform: 'translateY(0)' }], { duration: ms, easing: EASE })
    }
    /** Moves the room to `v`. The moving parts start from where they were drawn, so nothing jumps. */
    const go = (v: View, ms = SLIDE_MS) => {
      const dBottom = (v.top + v.height) - (cur.top + cur.height)
      if (v.top === cur.top && v.height === cur.height) return
      const follow = pinned.current
      const c = composer.current, l = follow ? list.current : null
      const at = [c, l].map(p => (p ? drawnY(p) : 0))
      cur = v
      write(v)
      pin()
      slideFrom(c, at[0] - dBottom, ms)
      slideFrom(l, at[1] - dBottom, ms)
      // iPhone sometimes paints the old scroll position after the keyboard moved: pin once more after
      if (Math.abs(dBottom) >= SLIDE_MIN) timers.push(setTimeout(pin, ms + 50))
    }
    const update = () => {
      const v = readView()
      // iPhone sometimes leaves the page scrolled after the keyboard closes; the body is locked, so put it back.
      if (!v.inset && window.scrollY !== 0) window.scrollTo(0, 0)
      if (!typing() && !v.inset) {
        // no keyboard: this is the full height (it can only shrink by turning the phone)
        full = window.innerWidth !== fullW ? v.height : Math.max(full, v.height)
        fullW = window.innerWidth
      } else if (typing() && v.height < full - KB_MIN) {
        // the real keyboard: remember how tall it is for next time (the visible height it leaves; the
        // browser having moved the page doesn't change that)
        const k = Math.round(full - v.height)
        const s = kbStore()
        if (k > KB_MIN && s[screenKey(full)] !== k) { s[screenKey(full)] = k; try { localStorage.setItem(KB_KEY, JSON.stringify(s)) } catch { /* private mode */ } }
      }
      // while the guess is on screen, the phone's not-yet-moved numbers are ignored
      if (Date.now() < predictUntil && typing() && v.height > predicted + SLIDE_MIN) return
      predictUntil = 0
      go(v)
    }
    // Tapping the input: start moving with the keyboard right away (by the height seen last time).
    const onFocusIn = (e: FocusEvent) => {
      if (IOS || !el.contains(e.target as Node) || !typing() || cur.top > 0 || cur.height < full - KB_MIN) return
      const k = kbStore()[screenKey(full)]
      if (!k) return
      predicted = full - k
      predictUntil = Date.now() + 900
      go({ top: 0, height: predicted, inset: k }, 280)
      // no keyboard came after all (a hardware keyboard, a floating one): back to the real size
      timers.push(setTimeout(() => { if (predictUntil) { predictUntil = 0; go(readView()) } }, 950))
    }

    write(cur)
    const stop = watchView(update)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      stop()
      document.removeEventListener('focusin', onFocusIn)
      timers.forEach(clearTimeout)
      Object.assign(b, prev)
      window.scrollTo(0, y)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
