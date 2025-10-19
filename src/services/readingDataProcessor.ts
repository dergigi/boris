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
  console.log('[progress] 🔧 processReadingProgress called with', events.length, 'events')
  
  for (const event of events) {
    if (event.kind !== READING_PROGRESS_KIND) {
      console.log('[progress] ⏭️ Skipping event with wrong kind:', event.kind)
      continue
    }
    
    const dTag = event.tags.find(t => t[0] === 'd')?.[1]
    if (!dTag) {
      console.log('[progress] ⚠️ Event missing d-tag:', event.id.slice(0, 8))
      continue
    }
    
    console.log('[progress] 📝 Processing event:', event.id.slice(0, 8), 'd-tag:', dTag.slice(0, 50))
    
    try {
      const content = JSON.parse(event.content)
      const position = content.progress || 0
      
      console.log('[progress] 📊 Progress value:', position, '(' + Math.round(position * 100) + '%)')
      
      // Validate progress is between 0 and 1 (NIP-85 requirement)
      if (position < 0 || position > 1) {
        console.warn('[progress] ❌ Invalid progress value (must be 0-1):', position, 'event:', event.id.slice(0, 8))
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
            console.log('[progress] ✅ Converted coordinate to naddr:', naddr.slice(0, 50))
          } catch (e) {
            console.warn('[progress] ❌ Failed to encode naddr from coordinate:', dTag)
            continue
          }
        } else {
          console.warn('[progress] ⚠️ Invalid coordinate format:', dTag)
          continue
        }
      } else if (dTag.startsWith('url:')) {
        // It's a URL with base64url encoding
        const encoded = dTag.replace('url:', '')
        try {
          itemUrl = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
          itemId = itemUrl
          itemType = 'external'
          console.log('[progress] ✅ Decoded URL:', itemUrl.slice(0, 50))
        } catch (e) {
          console.warn('[progress] ❌ Failed to decode URL from d tag:', dTag)
          continue
        }
      } else {
        console.warn('[progress] ⚠️ Unknown d-tag format:', dTag)
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
        console.log('[progress] ✅ Added/updated item in readsMap:', itemId.slice(0, 50), '=', Math.round(position * 100) + '%')
      } else {
        console.log('[progress] ⏭️ Skipping older event for:', itemId.slice(0, 50))
      }
    } catch (error) {
      console.warn('[progress] ❌ Failed to parse reading progress event:', error)
    }
  }
  
  console.log('[progress] 🏁 processReadingProgress finished, readsMap size:', readsMap.size)
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

