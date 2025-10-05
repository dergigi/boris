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
  if (!selectedUrl || highlights.length === 0) return []
  
  const normalizedSelected = normalizeUrl(selectedUrl)
  
  return highlights.filter(h => {
    if (!h.urlReference) return false
    const normalizedRef = normalizeUrl(h.urlReference)
    return normalizedSelected === normalizedRef || 
           normalizedSelected.includes(normalizedRef) ||
           normalizedRef.includes(normalizedSelected)
  })
}
