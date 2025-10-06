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
    console.log('🔍 filterHighlightsByUrl: No URL or highlights', { selectedUrl, count: highlights.length })
    return []
  }
  
  console.log('🔍 filterHighlightsByUrl:', { selectedUrl, totalHighlights: highlights.length })
  
  // For Nostr articles, we already fetched highlights specifically for this article
  // So we don't need to filter them - they're all relevant
  if (selectedUrl.startsWith('nostr:')) {
    console.log('📌 Nostr article - returning all', highlights.length, 'highlights')
    return highlights
  }
  
  // For web URLs, filter by URL matching
  const normalizedSelected = normalizeUrl(selectedUrl)
  console.log('🔗 Normalized selected URL:', normalizedSelected)
  
  const filtered = highlights.filter(h => {
    if (!h.urlReference) {
      console.log('⚠️ Highlight has no urlReference:', h.id, 'eventReference:', h.eventReference)
      return false
    }
    const normalizedRef = normalizeUrl(h.urlReference)
    const matches = normalizedSelected === normalizedRef || 
           normalizedSelected.includes(normalizedRef) ||
           normalizedRef.includes(normalizedSelected)
    
    if (matches) {
      console.log('✅ URL match:', normalizedRef)
    } else {
      console.log('❌ URL mismatch:', normalizedRef, 'vs', normalizedSelected)
    }
    
    return matches
  })
  
  console.log('📊 Filtered to', filtered.length, 'highlights')
  return filtered
}
