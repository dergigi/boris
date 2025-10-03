// Utility to extract preview images from URLs

export const extractYouTubeVideoId = (url: string): string | null => {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

export const getYouTubeThumbnail = (url: string): string | null => {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) return null
  
  // Use maxresdefault for best quality, falls back to hqdefault if not available
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

const extractOgImage = (html: string): string | null => {
  // Extract og:image meta tag from HTML
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
  if (ogImageMatch && ogImageMatch[1]) {
    return ogImageMatch[1]
  }
  
  // Try reversed order (content before property)
  const ogImageMatch2 = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i)
  if (ogImageMatch2 && ogImageMatch2[1]) {
    return ogImageMatch2[1]
  }
  
  return null
}

// Cache for fetched OG images to avoid repeated requests
const ogImageCache = new Map<string, string | null>()

export const fetchOgImage = async (url: string): Promise<string | null> => {
  // Check cache first
  if (ogImageCache.has(url)) {
    return ogImageCache.get(url) || null
  }
  
  try {
    // Use allorigins.win as a free CORS proxy (no auth required)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    const response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    
    if (!response.ok) {
      ogImageCache.set(url, null)
      return null
    }
    
    const data = await response.json()
    const html = data.contents
    
    const ogImage = extractOgImage(html)
    ogImageCache.set(url, ogImage)
    
    return ogImage
  } catch (error) {
    console.warn('Failed to fetch OG image for:', url, error)
    ogImageCache.set(url, null)
    return null
  }
}

export const getPreviewImage = (url: string, type: string): string | null => {
  // YouTube videos - instant thumbnail
  if (type === 'youtube') {
    return getYouTubeThumbnail(url)
  }
  
  // For other URLs, return null and let component fetch async
  return null
}

