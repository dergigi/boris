import { NostrEvent } from 'nostr-tools'
import { ReadItem } from './readsService'

const READING_POSITION_PREFIX = 'boris:reading-position:'

interface ReadArticle {
  id: string
  url?: string
  eventId?: string
  eventKind?: number
  markedAt: number
}

/**
 * Processes reading position events into ReadItems
 */
export function processReadingPositions(
  events: NostrEvent[],
  readsMap: Map<string, ReadItem>
): void {
  for (const event of events) {
    const dTag = event.tags.find(t => t[0] === 'd')?.[1]
    if (!dTag || !dTag.startsWith(READING_POSITION_PREFIX)) continue

    const identifier = dTag.replace(READING_POSITION_PREFIX, '')
    
    try {
      const positionData = JSON.parse(event.content)
      const position = positionData.position
      const timestamp = positionData.timestamp

      let itemId: string
      let itemUrl: string | undefined
      let itemType: 'article' | 'external' = 'external'

      // Check if it's a nostr article (naddr format)
      if (identifier.startsWith('naddr1')) {
        itemId = identifier
        itemType = 'article'
      } else {
        // It's a base64url-encoded URL
        try {
          itemUrl = atob(identifier.replace(/-/g, '+').replace(/_/g, '/'))
          itemId = itemUrl
          itemType = 'external'
        } catch (e) {
          console.warn('Failed to decode URL identifier:', identifier)
          continue
        }
      }

      // Add or update the item
      const existing = readsMap.get(itemId)
      if (!existing || !existing.readingTimestamp || timestamp > existing.readingTimestamp) {
        readsMap.set(itemId, {
          ...existing,
          id: itemId,
          source: 'reading-progress',
          type: itemType,
          url: itemUrl,
          readingProgress: position,
          readingTimestamp: timestamp
        })
      }
    } catch (error) {
      console.warn('Failed to parse reading position:', error)
    }
  }
}

/**
 * Processes marked-as-read articles into ReadItems
 */
export function processMarkedAsRead(
  articles: ReadArticle[],
  readsMap: Map<string, ReadItem>
): void {
  for (const article of articles) {
    const existing = readsMap.get(article.id)
    
    if (article.eventId && article.eventKind === 30023) {
      // Nostr article
      readsMap.set(article.id, {
        ...existing,
        id: article.id,
        source: 'marked-as-read',
        type: 'article',
        markedAsRead: true,
        markedAt: article.markedAt,
        readingTimestamp: existing?.readingTimestamp || article.markedAt
      })
    } else if (article.url) {
      // External URL
      readsMap.set(article.id, {
        ...existing,
        id: article.id,
        source: 'marked-as-read',
        type: 'external',
        url: article.url,
        markedAsRead: true,
        markedAt: article.markedAt,
        readingTimestamp: existing?.readingTimestamp || article.markedAt
      })
    }
  }
}

/**
 * Sorts ReadItems by most recent reading activity
 */
export function sortByReadingActivity(items: ReadItem[]): ReadItem[] {
  return items.sort((a, b) => {
    const timeA = a.readingTimestamp || a.markedAt || 0
    const timeB = b.readingTimestamp || b.markedAt || 0
    return timeB - timeA
  })
}

/**
 * Filters out items without timestamps or proper titles
 */
export function filterValidItems(items: ReadItem[]): ReadItem[] {
  return items.filter(item => {
    // Only include items that have a timestamp
    const hasTimestamp = (item.readingTimestamp && item.readingTimestamp > 0) || 
                        (item.markedAt && item.markedAt > 0)
    if (!hasTimestamp) return false
    
    // Filter out items without titles
    if (!item.title || item.title === 'Untitled') {
      // For Nostr articles, we need the title from the event
      if (item.type === 'article' && !item.event) return false
      // For external URLs, we need a proper title
      if (item.type === 'external' && !item.title) return false
    }
    
    return true
  })
}

