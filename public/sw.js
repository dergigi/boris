// Service Worker for Boris - handles offline image caching
const CACHE_NAME = 'boris-image-cache-v1'

// Install event - activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  self.skipWaiting()
})

// Activate event - take control immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(self.clients.claim())
})

// Fetch event - intercept image requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Only intercept image requests
  const isImage = event.request.destination === 'image' || 
                  /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)
  
  if (!isImage) {
    return // Let other requests pass through
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          console.log('[SW] Serving cached image:', url.pathname)
          return cachedResponse
        }

        // Not in cache, try to fetch
        return fetch(event.request)
          .then(response => {
            // Only cache successful responses
            if (response && response.status === 200) {
              // Clone the response before caching
              cache.put(event.request, response.clone())
              console.log('[SW] Cached new image:', url.pathname)
            }
            return response
          })
          .catch(error => {
            console.error('[SW] Fetch failed for:', url.pathname, error)
            // Return a fallback or let it fail
            throw error
          })
      })
    })
  )
})

