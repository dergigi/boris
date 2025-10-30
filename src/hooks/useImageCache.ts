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
  if (!imageUrl) return
  
  // Create a link element with rel=prefetch or use Image object to trigger fetch
  // Service Worker will intercept and cache the request
  const img = new Image()
  img.src = imageUrl
  
  // Also try using fetch to explicitly trigger Service Worker
  // This ensures the image is cached even if <img> tag hasn't rendered yet
  fetch(imageUrl, { mode: 'no-cors' }).catch(() => {
    // Ignore errors - image might not be CORS-enabled, but SW will still cache it
    // The Image() approach above will work for most cases
  })
}

