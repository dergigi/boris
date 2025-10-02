import { RelayPool } from 'applesauce-relay'
import { completeOnEose } from 'applesauce-relay'
import { getParsedContent } from 'applesauce-content/text'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { Bookmark, IndividualBookmark, ParsedContent, ActiveAccount } from '../types/bookmarks'

const isEncrypted = (content: string): boolean => 
  content.includes(':') && /^[A-Za-z0-9+/=:]+$/.test(content)

const fetchEvent = async (relayPool: RelayPool, relayUrls: string[], eventId: string): Promise<IndividualBookmark | null> => {
  try {
    const events = await lastValueFrom(
      relayPool.req(relayUrls, { ids: [eventId] }).pipe(
        completeOnEose(),
        takeUntil(timer(5000)),
        toArray(),
      )
    )
    
    if (events.length === 0) return null
    
    const event = events[0]
    return {
      id: event.id,
      content: event.content,
      created_at: event.created_at,
      pubkey: event.pubkey,
      kind: event.kind,
      tags: event.tags,
      parsedContent: event.content ? getParsedContent(event.content) as ParsedContent : undefined,
      type: 'event',
      isPrivate: false
    }
  } catch (error) {
    console.error('Error fetching event:', eventId, error)
    return null
  }
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
    const eventIds = bookmarkListEvent.tags.filter(tag => tag[0] === 'e').map(tag => tag[1])
    
    // Fetch individual bookmarks
    const individualBookmarks = await Promise.all(
      eventIds.map(eventId => fetchEvent(relayPool, relayUrls, eventId))
    )
    
    const validBookmarks = individualBookmarks.filter(Boolean) as IndividualBookmark[]
    const hasPrivateContent = isEncrypted(bookmarkListEvent.content)
    
    const bookmark: Bookmark = {
      id: bookmarkListEvent.id,
      title: bookmarkListEvent.content || `Bookmark List (${validBookmarks.length} items)`,
      url: '',
      content: bookmarkListEvent.content,
      created_at: bookmarkListEvent.created_at,
      tags: bookmarkListEvent.tags,
      bookmarkCount: validBookmarks.length,
      eventReferences: eventIds,
      individualBookmarks: validBookmarks,
      isPrivate: hasPrivateContent,
      encryptedContent: hasPrivateContent ? bookmarkListEvent.content : undefined
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
