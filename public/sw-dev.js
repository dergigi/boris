// Development Service Worker - simplified version for testing image caching
// This is served in dev mode when vite-plugin-pwa doesn't serve the injectManifest SW

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Image caching - simple version for dev testing
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const isImage = event.request.destination === 'image' || 
                  /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)
  
  if (isImage) {
    event.respondWith(
      caches.open('boris-images-dev').then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Try to fetch from network
          return fetch(event.request).then((response) => {
            // If fetch succeeds, cache it and return
            if (response.ok) {
              cache.put(event.request, response.clone()).catch(() => {
                // Ignore cache put errors
              })
            }
            return response
          }).catch((error) => {
            // If fetch fails (network error, CORS, etc.), return cached response if available
            if (cachedResponse) {
              return cachedResponse
            }
            // No cache available, reject the promise so browser handles it
            return Promise.reject(error)
          })
        })
      }).catch(() => {
        // If cache operations fail, try to fetch directly without caching
        return fetch(event.request)
      })
    )
  }
})

