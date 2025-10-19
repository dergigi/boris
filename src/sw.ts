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


// Runtime cache: Cross-origin images
// This preserves the existing image caching behavior
registerRoute(
  ({ request, url }) => {
    const isImage = request.destination === 'image' || 
                    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)
    return isImage && url.origin !== sw.location.origin
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

// Log fetch errors for debugging (doesn't affect functionality)
sw.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  
  // Don't interfere with WebSocket connections (relay traffic)
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return
  }
})

