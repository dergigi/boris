import { RelayPool } from 'applesauce-relay'
import { fetchReadArticles } from './libraryService'
import { queryEvents } from './dataFetch'
import { RELAYS } from '../config/relays'
import { ReadItem } from './readsService'
import { processReadingPositions, processMarkedAsRead, filterValidItems, sortByReadingActivity } from './readingDataProcessor'

const APP_DATA_KIND = 30078 // NIP-78 Application Data

/**
 * Fetches external URL links with reading progress from:
 * - URLs with reading progress (kind:30078)
 * - Manually marked as read URLs (kind:7, kind:17)
 */
export async function fetchLinks(
  relayPool: RelayPool,
  userPubkey: string
): Promise<ReadItem[]> {
  console.log('🔗 [Links] Fetching external links for user:', userPubkey.slice(0, 8))
  
  try {
    // Fetch all data sources in parallel
    const [readingPositionEvents, markedAsReadArticles] = await Promise.all([
      queryEvents(relayPool, { kinds: [APP_DATA_KIND], authors: [userPubkey] }, { relayUrls: RELAYS }),
      fetchReadArticles(relayPool, userPubkey)
    ])

    console.log('📊 [Links] Data fetched:', {
      readingPositions: readingPositionEvents.length,
      markedAsRead: markedAsReadArticles.length
    })

    // Process data using shared utilities
    const linksMap = new Map<string, ReadItem>()
    processReadingPositions(readingPositionEvents, linksMap)
    processMarkedAsRead(markedAsReadArticles, linksMap)

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

    console.log('✅ [Links] Processed', sortedLinks.length, 'total links')
    return sortedLinks

  } catch (error) {
    console.error('Failed to fetch links:', error)
    return []
  }
}

