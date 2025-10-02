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
    console.log('🚀 NEW VERSION: Fetching bookmark list for pubkey:', activeAccount.pubkey)
    
    // Get relay URLs from the pool
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    
    // Step 1: Fetch both public bookmark lists (kind 10003) and private bookmark lists (kind 30001)
    const bookmarkListFilter: Filter = {
      kinds: [10003, 30001],
      authors: [activeAccount.pubkey],
      limit: 10 // Get multiple bookmark lists
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
    
    // Step 2: Process each bookmark list event
    const allBookmarks: Bookmark[] = []
    
    for (const bookmarkListEvent of bookmarkListEvents) {
      console.log('Processing bookmark list event:', bookmarkListEvent.id, 'kind:', bookmarkListEvent.kind)
      
      if (bookmarkListEvent.kind === 10003) {
        // Handle public bookmark lists (existing logic)
        const eventTags = bookmarkListEvent.tags.filter(tag => tag[0] === 'e')
        const eventIds = eventTags.map(tag => tag[1])
        
        console.log('Found event IDs in public bookmark list:', eventIds.length, eventIds)
        
        if (eventIds.length > 0) {
          // Fetch individual events for public bookmarks
          const individualBookmarks: IndividualBookmark[] = []
          
          for (const eventId of eventIds) {
            try {
              console.log('Fetching public event:', eventId)
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
                  type: 'event'
                })
                console.log('Successfully fetched public event:', event.id)
              }
            } catch (error) {
              console.error('Error fetching public event:', eventId, error)
            }
          }
          
          const bookmark: Bookmark = {
            id: bookmarkListEvent.id,
            title: bookmarkListEvent.content || `Public Bookmarks (${individualBookmarks.length} items)`,
            url: '',
            content: bookmarkListEvent.content,
            created_at: bookmarkListEvent.created_at,
            tags: bookmarkListEvent.tags,
            bookmarkCount: individualBookmarks.length,
            eventReferences: eventIds,
            individualBookmarks: individualBookmarks
          }
          
          allBookmarks.push(bookmark)
        }
      } else if (bookmarkListEvent.kind === 30001) {
        // Handle private bookmark lists (NIP-51)
        console.log('Processing private bookmark list:', bookmarkListEvent.id)
        
        try {
          // Extract public bookmarks from tags
          const publicBookmarks: IndividualBookmark[] = []
          const publicTags = bookmarkListEvent.tags.filter(tag => 
            tag[0] === 'r' || tag[0] === 'e' || tag[0] === 'a'
          )
          
          for (const tag of publicTags) {
            if (tag[0] === 'r' && tag[1]) {
              // URL bookmark
              publicBookmarks.push({
                id: `${bookmarkListEvent.id}-${tag[1]}`,
                content: tag[2] || tag[1],
                created_at: bookmarkListEvent.created_at,
                pubkey: bookmarkListEvent.pubkey,
                kind: bookmarkListEvent.kind,
                tags: [tag],
                type: 'article'
              })
            }
          }
          
          // Decrypt private bookmarks from content
          let privateBookmarks: IndividualBookmark[] = []
          
          if (bookmarkListEvent.content && activeAccount.signer) {
            try {
              console.log('Decrypting private bookmarks...')
              console.log('Signer methods:', Object.getOwnPropertyNames(activeAccount.signer))
              console.log('Signer prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(activeAccount.signer)))
              
              // Try different possible method names
              let decryptedContent = null
              if (typeof activeAccount.signer.nip44_decrypt === 'function') {
                decryptedContent = await activeAccount.signer.nip44_decrypt(
                  bookmarkListEvent.content,
                  activeAccount.pubkey
                )
              } else if (typeof activeAccount.signer.decrypt === 'function') {
                decryptedContent = await activeAccount.signer.decrypt(
                  bookmarkListEvent.content,
                  activeAccount.pubkey
                )
              } else if (typeof activeAccount.signer.nip44Decrypt === 'function') {
                decryptedContent = await activeAccount.signer.nip44Decrypt(
                  bookmarkListEvent.content,
                  activeAccount.pubkey
                )
              } else {
                console.log('No suitable decrypt method found on signer')
                throw new Error('No suitable decrypt method found on signer')
              }
              
              console.log('Decrypted content:', decryptedContent)
              
              // Parse the decrypted JSON content
              const privateTags = JSON.parse(decryptedContent)
              
              for (const tag of privateTags) {
                if (tag[0] === 'r' && tag[1]) {
                  // Private URL bookmark
                  privateBookmarks.push({
                    id: `${bookmarkListEvent.id}-private-${tag[1]}`,
                    content: tag[2] || tag[1],
                    created_at: bookmarkListEvent.created_at,
                    pubkey: bookmarkListEvent.pubkey,
                    kind: bookmarkListEvent.kind,
                    tags: [tag],
                    type: 'article'
                  })
                }
              }
              
              console.log('Decrypted private bookmarks:', privateBookmarks.length)
            } catch (decryptError) {
              console.error('Error decrypting private bookmarks:', decryptError)
            }
          }
          
          const allPrivateBookmarks = [...publicBookmarks, ...privateBookmarks]
          
          const bookmark: Bookmark = {
            id: bookmarkListEvent.id,
            title: bookmarkListEvent.content || `Private Bookmarks (${allPrivateBookmarks.length} items)`,
            url: '',
            content: bookmarkListEvent.content,
            created_at: bookmarkListEvent.created_at,
            tags: bookmarkListEvent.tags,
            bookmarkCount: allPrivateBookmarks.length,
            individualBookmarks: allPrivateBookmarks
          }
          
          allBookmarks.push(bookmark)
        } catch (error) {
          console.error('Error processing private bookmark list:', error)
        }
      }
    }
    
    console.log('Fetched all bookmarks:', allBookmarks.length)
    
    setBookmarks(allBookmarks)
    clearTimeout(timeoutId)
    setLoading(false)

  } catch (error) {
    console.error('Failed to fetch bookmarks:', error)
    clearTimeout(timeoutId)
    setLoading(false)
  }
}
