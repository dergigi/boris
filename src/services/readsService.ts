import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import { fetchReadArticles } from './libraryService'
import { queryEvents } from './dataFetch'
import { RELAYS } from '../config/relays'
import { KINDS } from '../config/kinds'
import { classifyBookmarkType } from '../utils/bookmarkTypeClassifier'
import { nip19 } from 'nostr-tools'
import { processReadingPositions, processMarkedAsRead, filterValidItems, sortByReadingActivity } from './readingDataProcessor'
import { mergeReadItem } from '../utils/readItemMerge'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

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
  bookmarks: Bookmark[],
  onItem?: (item: ReadItem) => void
): Promise<ReadItem[]> {
  console.log('📚 [Reads] Fetching all reads for user:', userPubkey.slice(0, 8))
  
  const readsMap = new Map<string, ReadItem>()
  
  // Helper to emit items as they're added/updated
  const emitItem = (item: ReadItem) => {
    if (onItem && mergeReadItem(readsMap, item)) {
      onItem(readsMap.get(item.id)!)
    } else if (!onItem) {
      readsMap.set(item.id, item)
    }
  }
  
  try {
    // Fetch all data sources in parallel
    const [readingPositionEvents, markedAsReadArticles] = await Promise.all([
      queryEvents(relayPool, { kinds: [KINDS.AppData], authors: [userPubkey] }, { relayUrls: RELAYS }),
      fetchReadArticles(relayPool, userPubkey)
    ])

    console.log('📊 [Reads] Data fetched:', {
      readingPositions: readingPositionEvents.length,
      markedAsRead: markedAsReadArticles.length,
      bookmarks: bookmarks.length
    })

    // Process reading positions and emit items
    processReadingPositions(readingPositionEvents, readsMap)
    if (onItem) {
      readsMap.forEach(item => {
        if (item.type === 'article') emitItem(item)
      })
    }
    
    // Process marked-as-read and emit items
    processMarkedAsRead(markedAsReadArticles, readsMap)
    if (onItem) {
      readsMap.forEach(item => {
        if (item.type === 'article') emitItem(item)
      })
    }

    // 3. Process bookmarked articles and article/website URLs
    const allBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
    
    for (const bookmark of allBookmarks) {
      const bookmarkType = classifyBookmarkType(bookmark)
      
      // Only include articles
      if (bookmarkType === 'article') {
        // Kind:30023 nostr article
        const coordinate = bookmark.id // Already in coordinate format
        const existing = readsMap.get(coordinate)
        
        if (!existing) {
          const item: ReadItem = {
            id: coordinate,
            source: 'bookmark',
            type: 'article',
            readingProgress: 0,
            readingTimestamp: bookmark.added_at || bookmark.created_at
          }
          readsMap.set(coordinate, item)
          if (onItem) emitItem(item)
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
            if (decoded.type === 'naddr' && decoded.data.kind === KINDS.BlogPost) {
              articlesToFetch.push({
                pubkey: decoded.data.pubkey,
                identifier: decoded.data.identifier || ''
              })
            }
          } else {
            // Try coordinate format (kind:pubkey:identifier)
            const parts = coord.split(':')
            if (parts.length === 3 && parseInt(parts[0]) === KINDS.BlogPost) {
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
          { kinds: [KINDS.BlogPost], authors, '#d': identifiers },
          { relayUrls: RELAYS }
        )

        // Merge event data into ReadItems and emit
        for (const event of events) {
          const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
          const coordinate = `${KINDS.BlogPost}:${event.pubkey}:${dTag}`
          
          const item = readsMap.get(coordinate) || readsMap.get(event.id)
          if (item) {
            item.event = event
            item.title = getArticleTitle(event) || 'Untitled'
            item.summary = getArticleSummary(event)
            item.image = getArticleImage(event)
            item.published = getArticlePublished(event)
            item.author = event.pubkey
            if (onItem) emitItem(item)
          }
        }
      }
    }

    // 5. Filter for Nostr articles only and apply common validation/sorting
    const articles = Array.from(readsMap.values())
      .filter(item => item.type === 'article')
    
    const validArticles = filterValidItems(articles)
    const sortedReads = sortByReadingActivity(validArticles)

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

