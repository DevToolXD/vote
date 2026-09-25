// Service worker: lets Android Chrome offer "install app" and shows push
// notifications. It caches nothing on purpose: every request goes to the
// network, so the home-screen app always shows the latest deploy.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)))

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
