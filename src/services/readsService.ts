import { RelayPool } from 'applesauce-relay'
import { Helpers } from 'applesauce-core'
import { Bookmark } from '../types/bookmarks'
import { fetchReadArticles } from './libraryService'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { classifyBookmarkType } from '../utils/bookmarkTypeClassifier'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { processReadingProgress, processMarkedAsRead, filterValidItems, sortByReadingActivity } from './readingDataProcessor'
import { mergeReadItem } from '../utils/readItemMerge'
import type { ReadItem } from './readsController'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

// Re-export ReadItem from readsController for consistency
export type { ReadItem } from './readsController'

/**
 * Fetches all reads from multiple sources:
 * - Bookmarked articles (kind:30023) and article/website URLs
 * - Articles/URLs with reading progress (kind:39802)
 * - Manually marked as read articles/URLs (kind:7, kind:17)
 */
export async function fetchAllReads(
  relayPool: RelayPool,
  userPubkey: string,
  bookmarks: Bookmark[],
  onItem?: (item: ReadItem) => void
): Promise<ReadItem[]> {
  
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
    const [progressEvents, markedAsReadArticles] = await Promise.all([
      queryEvents(relayPool, { kinds: [KINDS.ReadingProgress], authors: [userPubkey] }),
      fetchReadArticles(relayPool, userPubkey)
    ])

    // Process reading progress events (kind 39802)
    processReadingProgress(progressEvents, readsMap)
    
    // Process marked-as-read and emit items
    processMarkedAsRead(markedAsReadArticles, readsMap)
    if (onItem) {
      readsMap.forEach(item => {
        onItem(item)
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
            readingTimestamp: bookmark.created_at ?? undefined
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
      
      // Parse coordinates and fetch events
      const articlesToFetch: Array<{ pubkey: string; identifier: string }> = []
      
      for (const coord of articleCoordinates) {
        try {
          // Try to decode as naddr
          if (coord.startsWith('naddr1')) {
            const decoded = nip19.decode(coord)
            if (decoded.type === 'naddr') {
              const data = decoded.data as AddressPointer
              if (data.kind === KINDS.BlogPost) {
                articlesToFetch.push({
                  pubkey: data.pubkey,
                  identifier: data.identifier || ''
                })
              }
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
          { kinds: [KINDS.BlogPost], authors, '#d': identifiers }
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

    return sortedReads

  } catch (error) {
    console.error('Failed to fetch all reads:', error)
    return []
  }
}
