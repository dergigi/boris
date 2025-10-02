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
    
    // Fetch bookmark lists (10003) and bookmarksets (30001)
    const rawEvents = await lastValueFrom(
      relayPool.req(relayUrls, {
        kinds: [10003, 30001],
        authors: [activeAccount.pubkey],
        limit: 50
      }).pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
    )
    // Deduplicate by id
    const bookmarkListEvents = Array.from(new Map(rawEvents.map((e: any) => [e.id, e])).values())
    
    if (bookmarkListEvents.length === 0) {
      setBookmarks([])
      setLoading(false)
      return
    }
    
    // Aggregate across all events
    const maybeAccount = activeAccount as any
    const signerCandidate = typeof maybeAccount?.signEvent === 'function' ? maybeAccount : maybeAccount?.signer
    const publicItemsAll: IndividualBookmark[] = []
    const privateItemsAll: IndividualBookmark[] = []
    let newestCreatedAt = 0
    let latestContent = ''
    let allTags: string[][] = []
    for (const evt of bookmarkListEvents) {
      newestCreatedAt = Math.max(newestCreatedAt, evt.created_at || 0)
      if (!latestContent && evt.content) latestContent = evt.content
      if (Array.isArray(evt.tags)) allTags = allTags.concat(evt.tags)
      // public
      const pub = Helpers.getPublicBookmarks(evt)
      publicItemsAll.push(...processApplesauceBookmarks(pub, activeAccount, false))
      // hidden
      try {
        const hasHidden = Helpers.hasHiddenTags(evt)
        const locked = Helpers.isHiddenTagsLocked(evt)
        const hasCiphertext = typeof evt.content === 'string' && evt.content.length > 0
        if (hasHidden && locked && hasCiphertext && signerCandidate) {
          await Helpers.unlockHiddenTags(evt, signerCandidate)
        }
        const priv = Helpers.getHiddenBookmarks(evt)
        privateItemsAll.push(...processApplesauceBookmarks(priv, activeAccount, true))
      } catch {
        // ignore per-event failures
      }
    }
    const allBookmarks = [...publicItemsAll, ...privateItemsAll]
    
    const bookmark: Bookmark = {
      id: `${activeAccount.pubkey}-bookmarks`,
      title: `Bookmarks (${allBookmarks.length})`,
      url: '',
      content: latestContent,
      created_at: newestCreatedAt || Date.now(),
      tags: allTags,
      bookmarkCount: allBookmarks.length,
      eventReferences: allTags.filter(tag => tag[0] === 'e').map(tag => tag[1]),
      individualBookmarks: allBookmarks,
      isPrivate: privateItemsAll.length > 0,
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