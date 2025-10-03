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

export const getPreviewImage = (url: string, type: string): string | null => {
  // YouTube videos
  if (type === 'youtube') {
    return getYouTubeThumbnail(url)
  }
  
  // For other URLs, we would need to fetch OG tags
  // but CORS will block us on localhost
  // Return null for now and show placeholder
  return null
}

