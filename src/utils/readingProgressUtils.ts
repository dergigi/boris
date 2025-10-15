import { ReadItem } from '../services/readsService'
import { ReadingProgressFilterType } from '../components/ReadingProgressFilters'

/**
 * Filters ReadItems by reading progress
 */
export function filterByReadingProgress(
  items: ReadItem[],
  filter: ReadingProgressFilterType
): ReadItem[] {
  return items.filter((item) => {
    const progress = item.readingProgress || 0
    const isMarked = item.markedAsRead || false
    
    switch (filter) {
      case 'unopened':
        return progress === 0 && !isMarked
      case 'started':
        return progress > 0 && progress <= 0.10 && !isMarked
      case 'reading':
        return progress > 0.10 && progress <= 0.94 && !isMarked
      case 'completed':
        return progress >= 0.95 || isMarked
      case 'all':
      default:
        return true
    }
  })
}

