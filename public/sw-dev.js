// Development Service Worker - simplified version for testing image caching
// This is served in dev mode when vite-plugin-pwa doesn't serve the injectManifest SW

console.log('[sw-dev] Development Service Worker loaded')

self.addEventListener('install', (event) => {
  console.log('[sw-dev] Installing...')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[sw-dev] Activating...')
  event.waitUntil(clients.claim())
})

// Image caching - simple version for dev testing
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const isImage = event.request.destination === 'image' || 
                  /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)
  
  if (isImage) {
    console.log('[sw-dev] Intercepting image:', url.href)
    
    event.respondWith(
      caches.open('boris-images-dev').then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[sw-dev] ✅ Serving from cache:', url.href)
            return cachedResponse
          }
          
          console.log('[sw-dev] Fetching from network:', url.href)
          return fetch(event.request).then((response) => {
            if (response.ok) {
              console.log('[sw-dev] Caching response:', url.href)
              cache.put(event.request, response.clone())
            }
            return response
          }).catch((err) => {
            console.error('[sw-dev] Fetch failed:', url.href, err)
            throw err
          })
        })
      })
    )
  }
})

console.log('[sw-dev] Development Service Worker ready')

