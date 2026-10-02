// The on-screen keyboard and the visible part of the screen.
// iPhone sometimes doesn't report the keyboard closing (visualViewport keeps the
// shrunken height), which left the chat input floating mid-screen with blank space
// under it. So: with no text field focused there is no keyboard — the full screen
// is used — and every focus change reads the size again once the keyboard has moved.

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'password', 'tel', 'url', 'number', ''])

/** Is a text field focused (so an on-screen keyboard may be open)? */
export function typing() {
  const a = document.activeElement as HTMLElement | null
  if (!a) return false
  if (a.tagName === 'TEXTAREA' || a.isContentEditable) return true
  return a.tagName === 'INPUT' && TEXT_INPUTS.has((a as HTMLInputElement).type)
}

export type View = { top: number; height: number; inset: number }

export function readView(): View {
  if (typeof window === 'undefined') return { top: 0, height: 800, inset: 0 }
  const vv = window.visualViewport
  if (!vv || !typing()) return { top: 0, height: window.innerHeight, inset: 0 }
  return { top: vv.offsetTop, height: vv.height, inset: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) }
}

/** Calls `cb` whenever the visible area may have changed; returns the unsubscribe. */
export function watchView(cb: () => void) {
  const vv = window.visualViewport
  const timers: ReturnType<typeof setTimeout>[] = []
  // the keyboard animates for ~250 ms; iPhone settles the numbers a bit later still
  const soon = () => { cb(); for (const ms of [80, 250, 500, 900]) timers.push(setTimeout(cb, ms)); if (timers.length > 40) timers.splice(0, timers.length - 20) }
  vv?.addEventListener('resize', cb)
  vv?.addEventListener('scroll', cb)
  window.addEventListener('resize', cb)
  window.addEventListener('orientationchange', soon)
  document.addEventListener('focusin', soon)
  document.addEventListener('focusout', soon)
  document.addEventListener('visibilitychange', soon)
  soon()
  return () => {
    timers.forEach(clearTimeout)
    vv?.removeEventListener('resize', cb)
    vv?.removeEventListener('scroll', cb)
    window.removeEventListener('resize', cb)
    window.removeEventListener('orientationchange', soon)
    document.removeEventListener('focusin', soon)
    document.removeEventListener('focusout', soon)
    document.removeEventListener('visibilitychange', soon)
  }
}
