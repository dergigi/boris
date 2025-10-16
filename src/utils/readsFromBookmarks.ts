import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import { ReadItem } from '../services/readsService'
import { classifyBookmarkType } from './bookmarkTypeClassifier'
import { KINDS } from '../config/kinds'
import { Helpers } from 'applesauce-core'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

/**
 * Derives ReadItems from bookmarks for Nostr articles (kind:30023).
 * Returns items with type='article', using hydrated event data when available.
 */
export function deriveReadsFromBookmarks(bookmarks: Bookmark[]): ReadItem[] {
  const readsMap = new Map<string, ReadItem>()
  
  const allBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
  
  for (const bookmark of allBookmarks) {
    const bookmarkType = classifyBookmarkType(bookmark)
    
    // Only include articles (kind:30023)
    if (bookmarkType === 'article' && bookmark.kind === KINDS.BlogPost) {
      const coordinate = bookmark.id // Already in coordinate format
      
      // Extract metadata from event if available
      const title = bookmark.event ? getArticleTitle(bookmark.event) : bookmark.title
      const summary = bookmark.event ? getArticleSummary(bookmark.event) : bookmark.summary
      const image = bookmark.event ? getArticleImage(bookmark.event) : bookmark.image
      const published = bookmark.event ? getArticlePublished(bookmark.event) : undefined
      
      const item: ReadItem = {
        id: coordinate,
        source: 'bookmark',
        type: 'article',
        readingProgress: 0,
        readingTimestamp: bookmark.added_at || bookmark.created_at,
        event: bookmark.event,
        title: title || 'Untitled',
        summary,
        image,
        published,
        author: bookmark.pubkey,
        url: bookmark.url
      }
      
      readsMap.set(coordinate, item)
    }
  }
  
  // Sort by most recent bookmark activity
  return Array.from(readsMap.values()).sort((a, b) => {
    const timeA = a.readingTimestamp || 0
    const timeB = b.readingTimestamp || 0
    return timeB - timeA
  })
}

