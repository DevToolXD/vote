// Service worker: "install app" on Android Chrome, push notifications, and a cache so the app opens fast on a
// slow connection and uses little data:
//   · the app's own files with a hash in their name (assets/…) never change: kept, and read from the phone first
//   · pictures and fonts that don't have a hash (garg/, art/, skins/, icons/) are read from the phone first and
//     refreshed in the background
//   · the page itself (index.html) always asks the network first (so a new deploy shows up at once), and on a
//     bad connection falls back to the copy it has after 3 seconds
// Firebase, YouTube and everything else from other addresses is never touched.
const VERSION = 'v1'
const ASSETS = 'assets-' + VERSION, PICS = 'pics-' + VERSION, PAGE = 'page-' + VERSION
const MAX_ASSETS = 160

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (![ASSETS, PICS, PAGE].includes(k)) await caches.delete(k)
  await self.clients.claim()
})()))

const same = url => url.origin === self.location.origin
const within = url => url.pathname.slice(new URL(self.registration.scope).pathname.length)

async function cacheFirst(req, name, limit) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) {
    cache.put(req, res.clone()).then(async () => {
      if (!limit) return
      const keys = await cache.keys()
      for (const k of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(k)
    }).catch(() => {})
  }
  return res
}
async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res })
  if (hit) { fresh.catch(() => {}); return hit }
  return fresh
}
async function networkFirst(req, name, ms) {
  const cache = await caches.open(name)
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res })
  const hit = await cache.match(req)
  if (!hit) return net
  // a copy exists: the network gets `ms` to answer, then the copy is shown (the network still fills the cache)
  net.catch(() => {})
  return Promise.race([net, new Promise(ok => setTimeout(() => ok(hit), ms))]).catch(() => hit)
}

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (!same(url)) return
  // a request that asked for no caching (the update check in main.tsx) goes straight to the network
  if (req.cache === 'no-store' || req.cache === 'reload') return
  const path = within(url)
  if (path.startsWith('assets/')) { e.respondWith(cacheFirst(req, ASSETS, MAX_ASSETS)); return }
  if (/^(garg|art|skins|icons|dino)\//.test(path)) { e.respondWith(staleWhileRevalidate(req, PICS)); return }
  if (req.mode === 'navigate' || path === '' || path === 'index.html') { e.respondWith(networkFirst(req, PAGE, 3000)); return }
})

// Push from Firebase Cloud Messaging (sent by .github/scripts/send-notifications.mjs
// as a data message: { title, body, url, tag }). Every push must show a
// notification (iOS requires it), so there's always a fallback title.
self.addEventListener('push', e => {
  let payload = {}
  try { payload = e.data ? e.data.json() : {} } catch { payload = {} }
  const d = payload.data || payload.notification || {}
  e.waitUntil(self.registration.showNotification(d.title || '인기투표', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    // sound + vibration unless 알림 소리 is off (the sender adds silent: '1')
    silent: d.silent === '1',
    ...(d.silent === '1' ? {} : { vibrate: [120, 60, 120] }),
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: d.url || './' },
  }))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) { await w.focus(); w.navigate?.(target); return }
    }
    await self.clients.openWindow(target)
  })())
})
