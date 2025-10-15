import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import { fetchReadArticles } from './libraryService'
import { queryEvents } from './dataFetch'
import { RELAYS } from '../config/relays'
import { classifyBookmarkType } from '../utils/bookmarkTypeClassifier'
import { nip19 } from 'nostr-tools'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

const APP_DATA_KIND = 30078 // NIP-78 Application Data
const READING_POSITION_PREFIX = 'boris:reading-position:'

export interface ReadItem {
  id: string // event ID or URL or coordinate
  source: 'bookmark' | 'reading-progress' | 'marked-as-read'
  type: 'article' | 'external' // article=kind:30023, external=URL
  
  // Article data
  event?: NostrEvent
  url?: string
  title?: string
  summary?: string
  image?: string
  published?: number
  author?: string
  
  // Reading metadata
  readingProgress?: number // 0-1
  readingTimestamp?: number // Unix timestamp of last reading activity
  markedAsRead?: boolean
  markedAt?: number
}

/**
 * Fetches all reads from multiple sources:
 * - Bookmarked articles (kind:30023) and article/website URLs
 * - Articles/URLs with reading progress (kind:30078)
 * - Manually marked as read articles/URLs (kind:7, kind:17)
 */
export async function fetchAllReads(
  relayPool: RelayPool,
  userPubkey: string,
  bookmarks: Bookmark[]
): Promise<ReadItem[]> {
  console.log('📚 [Reads] Fetching all reads for user:', userPubkey.slice(0, 8))
  
  try {
    // Fetch all data sources in parallel
    const [readingPositionEvents, markedAsReadArticles] = await Promise.all([
      queryEvents(relayPool, { kinds: [APP_DATA_KIND], authors: [userPubkey] }, { relayUrls: RELAYS }),
      fetchReadArticles(relayPool, userPubkey)
    ])

    console.log('📊 [Reads] Data fetched:', {
      readingPositions: readingPositionEvents.length,
      markedAsRead: markedAsReadArticles.length,
      bookmarks: bookmarks.length
    })

    // Map to deduplicate items by ID
    const readsMap = new Map<string, ReadItem>()

    // 1. Process reading position events
    for (const event of readingPositionEvents) {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1]
      if (!dTag || !dTag.startsWith(READING_POSITION_PREFIX)) continue

      const identifier = dTag.replace(READING_POSITION_PREFIX, '')
      
      try {
        const positionData = JSON.parse(event.content)
        const position = positionData.position
        const timestamp = positionData.timestamp

        // Decode identifier to get original URL or naddr
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

    // 2. Process marked-as-read articles
    for (const article of markedAsReadArticles) {
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

    // 3. Process bookmarked articles and article/website URLs
    const allBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
    
    for (const bookmark of allBookmarks) {
      const bookmarkType = classifyBookmarkType(bookmark)
      
      // Only include articles and external article/website bookmarks
      if (bookmarkType === 'article') {
        // Kind:30023 nostr article
        const coordinate = bookmark.id // Already in coordinate format
        const existing = readsMap.get(coordinate)
        
        if (!existing) {
          readsMap.set(coordinate, {
            id: coordinate,
            source: 'bookmark',
            type: 'article',
            readingProgress: 0,
            readingTimestamp: bookmark.added_at || bookmark.created_at
          })
        }
      } else if (bookmarkType === 'external') {
        // External article URL
        const urls = extractUrlFromBookmark(bookmark)
        if (urls.length > 0) {
          const url = urls[0]
          const existing = readsMap.get(url)
          
          if (!existing) {
            readsMap.set(url, {
              id: url,
              source: 'bookmark',
              type: 'external',
              url,
              readingProgress: 0,
              readingTimestamp: bookmark.added_at || bookmark.created_at
            })
          }
        }
      }
    }

    // 4. Fetch full event data for nostr articles
    const articleCoordinates = Array.from(readsMap.values())
      .filter(item => item.type === 'article' && !item.event)
      .map(item => item.id)

    if (articleCoordinates.length > 0) {
      console.log('📖 [Reads] Fetching article events for', articleCoordinates.length, 'articles')
      
      // Parse coordinates and fetch events
      const articlesToFetch: Array<{ pubkey: string; identifier: string }> = []
      
      for (const coord of articleCoordinates) {
        try {
          // Try to decode as naddr
          if (coord.startsWith('naddr1')) {
            const decoded = nip19.decode(coord)
            if (decoded.type === 'naddr' && decoded.data.kind === 30023) {
              articlesToFetch.push({
                pubkey: decoded.data.pubkey,
                identifier: decoded.data.identifier || ''
              })
            }
          } else {
            // Try coordinate format (kind:pubkey:identifier)
            const parts = coord.split(':')
            if (parts.length === 3 && parts[0] === '30023') {
              articlesToFetch.push({
                pubkey: parts[1],
                identifier: parts[2]
              })
            }
          }
        } catch (e) {
          console.warn('Failed to decode article coordinate:', coord)
        }
      }

      if (articlesToFetch.length > 0) {
        const authors = Array.from(new Set(articlesToFetch.map(a => a.pubkey)))
        const identifiers = Array.from(new Set(articlesToFetch.map(a => a.identifier)))
        
        const events = await queryEvents(
          relayPool,
          { kinds: [30023], authors, '#d': identifiers },
          { relayUrls: RELAYS }
        )

        // Merge event data into ReadItems
        for (const event of events) {
          const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
          const coordinate = `30023:${event.pubkey}:${dTag}`
          
          const item = readsMap.get(coordinate) || readsMap.get(event.id)
          if (item) {
            item.event = event
            item.title = getArticleTitle(event) || 'Untitled'
            item.summary = getArticleSummary(event)
            item.image = getArticleImage(event)
            item.published = getArticlePublished(event)
            item.author = event.pubkey
          }
        }
      }
    }

    // 5. Filter out items without timestamps and sort by most recent reading activity
    const sortedReads = Array.from(readsMap.values())
      .filter(item => {
        // Only include items that have a timestamp
        const hasTimestamp = (item.readingTimestamp && item.readingTimestamp > 0) || 
                            (item.markedAt && item.markedAt > 0)
        return hasTimestamp
      })
      .sort((a, b) => {
        const timeA = a.readingTimestamp || a.markedAt || 0
        const timeB = b.readingTimestamp || b.markedAt || 0
        return timeB - timeA
      })

    console.log('✅ [Reads] Processed', sortedReads.length, 'total reads')
    return sortedReads

  } catch (error) {
    console.error('Failed to fetch all reads:', error)
    return []
  }
}

// Helper to extract URL from bookmark content
function extractUrlFromBookmark(bookmark: IndividualBookmark): string[] {
  const urls: string[] = []
  
  // Check for web bookmark (kind 39701) with 'd' tag
  if (bookmark.kind === 39701) {
    const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1]
    if (dTag) {
      urls.push(dTag.startsWith('http') ? dTag : `https://${dTag}`)
    }
  }
  
  // Extract URLs from content
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const matches = bookmark.content.match(urlRegex)
  if (matches) {
    urls.push(...matches)
  }
  
  return urls
}

