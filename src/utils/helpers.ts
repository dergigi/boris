// Extract pubkeys from nprofile strings in content
export const extractNprofilePubkeys = (content: string): string[] => {
  const nprofileRegex = /nprofile1[a-z0-9]+/gi
  const matches = content.match(nprofileRegex) || []
  const unique = new Set<string>(matches)
  return Array.from(unique)
}

export type UrlType = 'video' | 'image' | 'youtube' | 'article'

export interface UrlClassification {
  type: UrlType
  buttonText: string
}

export const classifyUrl = (url: string | undefined): UrlClassification => {
  if (!url) {
    return { type: 'article', buttonText: 'READ NOW' }
  }
  const urlLower = url.toLowerCase()
  
  // Check for YouTube
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { type: 'youtube', buttonText: 'WATCH NOW' }
  }
  
  // Check for video extensions
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v']
  if (videoExtensions.some(ext => urlLower.includes(ext))) {
    return { type: 'video', buttonText: 'WATCH NOW' }
  }
  
  // Check for image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
  if (imageExtensions.some(ext => urlLower.includes(ext))) {
    return { type: 'image', buttonText: 'VIEW NOW' }
  }
  
  // Default to article
  return { type: 'article', buttonText: 'READ NOW' }
}

