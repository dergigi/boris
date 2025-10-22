import { NostrEvent, nip19 } from 'nostr-tools'
import { ReadItem } from './readsService'
import { fallbackTitleFromUrl } from '../utils/readItemMerge'
import { KINDS } from '../config/kinds'

const READING_PROGRESS_KIND = KINDS.ReadingProgress // 39802 - NIP-85

interface ReadArticle {
  id: string
  url?: string
  eventId?: string
  eventKind?: number
  markedAt: number
}

/**
 * Processes reading progress events (kind 39802) into ReadItems
 * 
 * Test scenarios:
 * - Kind 39802 with d="30023:..." → article ReadItem with naddr id
 * - Kind 39802 with d="url:..." → external ReadItem with decoded URL
 * - Newer event.created_at overwrites older timestamp
 * - Invalid d tag format → skip event
 * - Malformed JSON content → skip event
 */
export function processReadingProgress(
  events: NostrEvent[],
  readsMap: Map<string, ReadItem>
): void {
  
  for (const event of events) {
    if (event.kind !== READING_PROGRESS_KIND) {
      continue
    }
    
    const dTag = event.tags.find(t => t[0] === 'd')?.[1]
    if (!dTag) {
      continue
    }
    
    try {
      const content = JSON.parse(event.content)
      const position = content.progress || 0
      
      // Validate progress is between 0 and 1 (NIP-85 requirement)
      if (position < 0 || position > 1) {
        continue
      }
      
      // Use event.created_at as authoritative timestamp (NIP-85 spec)
      const timestamp = event.created_at

      let itemId: string
      let itemUrl: string | undefined
      let itemType: 'article' | 'external' = 'external'

      // Check if d tag is a coordinate (30023:pubkey:identifier)
      if (dTag.startsWith('30023:')) {
        // It's a nostr article coordinate
        const parts = dTag.split(':')
        if (parts.length === 3) {
          // Convert to naddr for consistency with the rest of the app
          try {
            const naddr = nip19.naddrEncode({
              kind: parseInt(parts[0]),
              pubkey: parts[1],
              identifier: parts[2]
            })
            itemId = naddr
            itemType = 'article'
          } catch (e) {
            continue
          }
        } else {
          continue
        }
      } else if (dTag.startsWith('url:')) {
        // It's a URL. We support both raw URLs and base64url-encoded URLs.
        const value = dTag.slice(4)
        const looksBase64Url = /^[A-Za-z0-9_-]+$/.test(value) && (value.includes('-') || value.includes('_'))
        try {
          if (looksBase64Url) {
            // Decode base64url to raw URL
            itemUrl = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
          } else {
            // Treat as raw URL (already decoded)
            itemUrl = value
          }
          itemId = itemUrl
          itemType = 'external'
        } catch (e) {
          continue
        }
      } else {
        continue
      }

      // Add or update the item, preferring newer timestamps
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
      // Silently fail
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
 * Filters out items without timestamps and enriches external items with fallback titles
 */
export function filterValidItems(items: ReadItem[]): ReadItem[] {
  return items
    .filter(item => {
      // Only include items that have a timestamp
      const hasTimestamp = (item.readingTimestamp && item.readingTimestamp > 0) || 
                          (item.markedAt && item.markedAt > 0)
      if (!hasTimestamp) return false
      
      // For Nostr articles, we need the event to be valid
      if (item.type === 'article' && !item.event) return false
      
      // For external URLs, we need at least a URL
      if (item.type === 'external' && !item.url) return false
      
      return true
    })
    .map(item => {
      // Add fallback title for external URLs without titles
      if (item.type === 'external' && !item.title && item.url) {
        return { ...item, title: fallbackTitleFromUrl(item.url) }
      }
      return item
    })
}

