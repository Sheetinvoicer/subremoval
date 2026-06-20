const CACHE_NAME = 'sheetinvoicer-v1'
const urlsToCache = ['/', '/dashboard', '/dashboard/invoices', '/dashboard/clients']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)))
})

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)))
})
