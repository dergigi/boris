import { RelayPool } from 'applesauce-relay'
import { completeOnEose } from 'applesauce-relay'
import { getParsedContent } from 'applesauce-content/text'
import { Filter } from 'nostr-tools'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { Bookmark, IndividualBookmark, ParsedContent, ActiveAccount } from '../types/bookmarks'

export const fetchBookmarks = async (
  relayPool: RelayPool,
  activeAccount: ActiveAccount,
  setBookmarks: (bookmarks: Bookmark[]) => void,
  setLoading: (loading: boolean) => void,
  timeoutId: number
) => {
  try {
    setLoading(true)
    console.log('🚀 Fetching bookmarks (public and private) for pubkey:', activeAccount.pubkey)
    
    // Get relay URLs from the pool
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    
    // Step 1: Fetch the bookmark list event (kind 10003)
    const bookmarkListFilter: Filter = {
      kinds: [10003],
      authors: [activeAccount.pubkey],
      limit: 1 // Just get the most recent bookmark list
    }
    
    console.log('Fetching bookmark list with filter:', bookmarkListFilter)
    const bookmarkListEvents = await lastValueFrom(
      relayPool.req(relayUrls, bookmarkListFilter).pipe(
        completeOnEose(),
        takeUntil(timer(10000)),
        toArray(),
      )
    )
    
    console.log('Found bookmark list events:', bookmarkListEvents.length)
    
    if (bookmarkListEvents.length === 0) {
      console.log('No bookmark list found')
      setBookmarks([])
      setLoading(false)
      return
    }
    
    // Step 2: Extract event IDs from the bookmark list
    const bookmarkListEvent = bookmarkListEvents[0]
    const eventTags = bookmarkListEvent.tags.filter(tag => tag[0] === 'e')
    const eventIds = eventTags.map(tag => tag[1])
    
    console.log('Found event IDs in bookmark list:', eventIds.length, eventIds)
    
    // Step 3: Fetch each individual event
    console.log('Fetching individual events...')
    const individualBookmarks: IndividualBookmark[] = []
    
    for (const eventId of eventIds) {
      try {
        console.log('Fetching event:', eventId)
        const eventFilter: Filter = {
          ids: [eventId]
        }
        
        const events = await lastValueFrom(
          relayPool.req(relayUrls, eventFilter).pipe(
            completeOnEose(),
            takeUntil(timer(5000)),
            toArray(),
          )
        )
        
        if (events.length > 0) {
          const event = events[0]
          const parsedContent = event.content ? getParsedContent(event.content) as ParsedContent : undefined
          
          individualBookmarks.push({
            id: event.id,
            content: event.content,
            created_at: event.created_at,
            pubkey: event.pubkey,
            kind: event.kind,
            tags: event.tags,
            parsedContent: parsedContent,
            type: 'event',
            isPrivate: false // Public bookmarks from event references
          })
          console.log('Successfully fetched event:', event.id)
        } else {
          console.log('Event not found:', eventId)
        }
      } catch (error) {
        console.error('Error fetching event:', eventId, error)
      }
    }
    
    console.log('Fetched individual bookmarks:', individualBookmarks.length)
    
    // Step 4: Check for private bookmarks in encrypted content
    let privateBookmarks: IndividualBookmark[] = []
    const isEncrypted = (content: string): boolean => {
      // Basic check for encrypted content (contains colons and base64-like characters)
      return content.includes(':') && /^[A-Za-z0-9+/=:]+$/.test(content)
    }
    
    if (isEncrypted(bookmarkListEvent.content)) {
      console.log('Found encrypted content - this may contain private bookmarks')
      // For now, we'll just mark the main bookmark as having private content
      // In a full implementation, you'd decrypt this content
    }
    
    // Combine public and private bookmarks
    const allBookmarks = [...individualBookmarks, ...privateBookmarks]
    
    // Create a single bookmark entry with all individual bookmarks
    const bookmark: Bookmark = {
      id: bookmarkListEvent.id,
      title: bookmarkListEvent.content || `Bookmark List (${allBookmarks.length} items)`,
      url: '',
      content: bookmarkListEvent.content,
      created_at: bookmarkListEvent.created_at,
      tags: bookmarkListEvent.tags,
      bookmarkCount: allBookmarks.length,
      eventReferences: eventIds,
      individualBookmarks: allBookmarks,
      isPrivate: isEncrypted(bookmarkListEvent.content),
      encryptedContent: isEncrypted(bookmarkListEvent.content) ? bookmarkListEvent.content : undefined
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
