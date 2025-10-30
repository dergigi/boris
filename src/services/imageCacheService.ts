/**
 * Image Cache Service
 * 
 * Utility functions for managing the Service Worker's image cache
 * Service Worker automatically caches images on fetch
 */

// Must match the cache name in src/sw.ts
const CACHE_NAME = 'boris-images'

/**
 * Clear all cached images
 */
export async function clearImageCache(): Promise<void> {
  try {
    await caches.delete(CACHE_NAME)
  } catch (err) {
    console.error('Failed to clear image cache:', err)
  }
}

/**
 * Get cache statistics by inspecting Cache API directly
 */
export async function getImageCacheStatsAsync(): Promise<{
  totalSizeMB: number
  itemCount: number
  items: Array<{ url: string, sizeMB: number }>
}> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const requests = await cache.keys()
    
    let totalSize = 0
    const items: Array<{ url: string, sizeMB: number }> = []
    
    for (const request of requests) {
      const response = await cache.match(request)
      if (response) {
        const blob = await response.blob()
        const sizeMB = blob.size / (1024 * 1024)
        totalSize += blob.size
        items.push({ url: request.url, sizeMB })
      }
    }
    
    return {
      totalSizeMB: totalSize / (1024 * 1024),
      itemCount: requests.length,
      items
    }
  } catch (err) {
    console.error('Failed to get cache stats:', err)
    return { totalSizeMB: 0, itemCount: 0, items: [] }
  }
}

/**
 * Synchronous wrapper for cache stats (returns approximate values)
 * For real-time stats, use getImageCacheStatsAsync
 */
export function getImageCacheStats(): {
  totalSizeMB: number
  itemCount: number
  items: Array<{ url: string, sizeMB: number, lastAccessed: Date }>
} {
  // Return placeholder - actual stats require async Cache API access
  // Component should use getImageCacheStatsAsync for real values
  return {
    totalSizeMB: 0,
    itemCount: 0,
    items: []
  }
}
