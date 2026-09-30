// Pauses the animations of decorations that are scrolled out of view (shop grids, lists…):
// they keep costing the GPU every frame otherwise. One shared observer for the whole app;
// elements get .anim-off while off screen (styles.css pauses everything inside).

let io: IntersectionObserver | null = null
// Watched elements, so ones that left the page can be let go (the observer keeps them alive otherwise).
const watched = new Set<Element>()
const sweep = () => {
  for (const el of watched) if (!el.isConnected) { io?.unobserve(el); watched.delete(el) }
}
const observer = () => {
  if (io || typeof IntersectionObserver === 'undefined') return io
  io = new IntersectionObserver(entries => {
    for (const e of entries) e.target.classList.toggle('anim-off', !e.isIntersecting)
  }, { rootMargin: '120px' })
  setInterval(sweep, 20_000)
  return io
}

/** A ref callback: pass it as `ref` on the element whose animations should pause off screen. */
export function pauseOffscreen(el: Element | null) {
  const o = observer()
  if (!o || !el || watched.has(el)) return
  watched.add(el)
  o.observe(el)
}
