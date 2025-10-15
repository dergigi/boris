import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import { fetchReadArticles } from './libraryService'
import { queryEvents } from './dataFetch'
import { RELAYS } from '../config/relays'
import { classifyBookmarkType } from '../utils/bookmarkTypeClassifier'
import { nip19 } from 'nostr-tools'
import { processReadingPositions, processMarkedAsRead, filterValidItems, sortByReadingActivity } from './readingDataProcessor'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

const APP_DATA_KIND = 30078 // NIP-78 Application Data

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

    // Process data using shared utilities
    const readsMap = new Map<string, ReadItem>()
    processReadingPositions(readingPositionEvents, readsMap)
    processMarkedAsRead(markedAsReadArticles, readsMap)

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

