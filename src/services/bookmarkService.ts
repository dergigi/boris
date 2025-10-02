import { RelayPool } from 'applesauce-relay'
import { completeOnEose } from 'applesauce-relay'
import { getParsedContent } from 'applesauce-content/text'
import { Helpers } from 'applesauce-core'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { Bookmark, IndividualBookmark, ParsedContent, ActiveAccount } from '../types/bookmarks'

interface BookmarkData {
  id?: string
  content?: string
  created_at?: number
  kind?: number
  tags?: string[][]
}

export const fetchBookmarks = async (
  relayPool: RelayPool,
  activeAccount: ActiveAccount,
  setBookmarks: (bookmarks: Bookmark[]) => void,
  setLoading: (loading: boolean) => void,
  timeoutId: number
) => {
  try {
    setLoading(true)
    console.log('🚀 Using applesauce bookmark helpers for pubkey:', activeAccount.pubkey)
    
    // Get relay URLs from the pool
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    
    // Fetch bookmark list
    const bookmarkListEvents = await lastValueFrom(
      relayPool.req(relayUrls, {
        kinds: [10003],
        authors: [activeAccount.pubkey],
        limit: 1
      }).pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
    )
    
    if (bookmarkListEvents.length === 0) {
      setBookmarks([])
      setLoading(false)
      return
    }
    
    const bookmarkListEvent = bookmarkListEvents[0]
    console.log('Found bookmark list event:', bookmarkListEvent.id)
    
    // Use applesauce helpers to get all bookmarks (public and private)
    const publicBookmarks = Helpers.getPublicBookmarks(bookmarkListEvent)
    const privateBookmarks = Helpers.getHiddenBookmarks(bookmarkListEvent)
    
    console.log('Public bookmarks:', publicBookmarks)
    console.log('Private bookmarks:', privateBookmarks)
    
    // Convert to our format
    const allBookmarks: IndividualBookmark[] = []
    
    // Add public bookmarks
    if (publicBookmarks) {
      const publicArray = Array.isArray(publicBookmarks) ? publicBookmarks : [publicBookmarks]
      const publicItems = publicArray.map((bookmark: BookmarkData) => ({
        id: bookmark.id || `public-${Date.now()}`,
        content: bookmark.content || '',
        created_at: bookmark.created_at || Date.now(),
        pubkey: activeAccount.pubkey,
        kind: bookmark.kind || 30001,
        tags: bookmark.tags || [],
        parsedContent: bookmark.content ? getParsedContent(bookmark.content) as ParsedContent : undefined,
        type: 'event' as const,
        isPrivate: false
      }))
      allBookmarks.push(...publicItems)
    }
    
    // Add private bookmarks
    if (privateBookmarks) {
      const privateArray = Array.isArray(privateBookmarks) ? privateBookmarks : [privateBookmarks]
      const privateItems = privateArray.map((bookmark: BookmarkData) => ({
        id: bookmark.id || `private-${Date.now()}`,
        content: bookmark.content || '',
        created_at: bookmark.created_at || Date.now(),
        pubkey: activeAccount.pubkey,
        kind: bookmark.kind || 30001,
        tags: bookmark.tags || [],
        parsedContent: bookmark.content ? getParsedContent(bookmark.content) as ParsedContent : undefined,
        type: 'event' as const,
        isPrivate: true
      }))
      allBookmarks.push(...privateItems)
    }
    
    console.log('Total bookmarks found:', allBookmarks.length)
    
    const bookmark: Bookmark = {
      id: bookmarkListEvent.id,
      title: bookmarkListEvent.content || `Bookmark List (${allBookmarks.length} items)`,
      url: '',
      content: bookmarkListEvent.content,
      created_at: bookmarkListEvent.created_at,
      tags: bookmarkListEvent.tags,
      bookmarkCount: allBookmarks.length,
      eventReferences: bookmarkListEvent.tags.filter(tag => tag[0] === 'e').map(tag => tag[1]),
      individualBookmarks: allBookmarks,
      isPrivate: privateBookmarks && (Array.isArray(privateBookmarks) ? privateBookmarks.length > 0 : true),
      encryptedContent: undefined
    }
    
    setBookmarks([bookmark])
    clearTimeout(timeoutId)
    setLoading(false)

  } catch (error) {
    console.error('Failed to fetch bookmarks:', error)
    clearTimeout(timeoutId)
    setLoading(false)
  }
}