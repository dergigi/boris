import { Highlight } from '../types/highlights'

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
  
  
  // For Nostr articles, we already fetched highlights specifically for this article
  // So we don't need to filter them - they're all relevant
  if (selectedUrl.startsWith('nostr:')) {
    return highlights
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
