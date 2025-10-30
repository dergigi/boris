/**
 * Hook to return image URL for display
 * Service Worker handles all caching transparently
 * Images are cached on first load and available offline automatically
 * 
 * @param imageUrl - The URL of the image to display
 * @returns The image URL (Service Worker handles caching)
 */
export function useImageCache(
  imageUrl: string | undefined
): string | undefined {
  // Service Worker handles everything - just return the URL as-is
  // The Service Worker will intercept fetch requests and cache them
  // Make sure images use standard <img src> tags for SW interception
  
  // Debug: Log when image URL is provided
  if (imageUrl) {
    console.log('[image-cache] useImageCache hook called with URL:', imageUrl)
    
    // Check if Service Worker is available
    if ('serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {
        console.log('[image-cache] ✅ Service Worker controller is active')
      } else {
        console.warn('[image-cache] ⚠️ Service Worker not controlling page - checking registration...')
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) {
            console.log('[image-cache] Service Worker registered but not controlling:', {
              active: !!reg.active,
              installing: !!reg.installing,
              waiting: !!reg.waiting
            })
          } else {
            console.warn('[image-cache] ❌ No Service Worker registration found')
          }
        })
      }
    } else {
      console.warn('[image-cache] ❌ Service Workers not supported in this browser')
    }
  }
  
  return imageUrl
}

/**
 * Pre-load image to ensure it's cached by Service Worker
 * Triggers a fetch so the SW can cache it even if not visible yet
 */
export function useCacheImageOnLoad(
  imageUrl: string | undefined
): void {
  // Service Worker will cache on first fetch
  // This hook is now a no-op, kept for API compatibility
  // The browser will automatically fetch and cache images when they're used in <img> tags
  void imageUrl
}

/**
 * Preload an image URL to ensure it's cached by the Service Worker
 * This is useful when loading content from cache - we want to ensure
 * images are cached before going offline
 */
export function preloadImage(imageUrl: string | undefined): void {
  if (!imageUrl) {
    console.log('[image-preload] Skipping - no image URL provided')
    return
  }
  
  console.log('[image-preload] Preloading image:', imageUrl)
  
  // Check if Service Worker is available
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    console.log('[image-preload] ✅ Service Worker is active')
  } else {
    console.warn('[image-preload] ⚠️ Service Worker not active - images may not cache')
  }
  
  // Create a link element with rel=prefetch or use Image object to trigger fetch
  // Service Worker will intercept and cache the request
  const img = new Image()
  
  img.onload = () => {
    console.log('[image-preload] ✅ Image loaded successfully:', imageUrl)
  }
  
  img.onerror = (err) => {
    console.error('[image-preload] ❌ Image failed to load:', imageUrl, err)
  }
  
  img.src = imageUrl
  console.log('[image-preload] Created Image() object with src:', imageUrl)
  
  // Also try using fetch to explicitly trigger Service Worker
  // This ensures the image is cached even if <img> tag hasn't rendered yet
  fetch(imageUrl, { mode: 'no-cors' })
    .then((response) => {
      console.log('[image-preload] ✅ Fetch successful for image:', imageUrl, {
        status: response.status,
        type: response.type,
        url: response.url
      })
    })
    .catch((err) => {
      console.warn('[image-preload] ⚠️ Fetch failed (may be CORS issue, Image() should still work):', imageUrl, err)
      // Ignore errors - image might not be CORS-enabled, but SW will still cache it
      // The Image() approach above will work for most cases
    })
}

