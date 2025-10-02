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
  signer?: unknown
  [key: string]: unknown // Allow any properties from the full account object
}

// Type guard to check if an object has the required properties
function isAccountWithExtension(account: unknown): account is AccountWithExtension {
  return typeof account === 'object' && account !== null && 'pubkey' in account
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
  
  // Fallback: map array-like bookmarks
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



export const fetchBookmarks = async (
  relayPool: RelayPool,
  activeAccount: unknown, // Full account object with extension capabilities
  setBookmarks: (bookmarks: Bookmark[]) => void,
  setLoading: (loading: boolean) => void,
  timeoutId: number
) => {
  try {
    setLoading(true)
    
    // Type check the account object
    if (!isAccountWithExtension(activeAccount)) {
      throw new Error('Invalid account object provided')
    }
    
    console.log('🚀 Using applesauce bookmark helpers for pubkey:', activeAccount.pubkey)
    
    // Get relay URLs from the pool
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    
    // Fetch ALL bookmark list events (not just 1) to find private bookmarks
    const bookmarkListEvents = await lastValueFrom(
      relayPool.req(relayUrls, {
        kinds: [10003],
        authors: [activeAccount.pubkey],
        limit: 10 // Fetch more events to find private bookmarks
      }).pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
    )
    
    if (bookmarkListEvents.length === 0) {
      setBookmarks([])
      setLoading(false)
      return
    }
    
    console.log(`Found ${bookmarkListEvents.length} bookmark list events`)
    
    // Check all bookmark list events for encrypted content
    let bookmarkListEvent = null
    
    for (let i = 0; i < bookmarkListEvents.length; i++) {
      const event = bookmarkListEvents[i]
      console.log(`Event ${i}: ${event.id}`)
      console.log(`  Tags: ${event.tags.length} tags`)
      
      // Check if this event has encrypted content
      const isEncrypted = event.content && 
        (event.content.includes('?iv=') || 
         event.content.includes('?version=') ||
         event.content.startsWith('nip44:') ||
         event.content.startsWith('nip04:'))
      
      if (isEncrypted) {
        console.log(`  🎯 FOUND ENCRYPTED CONTENT in event ${i}!`)
        bookmarkListEvent = event
        break
      }
    }
    
    // If no encrypted content found, use the first event
    if (!bookmarkListEvent) {
      bookmarkListEvent = bookmarkListEvents[0]
      console.log('No encrypted content found, using first event')
    }
    
    console.log('Selected bookmark list event:', bookmarkListEvent.id)
    
    // Use applesauce helpers to get public bookmarks
    const publicBookmarks = Helpers.getPublicBookmarks(bookmarkListEvent)
    console.log('Public bookmarks:', publicBookmarks)
    
    // Try to get private bookmarks - this should trigger browser extension if needed
    let privateBookmarks = null
    try {
      console.log('Attempting to get hidden bookmarks...')
      const locked = Helpers.isHiddenTagsLocked(bookmarkListEvent)
      console.log('Hidden tags locked:', locked)
      const maybeAccount = activeAccount as any
      const signerCandidate = typeof maybeAccount?.signEvent === 'function' ? maybeAccount : maybeAccount?.signer
      if (locked && signerCandidate) {
        await Helpers.unlockHiddenTags(bookmarkListEvent, signerCandidate)
      }
      privateBookmarks = Helpers.getHiddenBookmarks(bookmarkListEvent)
      console.log('Private bookmarks result:', privateBookmarks)
    } catch (error) {
      console.log('Failed to get private bookmarks:', error)
      privateBookmarks = null
    }
    
    
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