/// <reference lib="webworker" />
/* eslint-env worker */
/* global ServiceWorkerGlobalScope, ExtendableMessageEvent, FetchEvent */
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// Narrow the global service worker scope for proper typings
const sw = self as unknown as ServiceWorkerGlobalScope

// Precache all build assets (app shell)
// @ts-ignore - __WB_MANIFEST is injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)

// Clean up old caches
cleanupOutdatedCaches()

// Take control immediately
sw.skipWaiting()
clientsClaim()


// Runtime cache: All images (cross-origin and same-origin)
// Cache both external images and any internal image assets
registerRoute(
  ({ request, url }) => {
    const isImage = request.destination === 'image' || 
                    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)
    // Cache all images, not just cross-origin ones
    // This ensures article images from any source get cached
    
    if (isImage) {
      console.log('[sw-image-cache] Intercepting image request:', {
        url: url.href,
        destination: request.destination,
        method: request.method
      })
    }
    
    return isImage
  },
  new StaleWhileRevalidate({
    cacheName: 'boris-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          console.log('[sw-image-cache] Cache key generated for:', request.url)
          return request
        },
        cacheWillUpdate: async ({ response }) => {
          console.log('[sw-image-cache] Caching response:', {
            url: response.url,
            status: response.status,
            type: response.type,
            ok: response.ok
          })
          return response.ok ? response : null
        },
        cachedResponseWillBeUsed: async ({ cachedResponse, request }) => {
          if (cachedResponse) {
            console.log('[sw-image-cache] ✅ Serving from cache:', request.url)
          } else {
            console.log('[sw-image-cache] ❌ No cached response found:', request.url)
          }
          return cachedResponse || null
        }
      }
    ],
  })
)

// Runtime cache: Cross-origin article HTML
// Cache fetched articles for offline reading
registerRoute(
  ({ request, url }) => {
    const accept = request.headers.get('accept') || ''
    const isHTML = accept.includes('text/html')
    const isCrossOrigin = url.origin !== sw.location.origin
    // Exclude relay connections and local URLs
    const isNotRelay = !url.protocol.includes('ws')
    return isHTML && isCrossOrigin && isNotRelay
  },
  new StaleWhileRevalidate({
    cacheName: 'boris-articles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// SPA navigation fallback - serve app shell for navigation requests
// This ensures the app loads offline
const navigationRoute = new NavigationRoute(
  async ({ request }) => {
    try {
      // Try to fetch from network first
      const response = await fetch(request)
      return response
    } catch (error) {
      // If offline, serve the cached app shell
      const cache = await caches.match('/index.html')
      if (cache) {
        return cache
      }
      throw error
    }
  }
)

registerRoute(navigationRoute)

// Listen for messages from the app
sw.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    sw.skipWaiting()
  }
})

// Handle Web Share Target POST requests
sw.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  
  // Handle POST to /share-target (Web Share Target API)
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      const formData = await event.request.formData()
      const title = (formData.get('title') || '').toString()
      const text = (formData.get('text') || '').toString()
      // Accept multiple possible field names just in case different casings are used
      let link = (
        formData.get('link') ||
        formData.get('Link') ||
        formData.get('url') ||
        ''
      ).toString()
      
      // Android often omits url param, extract from text
      if (!link && text) {
        const urlMatch = text.match(/https?:\/\/[^\s]+/)
        if (urlMatch) {
          link = urlMatch[0]
        }
      }
      
      const queryParams = new URLSearchParams()
      if (link) queryParams.set('link', link)
      if (title) queryParams.set('title', title)
      if (text) queryParams.set('text', text)
      
      return Response.redirect(`/share-target?${queryParams.toString()}`, 303)
    })())
    return
  }
  
  // Don't interfere with WebSocket connections (relay traffic)
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return
  }
})

