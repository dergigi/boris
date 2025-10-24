import { Highlight } from '../types/highlights'
import { nip19 } from 'nostr-tools'

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    return `${urlObj.hostname.replace(/^www\./, '')}${urlObj.pathname}`.replace(/\/$/, '').toLowerCase()
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase()
  }
}

export function filterHighlightsByUrl(highlights: Highlight[], selectedUrl: string | undefined): Highlight[] {
  if (!selectedUrl || highlights.length === 0) {
    return []
  }
  
  
  // For Nostr articles, filter by article coordinate
  if (selectedUrl.startsWith('nostr:')) {
    try {
      const decoded = nip19.decode(selectedUrl.replace('nostr:', ''))
      if (decoded.type === 'naddr') {
        const ptr = decoded.data as { kind: number; pubkey: string; identifier: string }
        const articleCoordinate = `${ptr.kind}:${ptr.pubkey}:${ptr.identifier}`
        
        return highlights.filter(h => {
          // Keep highlights that match this article coordinate
          return h.eventReference === articleCoordinate
        })
      } else {
        // Not a valid naddr, return empty array
        return []
      }
    } catch {
      // Invalid naddr, return empty array
      return []
    }
  }
  
  // For web URLs, filter by URL matching
  const normalizedSelected = normalizeUrl(selectedUrl)
  
  const filtered = highlights.filter(h => {
    if (!h.urlReference) {
      return false
    }
    const normalizedRef = normalizeUrl(h.urlReference)
    const matches = normalizedSelected === normalizedRef || 
           normalizedSelected.includes(normalizedRef) ||
           normalizedRef.includes(normalizedSelected)
    
    if (matches) {
      // URLs match
    } else {
      // URLs do not match
    }
    
    return matches
  })
  
  return filtered
}
