const CACHE_NAME = 'arsuna-v2'
const APP_SHELL = [
  './',
  'manifest.webmanifest',
  'logo-arsuna.png',
  'icon-192.png',
  'icon-512.png',
].map((path) => new URL(path, self.registration.scope).toString())

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseCopy = response.clone()

        if (new URL(request.url).origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy))
        }

        return response
      })
      .catch(() =>
        caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }

          if (request.mode === 'navigate') {
            return caches.match(new URL('./', self.registration.scope).toString())
          }

          return Response.error()
        }),
      ),
  )
})
