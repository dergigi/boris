import { ReadItem } from '../services/readsService'
import { ReadingProgressFilterType } from '../components/ReadingProgressFilters'
import { Highlight } from '../types/highlights'
import { nip19 } from 'nostr-tools'

/**
 * Filters ReadItems by reading progress
 */
export function filterByReadingProgress(
  items: ReadItem[],
  filter: ReadingProgressFilterType,
  highlights?: Highlight[]
): ReadItem[] {
  // Build a map of article references to highlight count
  // Normalize both coordinate and naddr formats for matching
  const articleHighlightCount = new Map<string, number>()
  if (highlights) {
    highlights.forEach(h => {
      if (h.eventReference) {
        // eventReference could be a hex ID or a coordinate (30023:pubkey:identifier)
        let normalizedRef = h.eventReference
        
        // If it's a coordinate, convert to naddr format for matching
        if (h.eventReference.includes(':')) {
          const parts = h.eventReference.split(':')
          if (parts.length === 3) {
            const [kind, pubkey, identifier] = parts
            try {
              normalizedRef = nip19.naddrEncode({
                kind: parseInt(kind),
                pubkey,
                identifier
              })
            } catch {
              // If conversion fails, use the original reference
              normalizedRef = h.eventReference
            }
          }
        }
        
        const count = articleHighlightCount.get(normalizedRef) || 0
        articleHighlightCount.set(normalizedRef, count + 1)
      }
      if (h.urlReference) {
        const count = articleHighlightCount.get(h.urlReference) || 0
        articleHighlightCount.set(h.urlReference, count + 1)
      }
    })
  }

  return items.filter((item) => {
    const progress = item.readingProgress || 0
    // Reading progress filters MUST ignore emoji/archive reactions
    const hasHighlights = (articleHighlightCount.get(item.id) || 0) > 0 || 
                         (item.url && (articleHighlightCount.get(item.url) || 0) > 0)
    
    switch (filter) {
      case 'unopened':
        return progress === 0
      case 'started':
        return progress > 0 && progress <= 0.10
      case 'reading':
        return progress > 0.10 && progress <= 0.94
      case 'completed':
        // Completed is 95%+ progress only (no emoji fallback)
        return progress >= 0.95
      case 'archive':
        // Archive filter handled upstream; keep fallback as false to avoid mixing
        return false
      case 'highlighted':
        return hasHighlights
      case 'all':
      default:
        return true
    }
  })
}

