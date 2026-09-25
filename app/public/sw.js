// Minimal service worker so Android Chrome offers "install app". It caches
// nothing on purpose: every request goes to the network, so the home-screen
// app always shows the latest deploy, same as the site.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)))
