/**
 * Image Cache Service
 * 
 * Caches images using the Cache API for offline access.
 * Uses LRU (Least Recently Used) eviction when cache size limit is exceeded.
 */

const CACHE_NAME = 'boris-image-cache-v1'
const CACHE_METADATA_KEY = 'img_cache_metadata'

interface CacheMetadata {
  [url: string]: {
    size: number
    lastAccessed: number
  }
}

/**
 * Get cache metadata from localStorage
 */
function getMetadata(): CacheMetadata {
  try {
    const data = localStorage.getItem(CACHE_METADATA_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

/**
 * Save cache metadata to localStorage
 */
function saveMetadata(metadata: CacheMetadata): void {
  try {
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata))
  } catch (err) {
    console.warn('Failed to save image cache metadata:', err)
  }
}

/**
 * Calculate total cache size in bytes
 */
function getTotalCacheSize(): number {
  const metadata = getMetadata()
  return Object.values(metadata).reduce((sum, item) => sum + item.size, 0)
}

/**
 * Convert bytes to MB
 */
function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024)
}

/**
 * Convert MB to bytes
 */
function mbToBytes(mb: number): number {
  return mb * 1024 * 1024
}

/**
 * Evict least recently used images until cache is under limit
 */
async function evictLRU(maxSizeBytes: number): Promise<void> {
  const metadata = getMetadata()
  const entries = Object.entries(metadata)
  
  // Sort by last accessed (oldest first)
  entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
  
  let currentSize = getTotalCacheSize()
  const cache = await caches.open(CACHE_NAME)
  
  for (const [url, item] of entries) {
    if (currentSize <= maxSizeBytes) break
    
    try {
      await cache.delete(url)
      delete metadata[url]
      currentSize -= item.size
      console.log(`🗑️ Evicted image from cache: ${url.substring(0, 50)}...`)
    } catch (err) {
      console.warn('Failed to evict image:', err)
    }
  }
  
  saveMetadata(metadata)
}

/**
 * Cache an image using Cache API
 */
export async function cacheImage(
  url: string, 
  maxCacheSizeMB: number = 210
): Promise<string> {
  try {
    // Check if already cached
    const cached = await getCachedImageUrl(url)
    if (cached) {
      console.log('✅ Image already cached:', url.substring(0, 50))
      return cached
    }
    
    // Fetch the image
    console.log('📥 Caching image:', url.substring(0, 50))
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    
    // Clone the response so we can read it twice (once for size, once for cache)
    const responseClone = response.clone()
    const blob = await response.blob()
    const size = blob.size
    
    // Check if image alone exceeds cache limit
    if (bytesToMB(size) > maxCacheSizeMB) {
      console.warn(`⚠️ Image too large to cache (${bytesToMB(size).toFixed(2)}MB > ${maxCacheSizeMB}MB)`)
      return url // Return original URL if too large
    }
    
    const maxSizeBytes = mbToBytes(maxCacheSizeMB)
    
    // Evict old images if necessary
    const currentSize = getTotalCacheSize()
    if (currentSize + size > maxSizeBytes) {
      await evictLRU(maxSizeBytes - size)
    }
    
    // Store in Cache API
    const cache = await caches.open(CACHE_NAME)
    await cache.put(url, responseClone)
    
    // Update metadata
    const metadata = getMetadata()
    metadata[url] = {
      size,
      lastAccessed: Date.now()
    }
    saveMetadata(metadata)
    
    console.log(`💾 Cached image (${bytesToMB(size).toFixed(2)}MB). Total cache: ${bytesToMB(getTotalCacheSize()).toFixed(2)}MB`)
    
    // Return blob URL for immediate use
    return URL.createObjectURL(blob)
  } catch (err) {
    console.error('Failed to cache image:', err)
    return url // Return original URL on error
  }
}

/**
 * Get cached image URL (creates blob URL from cached response)
 */
async function getCachedImageUrl(url: string): Promise<string | null> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(url)
    
    if (!response) {
      return null
    }
    
    // Update last accessed time in metadata
    const metadata = getMetadata()
    if (metadata[url]) {
      metadata[url].lastAccessed = Date.now()
      saveMetadata(metadata)
    }
    
    // Convert response to blob URL
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/**
 * Get cached image (synchronous wrapper that returns null, actual loading happens async)
 * This maintains backward compatibility with the hook's synchronous check
 */
export function getCachedImage(url: string): string | null {
  // Check if we have metadata for this URL
  const metadata = getMetadata()
  return metadata[url] ? url : null // Return URL if in metadata, let hook handle async loading
}

/**
 * Clear all cached images
 */
export async function clearImageCache(): Promise<void> {
  try {
    // Clear from Cache API
    await caches.delete(CACHE_NAME)
    
    // Clear metadata from localStorage
    localStorage.removeItem(CACHE_METADATA_KEY)
    
    console.log('🗑️ Cleared all cached images')
  } catch (err) {
    console.error('Failed to clear image cache:', err)
  }
}

/**
 * Get cache statistics
 */
export function getImageCacheStats(): {
  totalSizeMB: number
  itemCount: number
  items: Array<{ url: string, sizeMB: number, lastAccessed: Date }>
} {
  const metadata = getMetadata()
  const entries = Object.entries(metadata)
  
  return {
    totalSizeMB: bytesToMB(getTotalCacheSize()),
    itemCount: entries.length,
    items: entries.map(([url, item]) => ({
      url,
      sizeMB: bytesToMB(item.size),
      lastAccessed: new Date(item.lastAccessed)
    }))
  }
}

/**
 * Load cached image asynchronously (for use in hooks/components)
 */
export async function loadCachedImage(url: string): Promise<string | null> {
  return getCachedImageUrl(url)
}
