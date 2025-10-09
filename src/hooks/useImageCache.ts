import { useState, useEffect } from 'react'
import { cacheImage, getCachedImage } from '../services/imageCacheService'
import { UserSettings } from '../services/settingsService'

/**
 * Hook to pre-cache images and return the URL for display
 * With Service Worker active, images are automatically cached and served offline
 * This hook ensures proactive caching for better offline experience
 * 
 * @param imageUrl - The URL of the image to cache
 * @param settings - User settings to determine if caching is enabled
 * @returns The image URL (Service Worker handles caching transparently)
 */
export function useImageCache(
  imageUrl: string | undefined,
  settings: UserSettings | undefined
): string | undefined {
  const [displayUrl, setDisplayUrl] = useState<string | undefined>(imageUrl)

  useEffect(() => {
    if (!imageUrl) {
      setDisplayUrl(undefined)
      return
    }

    // Always show the original URL - Service Worker will serve from cache if available
    setDisplayUrl(imageUrl)

    // If caching is disabled, don't pre-cache
    const enableCache = settings?.enableImageCache ?? true
    if (!enableCache || !navigator.onLine) {
      return
    }

    // Pre-cache the image for offline availability
    // Service Worker will handle serving it, but we ensure it's cached
    const maxSize = settings?.imageCacheSizeMB ?? 210
    cacheImage(imageUrl, maxSize).catch(err => {
      console.warn('Failed to pre-cache image:', err)
    })
  }, [imageUrl, settings?.enableImageCache, settings?.imageCacheSizeMB])

  return displayUrl
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

