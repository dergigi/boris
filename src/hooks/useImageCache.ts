import { UserSettings } from '../services/settingsService'

/**
 * Hook to return image URL for display
 * Service Worker handles all caching transparently
 * Images are cached on first load and available offline automatically
 * 
 * @param imageUrl - The URL of the image to display
 * @returns The image URL (Service Worker handles caching)
 */
export function useImageCache(
  imageUrl: string | undefined,
  // eslint-disable-next-line no-unused-vars
  _settings?: UserSettings
): string | undefined {
  // Service Worker handles everything - just return the URL as-is
  return imageUrl
}

/**
 * Pre-load image to ensure it's cached by Service Worker
 * Triggers a fetch so the SW can cache it even if not visible yet
 */
export function useCacheImageOnLoad(
  imageUrl: string | undefined,
  // eslint-disable-next-line no-unused-vars
  _settings?: UserSettings
): void {
  // Service Worker will cache on first fetch
  // This hook is now a no-op, kept for API compatibility
  // The browser will automatically fetch and cache images when they're used in <img> tags
  void imageUrl
}

