import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import type { Tab } from './data'
import './styles.css'
import './install'

// Preview options mirror the design tool's controls: ?tab=rank&palette=swap
const params = new URLSearchParams(location.search)
const tab = params.get('tab')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      startTab={tab === 'acct' || tab === 'rank' ? (tab as Tab) : 'home'}
      swapPalette={params.get('palette') === 'swap'}
    />
  </StrictMode>,
)

// Needed for Android Chrome's install prompt; the worker itself caches nothing (see public/sw.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}) })
}

// Remote updates: the Galaxy APK and the iPhone home-screen app both load this site, so a
// deploy updates them too. When the app comes back to the foreground, compare the deployed
// index.html's bundle with the one running and reload onto the new version if it changed.
if (import.meta.env.PROD) {
  const bundleOf = (html: string) => html.match(/<script[^>]+src="([^"]*assets\/index-[^"]+\.js)"/)?.[1]
  const running = bundleOf(document.documentElement.outerHTML)
  let last = 0
  const check = async () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < 60_000 || !running) return
    last = Date.now()
    try {
      const html = await (await fetch('./index.html', { cache: 'no-store' })).text()
      const deployed = bundleOf(html)
      if (deployed && deployed !== running) location.reload()
    } catch { /* offline — try again next time */ }
  }
  document.addEventListener('visibilitychange', check)
  setInterval(check, 5 * 60_000)
}
