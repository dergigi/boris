import { IndividualBookmark } from '../types/bookmarks'
import { extractUrlsFromContent } from '../services/bookmarkHelpers'
import { classifyUrl } from './helpers'

export type BookmarkType = 'article' | 'external' | 'video' | 'note' | 'web'

/**
 * Classifies a bookmark into one of the content types
 */
export function classifyBookmarkType(bookmark: IndividualBookmark): BookmarkType {
  // Kind 30023 is always a nostr-native article
  if (bookmark.kind === 30023) return 'article'

  const isWebBookmark = bookmark.kind === 39701
  const webBookmarkUrl = isWebBookmark ? bookmark.tags.find(t => t[0] === 'd')?.[1] : null
  
  const extractedUrls = webBookmarkUrl 
    ? [webBookmarkUrl.startsWith('http') ? webBookmarkUrl : `https://${webBookmarkUrl}`] 
    : extractUrlsFromContent(bookmark.content)
  
  const firstUrl = extractedUrls[0]
  if (!firstUrl) return 'note'

  const urlType = classifyUrl(firstUrl)?.type
  
  if (urlType === 'youtube' || urlType === 'video') return 'video'
  if (urlType === 'article') return 'external' // External article links
  
  return 'web'
}

/**
 * Filters bookmarks by type
 */
export function filterBookmarksByType(
  bookmarks: IndividualBookmark[],
  filterType: 'all' | BookmarkType
): IndividualBookmark[] {
  if (filterType === 'all') return bookmarks
  return bookmarks.filter(bookmark => classifyBookmarkType(bookmark) === filterType)
}

