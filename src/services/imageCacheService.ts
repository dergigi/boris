/**
 * Image Cache Service
 * 
 * Caches images in localStorage for offline access.
 * Uses LRU (Least Recently Used) eviction when cache size limit is exceeded.
 */

const CACHE_PREFIX = 'img_cache_'
const CACHE_METADATA_KEY = 'img_cache_metadata'

interface CacheMetadata {
  [url: string]: {
    key: string
    size: number
    lastAccessed: number
  }
}

/**
 * Get cache metadata
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
 * Save cache metadata
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
 * Generate cache key for URL
 */
function getCacheKey(url: string): string {
  // Use a simple hash of the URL
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `${CACHE_PREFIX}${Math.abs(hash)}`
}

/**
 * Evict least recently used images until cache is under limit
 */
function evictLRU(maxSizeBytes: number): void {
  const metadata = getMetadata()
  const entries = Object.entries(metadata)
  
  // Sort by last accessed (oldest first)
  entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
  
  let currentSize = getTotalCacheSize()
  
  for (const [url, item] of entries) {
    if (currentSize <= maxSizeBytes) break
    
    try {
      localStorage.removeItem(item.key)
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
 * Fetch image and convert to data URL
 */
async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }
  
  const blob = await response.blob()
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert image to data URL'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Cache an image
 */
export async function cacheImage(
  url: string, 
  maxCacheSizeMB: number = 50
): Promise<string> {
  try {
    // Check if already cached
    const cached = getCachedImage(url)
    if (cached) {
      console.log('✅ Image already cached:', url.substring(0, 50))
      return cached
    }
    
    // Fetch and convert to data URL
    console.log('📥 Caching image:', url.substring(0, 50))
    const dataUrl = await fetchImageAsDataUrl(url)
    const size = dataUrl.length
    
    // Check if image alone exceeds cache limit
    if (bytesToMB(size) > maxCacheSizeMB) {
      console.warn(`⚠️ Image too large to cache (${bytesToMB(size).toFixed(2)}MB > ${maxCacheSizeMB}MB)`)
      return url // Return original URL if too large
    }
    
    const maxSizeBytes = mbToBytes(maxCacheSizeMB)
    
    // Evict old images if necessary
    const currentSize = getTotalCacheSize()
    if (currentSize + size > maxSizeBytes) {
      evictLRU(maxSizeBytes - size)
    }
    
    // Store image
    const key = getCacheKey(url)
    const metadata = getMetadata()
    
    try {
      localStorage.setItem(key, dataUrl)
      metadata[url] = {
        key,
        size,
        lastAccessed: Date.now()
      }
      saveMetadata(metadata)
      
      console.log(`💾 Cached image (${bytesToMB(size).toFixed(2)}MB). Total cache: ${bytesToMB(getTotalCacheSize()).toFixed(2)}MB`)
      return dataUrl
    } catch (err) {
      // If storage fails, try evicting more and retry once
      console.warn('Storage full, evicting more items...')
      evictLRU(maxSizeBytes / 2) // Free up half the cache
      
      try {
        localStorage.setItem(key, dataUrl)
        metadata[url] = {
          key,
          size,
          lastAccessed: Date.now()
        }
        saveMetadata(metadata)
        return dataUrl
      } catch {
        console.error('Failed to cache image after eviction')
        return url // Return original URL on failure
      }
    }
  } catch (err) {
    console.error('Failed to cache image:', err)
    return url // Return original URL on error
  }
}

/**
 * Get cached image
 */
export function getCachedImage(url: string): string | null {
  try {
    const metadata = getMetadata()
    const item = metadata[url]
    
    if (!item) return null
    
    const dataUrl = localStorage.getItem(item.key)
    if (!dataUrl) {
      // Clean up stale metadata
      delete metadata[url]
      saveMetadata(metadata)
      return null
    }
    
    // Update last accessed time
    item.lastAccessed = Date.now()
    metadata[url] = item
    saveMetadata(metadata)
    
    return dataUrl
  } catch {
    return null
  }
}

/**
 * Clear all cached images
 */
export function clearImageCache(): void {
  try {
    const metadata = getMetadata()
    
    for (const item of Object.values(metadata)) {
      try {
        localStorage.removeItem(item.key)
      } catch (err) {
        console.warn('Failed to remove cached image:', err)
      }
    }
    
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

