import { Bookmark } from '../types/bookmarks'
import { ReadItem } from '../services/readsService'
import { KINDS } from '../config/kinds'
import { fallbackTitleFromUrl } from './readItemMerge'

/**
 * Derives ReadItems from bookmarks for external URLs:
 * - Web bookmarks (kind:39701)
 * - Any bookmark with http(s) URLs in content or urlReferences
 */
export function deriveLinksFromBookmarks(bookmarks: Bookmark[]): ReadItem[] {
  const linksMap = new Map<string, ReadItem>()
  
  const allBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
  
  for (const bookmark of allBookmarks) {
    const urls: string[] = []
    
    // Web bookmarks (kind:39701) - extract from 'd' tag
    if (bookmark.kind === KINDS.WebBookmark) {
      const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1]
      if (dTag) {
        const url = dTag.startsWith('http') ? dTag : `https://${dTag}`
        urls.push(url)
      }
    }
    
    // Extract URLs from content if not already captured
    if (bookmark.content) {
      const urlRegex = /(https?:\/\/[^\s]+)/g
      const matches = bookmark.content.match(urlRegex)
      if (matches) {
        urls.push(...matches)
      }
    }
    
    // Extract metadata from tags (for web bookmarks and other types)
    const title = bookmark.tags.find(t => t[0] === 'title')?.[1]
    const summary = bookmark.tags.find(t => t[0] === 'summary')?.[1]
    const image = bookmark.tags.find(t => t[0] === 'image')?.[1]
    
    // Create ReadItem for each unique URL
    for (const url of [...new Set(urls)]) {
      if (!linksMap.has(url)) {
        const item: ReadItem = {
          id: url,
          source: 'bookmark',
          type: 'external',
          url,
          title: title || fallbackTitleFromUrl(url),
          summary,
          image,
          readingProgress: 0,
          readingTimestamp: bookmark.created_at ?? undefined
        }
        
        linksMap.set(url, item)
      }
    }
  }
  
  // Sort by most recent bookmark activity
  return Array.from(linksMap.values()).sort((a, b) => {
    const timeA = a.readingTimestamp || 0
    const timeB = b.readingTimestamp || 0
    return timeB - timeA
  })
}

