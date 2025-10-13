/**
 * Build native app deep link URL for video platforms
 * Returns null if the platform doesn't have a known native app URL scheme
 */
export function buildNativeVideoUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname
    
    if (host.includes('youtube.com')) {
      const id = u.searchParams.get('v')
      return id ? `youtube://watch?v=${id}` : `youtube://${u.pathname}${u.search}`
    }
    
    if (host === 'youtu.be') {
      const id = u.pathname.replace('/', '')
      return id ? `youtube://watch?v=${id}` : 'youtube://'
    }
    
    if (host.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id ? `vimeo://app.vimeo.com/videos/${id}` : 'vimeo://'
    }
    
    if (host.includes('dailymotion.com') || host === 'dai.ly') {
      const parts = u.pathname.split('/').filter(Boolean)
      const id = host === 'dai.ly' ? parts[0] : (parts[1] || '')
      return id ? `dailymotion://video/${id}` : 'dailymotion://'
    }
    
    return null
  } catch {
    return null
  }
}

