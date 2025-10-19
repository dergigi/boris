import { ReadItem } from '../services/readsService'
import { ReadingProgressFilterType } from '../components/ReadingProgressFilters'
import { Highlight } from '../types/highlights'

/**
 * Filters ReadItems by reading progress
 */
export function filterByReadingProgress(
  items: ReadItem[],
  filter: ReadingProgressFilterType,
  highlights?: Highlight[]
): ReadItem[] {
  // Build a map of article references to highlight count
  const articleHighlightCount = new Map<string, number>()
  if (highlights) {
    highlights.forEach(h => {
      if (h.eventReference) {
        const count = articleHighlightCount.get(h.eventReference) || 0
        articleHighlightCount.set(h.eventReference, count + 1)
      }
      if (h.urlReference) {
        const count = articleHighlightCount.get(h.urlReference) || 0
        articleHighlightCount.set(h.urlReference, count + 1)
      }
    })
  }

  return items.filter((item) => {
    const progress = item.readingProgress || 0
    const isMarked = item.markedAsRead || false
    const hasHighlights = (articleHighlightCount.get(item.id) || 0) > 0 || 
                         (item.url && (articleHighlightCount.get(item.url) || 0) > 0)
    
    switch (filter) {
      case 'unopened':
        return progress === 0 && !isMarked
      case 'started':
        return progress > 0 && progress <= 0.10 && !isMarked
      case 'reading':
        return progress > 0.10 && progress <= 0.94 && !isMarked
      case 'completed':
        return progress >= 0.95 || isMarked
      case 'highlighted':
        return hasHighlights
      case 'all':
      default:
        return true
    }
  })
}

