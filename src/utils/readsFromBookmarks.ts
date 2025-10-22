import { Bookmark } from '../types/bookmarks'
import { ReadItem } from '../services/readsService'
import { classifyBookmarkType } from './bookmarkTypeClassifier'
import { KINDS } from '../config/kinds'
import { nip19 } from 'nostr-tools'

/**
 * Derives ReadItems from bookmarks for Nostr articles (kind:30023).
 * Returns items with type='article', using hydrated data when available.
 * Note: After hydration, article titles are in bookmark.content, metadata in tags.
 */
export function deriveReadsFromBookmarks(bookmarks: Bookmark[]): ReadItem[] {
  const readsMap = new Map<string, ReadItem>()
  
  const allBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
  
  for (const bookmark of allBookmarks) {
    const bookmarkType = classifyBookmarkType(bookmark)
    
    // Only include articles (kind:30023)
    if (bookmarkType === 'article' && bookmark.kind === KINDS.BlogPost) {
      const coordinate = bookmark.id // coordinate format: kind:pubkey:identifier
      
      // Extract identifier from coordinate
      const parts = coordinate.split(':')
      const identifier = parts[2] || ''
      
      // Convert to naddr format (reading positions use naddr as ID)
      let naddr: string
      try {
        naddr = nip19.naddrEncode({
          kind: KINDS.BlogPost,
          pubkey: bookmark.pubkey,
          identifier
        })
      } catch (e) {
        console.warn('Failed to encode naddr for bookmark:', coordinate)
        continue
      }
      
      // Extract metadata from tags (same as BookmarkItem does)
      const title = bookmark.content || 'Untitled'
      const image = bookmark.tags.find(t => t[0] === 'image')?.[1]
      const summary = bookmark.tags.find(t => t[0] === 'summary')?.[1]
      const published = bookmark.tags.find(t => t[0] === 'published_at')?.[1]
      
      const item: ReadItem = {
        id: naddr, // Use naddr format to match reading positions
        source: 'bookmark',
        type: 'article',
        readingProgress: 0,
        readingTimestamp: bookmark.created_at,
        title,
        summary,
        image,
        published: published ? parseInt(published) : undefined,
        author: bookmark.pubkey
      }
      
      readsMap.set(naddr, item)
    }
  }
  
  // Sort by most recent bookmark activity
  return Array.from(readsMap.values()).sort((a, b) => {
    const timeA = a.readingTimestamp || 0
    const timeB = b.readingTimestamp || 0
    return timeB - timeA
  })
}

