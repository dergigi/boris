import { useState, useEffect } from 'react'
import { cacheImage, getCachedImage, loadCachedImage } from '../services/imageCacheService'
import { UserSettings } from '../services/settingsService'

/**
 * Hook to cache and retrieve images using Cache API
 * 
 * @param imageUrl - The URL of the image to cache
 * @param settings - User settings to determine if caching is enabled
 * @returns The cached blob URL or the original URL
 */
export function useImageCache(
  imageUrl: string | undefined,
  settings: UserSettings | undefined
): string | undefined {
  const [cachedUrl, setCachedUrl] = useState<string | undefined>(imageUrl)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!imageUrl) {
      setCachedUrl(undefined)
      return
    }

    // If caching is disabled, just use the original URL
    const enableCache = settings?.enableImageCache ?? true // Default to enabled
    if (!enableCache) {
      setCachedUrl(imageUrl)
      return
    }

    // Store imageUrl in local variable for closure
    const urlToCache = imageUrl

    // Check if image is in cache metadata (fast synchronous check)
    const isCached = getCachedImage(urlToCache)
    
    if (isCached) {
      // Load the cached image asynchronously
      loadCachedImage(urlToCache)
        .then(blobUrl => {
          if (blobUrl) {
            console.log('📦 Using cached image:', urlToCache.substring(0, 50))
            setCachedUrl(blobUrl)
          } else {
            // Not actually cached, fall through to caching logic
            setCachedUrl(urlToCache)
            cacheInBackground()
          }
        })
        .catch(err => {
          console.error('Failed to load cached image:', err)
          setCachedUrl(urlToCache)
        })
    } else {
      // Not cached, show original and cache in background
      setCachedUrl(urlToCache)
      cacheInBackground()
    }

    function cacheInBackground() {
      if (!isLoading) {
        setIsLoading(true)
        const maxSize = settings?.imageCacheSizeMB ?? 210
        
        cacheImage(urlToCache, maxSize)
          .then(blobUrl => {
            setCachedUrl(blobUrl)
          })
          .catch(err => {
            console.error('Failed to cache image:', err)
            // Keep using original URL on error
          })
          .finally(() => {
            setIsLoading(false)
          })
      }
    }

    // Cleanup: revoke blob URLs when component unmounts or URL changes
    return () => {
      if (cachedUrl && cachedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(cachedUrl)
      }
    }
  }, [imageUrl, settings?.enableImageCache, settings?.imageCacheSizeMB])

  return cachedUrl
}

/**
 * Simpler hook variant that just caches on mount if enabled
 * Useful for preloading article cover images
 */
export function useCacheImageOnLoad(
  imageUrl: string | undefined,
  settings: UserSettings | undefined
): void {
  useEffect(() => {
    if (!imageUrl) return

    const enableCache = settings?.enableImageCache ?? true
    if (!enableCache) return

    // Check if already cached (fast metadata check)
    const isCached = getCachedImage(imageUrl)
    if (isCached) return

    // Cache in background
    const maxSize = settings?.imageCacheSizeMB ?? 210
    cacheImage(imageUrl, maxSize).catch(err => {
      console.error('Failed to cache image:', err)
    })
  }, [imageUrl, settings?.enableImageCache, settings?.imageCacheSizeMB])
}

