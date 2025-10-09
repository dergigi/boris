import { useState, useEffect } from 'react'
import { cacheImage, getCachedImage } from '../services/imageCacheService'
import { UserSettings } from '../services/settingsService'

/**
 * Hook to cache and retrieve images from localStorage
 * 
 * @param imageUrl - The URL of the image to cache
 * @param settings - User settings to determine if caching is enabled
 * @returns The cached data URL or the original URL
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

    // Check if already cached
    const cached = getCachedImage(imageUrl)
    if (cached) {
      console.log('📦 Using cached image:', imageUrl.substring(0, 50))
      setCachedUrl(cached)
      return
    }

    // Otherwise, show original URL while caching in background
    setCachedUrl(imageUrl)

    // Cache image in background
    if (!isLoading) {
      setIsLoading(true)
      const maxSize = settings?.imageCacheSizeMB ?? 210
      
      cacheImage(imageUrl, maxSize)
        .then(dataUrl => {
          setCachedUrl(dataUrl)
        })
        .catch(err => {
          console.error('Failed to cache image:', err)
          // Keep using original URL on error
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [imageUrl, settings?.enableImageCache, settings?.imageCacheSizeMB])

  return cachedUrl
}

/**
 * Simpler hook variant that just caches on mount if enabled
 * Useful for article cover images
 */
export function useCacheImageOnLoad(
  imageUrl: string | undefined,
  settings: UserSettings | undefined
): void {
  useEffect(() => {
    if (!imageUrl) return

    const enableCache = settings?.enableImageCache ?? true
    if (!enableCache) return

    // Check if already cached
    const cached = getCachedImage(imageUrl)
    if (cached) return

    // Cache in background
    const maxSize = settings?.imageCacheSizeMB ?? 210
    cacheImage(imageUrl, maxSize).catch(err => {
      console.error('Failed to cache image:', err)
    })
  }, [imageUrl, settings?.enableImageCache, settings?.imageCacheSizeMB])
}

