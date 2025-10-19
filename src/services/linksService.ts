import { RelayPool } from 'applesauce-relay'
import { fetchReadArticles } from './libraryService'
import { queryEvents } from './dataFetch'
import { RELAYS } from '../config/relays'
import { KINDS } from '../config/kinds'
import { ReadItem } from './readsService'
import { processReadingProgress, processMarkedAsRead, filterValidItems, sortByReadingActivity } from './readingDataProcessor'
import { mergeReadItem } from '../utils/readItemMerge'

/**
 * Fetches external URL links with reading progress from:
 * - URLs with reading progress (kind:39802)
 * - Manually marked as read URLs (kind:7, kind:17)
 */
export async function fetchLinks(
  relayPool: RelayPool,
  userPubkey: string,
  onItem?: (item: ReadItem) => void
): Promise<ReadItem[]> {
  
  const linksMap = new Map<string, ReadItem>()
  
  // Helper to emit items as they're added/updated
  const emitItem = (item: ReadItem) => {
    if (onItem && mergeReadItem(linksMap, item)) {
      onItem(linksMap.get(item.id)!)
    } else if (!onItem) {
      linksMap.set(item.id, item)
    }
  }
  
  try {
    // Fetch all data sources in parallel
    const [progressEvents, markedAsReadArticles] = await Promise.all([
      queryEvents(relayPool, { kinds: [KINDS.ReadingProgress], authors: [userPubkey] }, { relayUrls: RELAYS }),
      fetchReadArticles(relayPool, userPubkey)
    ])

    // Process reading progress events (kind 39802)
    processReadingProgress(progressEvents, linksMap)
    if (onItem) {
      linksMap.forEach(item => {
        if (item.type === 'external') {
          const hasProgress = (item.readingProgress && item.readingProgress > 0) || item.markedAsRead
          if (hasProgress) emitItem(item)
        }
      })
    }
    
    // Process marked-as-read and emit external items
    processMarkedAsRead(markedAsReadArticles, linksMap)
    if (onItem) {
      linksMap.forEach(item => {
        if (item.type === 'external') {
          const hasProgress = (item.readingProgress && item.readingProgress > 0) || item.markedAsRead
          if (hasProgress) emitItem(item)
        }
      })
    }

    // Filter for external URLs only with reading progress
    const links = Array.from(linksMap.values())
      .filter(item => {
        // Only external URLs
        if (item.type !== 'external') return false
        
        // Only include if there's reading progress or marked as read
        const hasProgress = (item.readingProgress && item.readingProgress > 0) || item.markedAsRead
        return hasProgress
      })

    // Apply common validation and sorting
    const validLinks = filterValidItems(links)
    const sortedLinks = sortByReadingActivity(validLinks)

    return sortedLinks

  } catch (error) {
    console.error('Failed to fetch links:', error)
    return []
  }
}

