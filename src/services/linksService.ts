import { RelayPool } from 'applesauce-relay'
import { fetchReadArticles } from './libraryService'
import { queryEvents } from './dataFetch'
import { RELAYS } from '../config/relays'
import { ReadItem } from './readsService'

const APP_DATA_KIND = 30078 // NIP-78 Application Data
const READING_POSITION_PREFIX = 'boris:reading-position:'

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

    // Map to deduplicate items by ID
    const linksMap = new Map<string, ReadItem>()

    // 1. Process reading position events for external URLs
    for (const event of readingPositionEvents) {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1]
      if (!dTag || !dTag.startsWith(READING_POSITION_PREFIX)) continue

      const identifier = dTag.replace(READING_POSITION_PREFIX, '')
      
      try {
        const positionData = JSON.parse(event.content)
        const position = positionData.position
        const timestamp = positionData.timestamp

        // Skip if it's a nostr article (naddr format)
        if (identifier.startsWith('naddr1')) continue

        // It's a base64url-encoded URL
        let itemUrl: string
        try {
          itemUrl = atob(identifier.replace(/-/g, '+').replace(/_/g, '/'))
        } catch (e) {
          console.warn('Failed to decode URL identifier:', identifier)
          continue
        }

        // Add or update the item
        const existing = linksMap.get(itemUrl)
        if (!existing || !existing.readingTimestamp || timestamp > existing.readingTimestamp) {
          linksMap.set(itemUrl, {
            ...existing,
            id: itemUrl,
            source: 'reading-progress',
            type: 'external',
            url: itemUrl,
            readingProgress: position,
            readingTimestamp: timestamp
          })
        }
      } catch (error) {
        console.warn('Failed to parse reading position:', error)
      }
    }

    // 2. Process marked-as-read external URLs
    for (const article of markedAsReadArticles) {
      // Only process external URLs (skip Nostr articles)
      if (article.url && !article.eventId) {
        const existing = linksMap.get(article.url)
        
        linksMap.set(article.url, {
          ...existing,
          id: article.url,
          source: 'marked-as-read',
          type: 'external',
          url: article.url,
          markedAsRead: true,
          markedAt: article.markedAt,
          readingTimestamp: existing?.readingTimestamp || article.markedAt
        })
      }
    }

    // 3. Filter and sort links
    const sortedLinks = Array.from(linksMap.values())
      .filter(item => {
        // Only include items that have a timestamp
        const hasTimestamp = (item.readingTimestamp && item.readingTimestamp > 0) || 
                            (item.markedAt && item.markedAt > 0)
        if (!hasTimestamp) return false
        
        // Filter out items without titles
        if (!item.title || item.title === 'Untitled') return false
        
        // Only include if there's reading progress or marked as read
        const hasProgress = (item.readingProgress && item.readingProgress > 0) || item.markedAsRead
        return hasProgress
      })
      .sort((a, b) => {
        const timeA = a.readingTimestamp || a.markedAt || 0
        const timeB = b.readingTimestamp || b.markedAt || 0
        return timeB - timeA
      })

    console.log('✅ [Links] Processed', sortedLinks.length, 'total links')
    return sortedLinks

  } catch (error) {
    console.error('Failed to fetch links:', error)
    return []
  }
}

