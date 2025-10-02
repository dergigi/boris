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

interface ApplesauceBookmarks {
  notes?: BookmarkData[]
  articles?: BookmarkData[]
  hashtags?: BookmarkData[]
  urls?: BookmarkData[]
}

interface AccountWithExtension {
  pubkey: string
  [key: string]: unknown // Allow other properties from the full account object
}


const processBookmarks = (
  bookmarks: unknown,
  activeAccount: ActiveAccount,
  isPrivate: boolean
): IndividualBookmark[] => {
  if (!bookmarks) return []
  
  const bookmarkArray = Array.isArray(bookmarks) ? bookmarks : [bookmarks]
  return bookmarkArray.map((bookmark: BookmarkData) => ({
    id: bookmark.id || `${isPrivate ? 'private' : 'public'}-${Date.now()}`,
    content: bookmark.content || '',
    created_at: bookmark.created_at || Date.now(),
    pubkey: activeAccount.pubkey,
    kind: bookmark.kind || 30001,
    tags: bookmark.tags || [],
    parsedContent: bookmark.content ? getParsedContent(bookmark.content) as ParsedContent : undefined,
    type: 'event' as const,
    isPrivate
  }))
}

const processApplesauceBookmarks = (
  bookmarks: unknown,
  activeAccount: ActiveAccount,
  isPrivate: boolean
): IndividualBookmark[] => {
  if (!bookmarks) return []
  
  // Handle applesauce structure: {notes: [], articles: [], hashtags: [], urls: []}
  if (typeof bookmarks === 'object' && bookmarks !== null && !Array.isArray(bookmarks)) {
    const applesauceBookmarks = bookmarks as ApplesauceBookmarks
    const allItems: BookmarkData[] = []
    
    if (applesauceBookmarks.notes) allItems.push(...applesauceBookmarks.notes)
    if (applesauceBookmarks.articles) allItems.push(...applesauceBookmarks.articles)
    if (applesauceBookmarks.hashtags) allItems.push(...applesauceBookmarks.hashtags)
    if (applesauceBookmarks.urls) allItems.push(...applesauceBookmarks.urls)
    
    return allItems.map((bookmark: BookmarkData) => ({
      id: bookmark.id || `${isPrivate ? 'private' : 'public'}-${Date.now()}`,
      content: bookmark.content || '',
      created_at: bookmark.created_at || Date.now(),
      pubkey: activeAccount.pubkey,
      kind: bookmark.kind || 30001,
      tags: bookmark.tags || [],
      parsedContent: bookmark.content ? getParsedContent(bookmark.content) as ParsedContent : undefined,
      type: 'event' as const,
      isPrivate
    }))
  }
  
  // Fallback to original processing for arrays
  return processBookmarks(bookmarks, activeAccount, isPrivate)
}



export const fetchBookmarks = async (
  relayPool: RelayPool,
  activeAccount: AccountWithExtension, // Full account object with extension capabilities
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
    
    
    // Process bookmarks using DRY helper function
    // Handle the structure that applesauce returns: {notes: [], articles: [], hashtags: [], urls: []}
    const publicItems = processApplesauceBookmarks(publicBookmarks, activeAccount, false)
    const privateItems = processApplesauceBookmarks(privateBookmarks, activeAccount, true)
    const allBookmarks = [...publicItems, ...privateItems]
    
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
      isPrivate: privateItems.length > 0,
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