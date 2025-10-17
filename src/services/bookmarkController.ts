import { RelayPool } from 'applesauce-relay'
import { Helpers } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { collectBookmarksFromEvents } from './bookmarkProcessing'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import {
  AccountWithExtension,
  hydrateItems,
  dedupeBookmarksById,
  extractUrlsFromContent
} from './bookmarkHelpers'

/**
 * Get unique key for event deduplication (from Debug)
 */
function getEventKey(evt: NostrEvent): string {
  if (evt.kind === 30003 || evt.kind === 30001) {
    const dTag = evt.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
    return `${evt.kind}:${evt.pubkey}:${dTag}`
  } else if (evt.kind === 10003) {
    return `${evt.kind}:${evt.pubkey}`
  }
  return evt.id
}

/**
 * Check if event has encrypted content (from Debug)
 */
function hasEncryptedContent(evt: NostrEvent): boolean {
  if (Helpers.hasHiddenContent(evt)) return true
  if (evt.content && evt.content.includes('?iv=')) return true
  if (Helpers.hasHiddenTags(evt) && !Helpers.isHiddenTagsUnlocked(evt)) return true
  return false
}

type RawEventCallback = (event: NostrEvent) => void
type BookmarksCallback = (bookmarks: Bookmark[]) => void
type LoadingCallback = (loading: boolean) => void
type DecryptCompleteCallback = (eventId: string, publicCount: number, privateCount: number) => void

/**
 * Shared bookmark streaming controller
 * Encapsulates the Debug flow: stream events, dedupe, decrypt, build bookmarks
 */
class BookmarkController {
  private rawEventListeners: RawEventCallback[] = []
  private bookmarksListeners: BookmarksCallback[] = []
  private loadingListeners: LoadingCallback[] = []
  private decryptCompleteListeners: DecryptCompleteCallback[] = []
  
  private currentEvents: Map<string, NostrEvent> = new Map()
  private decryptedResults: Map<string, { 
    publicItems: IndividualBookmark[]
    privateItems: IndividualBookmark[]
    newestCreatedAt?: number
    latestContent?: string
    allTags?: string[][]
  }> = new Map()
  private isLoading = false

  onRawEvent(cb: RawEventCallback): () => void {
    this.rawEventListeners.push(cb)
    return () => {
      this.rawEventListeners = this.rawEventListeners.filter(l => l !== cb)
    }
  }

  onBookmarks(cb: BookmarksCallback): () => void {
    this.bookmarksListeners.push(cb)
    return () => {
      this.bookmarksListeners = this.bookmarksListeners.filter(l => l !== cb)
    }
  }

  onLoading(cb: LoadingCallback): () => void {
    this.loadingListeners.push(cb)
    return () => {
      this.loadingListeners = this.loadingListeners.filter(l => l !== cb)
    }
  }

  onDecryptComplete(cb: DecryptCompleteCallback): () => void {
    this.decryptCompleteListeners.push(cb)
    return () => {
      this.decryptCompleteListeners = this.decryptCompleteListeners.filter(l => l !== cb)
    }
  }

  reset(): void {
    this.currentEvents.clear()
    this.decryptedResults.clear()
    this.setLoading(false)
  }

  private setLoading(loading: boolean): void {
    if (this.isLoading !== loading) {
      this.isLoading = loading
      this.loadingListeners.forEach(cb => cb(loading))
    }
  }

  private emitRawEvent(evt: NostrEvent): void {
    this.rawEventListeners.forEach(cb => cb(evt))
  }

  private async buildAndEmitBookmarks(
    relayPool: RelayPool,
    activeAccount: AccountWithExtension,
    signerCandidate: unknown
  ): Promise<void> {
    const allEvents = Array.from(this.currentEvents.values())
    
    // Include unencrypted events OR encrypted events that have been decrypted
    const readyEvents = allEvents.filter(evt => {
      const isEncrypted = hasEncryptedContent(evt)
      if (!isEncrypted) return true // Include unencrypted
      // Include encrypted if already decrypted
      return this.decryptedResults.has(getEventKey(evt))
    })
    
    const unencryptedCount = allEvents.filter(evt => !hasEncryptedContent(evt)).length
    const decryptedCount = readyEvents.length - unencryptedCount
    console.log('[bookmark] 📋 Building bookmarks:', unencryptedCount, 'unencrypted,', decryptedCount, 'decrypted, of', allEvents.length, 'total')
    
    if (readyEvents.length === 0) {
      this.bookmarksListeners.forEach(cb => cb([]))
      return
    }

    try {
      // Separate unencrypted and decrypted events
      const unencryptedEvents = readyEvents.filter(evt => !hasEncryptedContent(evt))
      const decryptedEvents = readyEvents.filter(evt => hasEncryptedContent(evt))
      
      console.log('[bookmark] 🔧 Processing', unencryptedEvents.length, 'unencrypted events')
      // Process unencrypted events
      const { publicItemsAll: publicUnencrypted, privateItemsAll: privateUnencrypted, newestCreatedAt, latestContent, allTags } = 
        await collectBookmarksFromEvents(unencryptedEvents, activeAccount, signerCandidate)
      console.log('[bookmark] 🔧 Unencrypted returned:', publicUnencrypted.length, 'public,', privateUnencrypted.length, 'private')
      
      // Merge in decrypted results
      let publicItemsAll = [...publicUnencrypted]
      let privateItemsAll = [...privateUnencrypted]
      
      console.log('[bookmark] 🔧 Merging', decryptedEvents.length, 'decrypted events')
      decryptedEvents.forEach(evt => {
        const eventKey = getEventKey(evt)
        const decrypted = this.decryptedResults.get(eventKey)
        if (decrypted) {
          publicItemsAll = [...publicItemsAll, ...decrypted.publicItems]
          privateItemsAll = [...privateItemsAll, ...decrypted.privateItems]
        }
      })
      
      console.log('[bookmark] 🔧 Total after merge:', publicItemsAll.length, 'public,', privateItemsAll.length, 'private')

      const allItems = [...publicItemsAll, ...privateItemsAll]
      console.log('[bookmark] 🔧 Total items to process:', allItems.length)
      
      // Separate hex IDs from coordinates
      const noteIds: string[] = []
      const coordinates: string[] = []
      
      allItems.forEach(i => {
        if (/^[0-9a-f]{64}$/i.test(i.id)) {
          noteIds.push(i.id)
        } else if (i.id.includes(':')) {
          coordinates.push(i.id)
        }
      })
      
      // Helper to build and emit bookmarks
      const emitBookmarks = (idToEvent: Map<string, NostrEvent>) => {
        console.log('[bookmark] 🔧 Building final bookmarks list...')
        const allBookmarks = dedupeBookmarksById([
          ...hydrateItems(publicItemsAll, idToEvent),
          ...hydrateItems(privateItemsAll, idToEvent)
        ])
        console.log('[bookmark] 🔧 After hydration and dedup:', allBookmarks.length, 'bookmarks')

        console.log('[bookmark] 🔧 Enriching and sorting...')
        const enriched = allBookmarks.map(b => ({
          ...b,
          tags: b.tags || [],
          content: b.content || ''
        }))
        
        const sortedBookmarks = enriched
          .map(b => ({ ...b, urlReferences: extractUrlsFromContent(b.content) }))
          .sort((a, b) => ((b.added_at || 0) - (a.added_at || 0)) || ((b.created_at || 0) - (a.created_at || 0)))
        console.log('[bookmark] 🔧 Sorted:', sortedBookmarks.length, 'bookmarks')

        console.log('[bookmark] 🔧 Creating final Bookmark object...')
        const bookmark: Bookmark = {
          id: `${activeAccount.pubkey}-bookmarks`,
          title: `Bookmarks (${sortedBookmarks.length})`,
          url: '',
          content: latestContent,
          created_at: newestCreatedAt || Math.floor(Date.now() / 1000),
          tags: allTags,
          bookmarkCount: sortedBookmarks.length,
          eventReferences: allTags.filter((tag: string[]) => tag[0] === 'e').map((tag: string[]) => tag[1]),
          individualBookmarks: sortedBookmarks,
          isPrivate: privateItemsAll.length > 0,
          encryptedContent: undefined
        }
        
        console.log('[bookmark] 📋 Built bookmark with', sortedBookmarks.length, 'items')
        console.log('[bookmark] 📤 Emitting to', this.bookmarksListeners.length, 'listeners')
        this.bookmarksListeners.forEach(cb => cb([bookmark]))
      }

      // Emit immediately with empty metadata (show placeholders)
      const idToEvent: Map<string, NostrEvent> = new Map()
      console.log('[bookmark] 🚀 Emitting initial bookmarks with placeholders (IDs only)...')
      emitBookmarks(idToEvent)

      // Now fetch events progressively in background (non-blocking)
      console.log('[bookmark] 🔧 Background fetch:', noteIds.length, 'note IDs and', coordinates.length, 'coordinates')
      
      // Skip fetching if there are too many (would be too slow)
      const MAX_IDS_TO_FETCH = 100
      if (noteIds.length > MAX_IDS_TO_FETCH) {
        console.log('[bookmark] ⏭️ Skipping event fetch (', noteIds.length, '> max', MAX_IDS_TO_FETCH, ') - showing IDs only')
      } else if (noteIds.length > 0) {
        console.log('[bookmark] 🔧 Fetching', noteIds.length, 'events by ID in background...')
        queryEvents(
          relayPool,
          { ids: Array.from(new Set(noteIds)) },
          {}
        ).then(fetchedEvents => {
          console.log('[bookmark] 🔧 Fetched', fetchedEvents.length, 'events by ID')
          fetchedEvents.forEach((e: NostrEvent) => {
            idToEvent.set(e.id, e)
            if (e.kind && e.kind >= 30000 && e.kind < 40000) {
              const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
              const coordinate = `${e.kind}:${e.pubkey}:${dTag}`
              idToEvent.set(coordinate, e)
            }
          })
          console.log('[bookmark] 🔄 Re-emitting with hydrated ID events...')
          emitBookmarks(idToEvent)
        }).catch(error => {
          console.warn('[bookmark] ⚠️ Failed to fetch events by ID:', error)
        })
      }
      
      // Fetch addressable events by coordinates (non-blocking)
      const MAX_COORDS_TO_FETCH = 100
      if (coordinates.length > MAX_COORDS_TO_FETCH) {
        console.log('[bookmark] ⏭️ Skipping coordinate fetch (', coordinates.length, '> max', MAX_COORDS_TO_FETCH, ') - showing IDs only')
      } else if (coordinates.length > 0) {
        console.log('[bookmark] 🔧 Fetching', coordinates.length, 'addressable events in background...')
        const byKind = new Map<number, Array<{ pubkey: string; identifier: string }>>()
        
        coordinates.forEach(coord => {
          const parts = coord.split(':')
          const kind = parseInt(parts[0])
          const pubkey = parts[1]
          const identifier = parts[2] || ''
          
          if (!byKind.has(kind)) {
            byKind.set(kind, [])
          }
          byKind.get(kind)!.push({ pubkey, identifier })
        })
        
        Promise.all(
          Array.from(byKind.entries()).map(([kind, items]) => {
            const authors = Array.from(new Set(items.map(i => i.pubkey)))
            const identifiers = Array.from(new Set(items.map(i => i.identifier)))
            
            return queryEvents(
              relayPool,
              { kinds: [kind], authors, '#d': identifiers },
              {}
            )
          })
        ).then(results => {
          const allFetched = results.flat()
          console.log('[bookmark] 🔧 Fetched', allFetched.length, 'addressable events')
          allFetched.forEach((e: NostrEvent) => {
            const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
            const coordinate = `${e.kind}:${e.pubkey}:${dTag}`
            idToEvent.set(coordinate, e)
            idToEvent.set(e.id, e)
          })
          console.log('[bookmark] 🔄 Re-emitting with all metadata loaded...')
          emitBookmarks(idToEvent)
        }).catch(error => {
          console.warn('[bookmark] ⚠️ Failed to fetch addressable events:', error)
        })
      }
    } catch (error) {
      console.error('[bookmark] ❌ Failed to build bookmarks:', error)
      console.error('[bookmark] ❌ Error details:', error instanceof Error ? error.message : String(error))
      console.error('[bookmark] ❌ Stack:', error instanceof Error ? error.stack : 'no stack')
      this.bookmarksListeners.forEach(cb => cb([]))
    }
  }

  async start(options: {
    relayPool: RelayPool
    activeAccount: unknown
    accountManager: { getActive: () => unknown }
  }): Promise<void> {
    const { relayPool, activeAccount, accountManager } = options

    if (!activeAccount || typeof (activeAccount as { pubkey?: string }).pubkey !== 'string') {
      console.error('[bookmark] Invalid activeAccount')
      return
    }

    const account = activeAccount as { pubkey: string; [key: string]: unknown }

    this.setLoading(true)
    console.log('[bookmark] 🔍 Starting bookmark load for', account.pubkey.slice(0, 8))

    try {
      // Get signer for auto-decryption
      const fullAccount = accountManager.getActive() as AccountWithExtension | null
      const maybeAccount = (fullAccount || account) as AccountWithExtension
      let signerCandidate: unknown = maybeAccount
      const hasNip04Prop = (signerCandidate as { nip04?: unknown })?.nip04 !== undefined
      const hasNip44Prop = (signerCandidate as { nip44?: unknown })?.nip44 !== undefined
      if (signerCandidate && !hasNip04Prop && !hasNip44Prop && maybeAccount?.signer) {
        signerCandidate = maybeAccount.signer
      }

      // Stream events with live deduplication (same as Debug)
      await queryEvents(
        relayPool,
        { kinds: [KINDS.ListSimple, KINDS.ListReplaceable, KINDS.List, KINDS.WebBookmark], authors: [account.pubkey] },
        {
          onEvent: (evt) => {
            const key = getEventKey(evt)
            const existing = this.currentEvents.get(key)
            
            if (existing && (existing.created_at || 0) >= (evt.created_at || 0)) {
              return // Keep existing (it's newer)
            }
            
            // Add/update event
            this.currentEvents.set(key, evt)
            console.log('[bookmark] 📨 Event:', evt.kind, evt.id.slice(0, 8), 'encrypted:', hasEncryptedContent(evt))
            
            // Emit raw event for Debug UI
            this.emitRawEvent(evt)
            
            // Build bookmarks immediately for unencrypted events
            const isEncrypted = hasEncryptedContent(evt)
            if (!isEncrypted) {
              // For unencrypted events, build bookmarks immediately (progressive update)
              this.buildAndEmitBookmarks(relayPool, maybeAccount, signerCandidate)
                .catch(err => console.error('[bookmark] ❌ Failed to update after event:', err))
            }
            
            // Auto-decrypt if event has encrypted content (fire-and-forget, non-blocking)
            if (isEncrypted) {
              console.log('[bookmark] 🔓 Auto-decrypting event', evt.id.slice(0, 8))
              // Don't await - let it run in background
              collectBookmarksFromEvents([evt], account, signerCandidate)
                .then(({ publicItemsAll, privateItemsAll, newestCreatedAt, latestContent, allTags }) => {
                  const eventKey = getEventKey(evt)
                  // Store the actual decrypted items, not just counts
                  this.decryptedResults.set(eventKey, { 
                    publicItems: publicItemsAll,
                    privateItems: privateItemsAll,
                    newestCreatedAt,
                    latestContent,
                    allTags
                  })
                  console.log('[bookmark] ✅ Auto-decrypted:', evt.id.slice(0, 8), {
                    public: publicItemsAll.length,
                    private: privateItemsAll.length
                  })
                  
                  // Emit decrypt complete for Debug UI
                  this.decryptCompleteListeners.forEach(cb => 
                    cb(evt.id, publicItemsAll.length, privateItemsAll.length)
                  )
                  
                  // Rebuild bookmarks with newly decrypted content (progressive update)
                  this.buildAndEmitBookmarks(relayPool, maybeAccount, signerCandidate)
                    .catch(err => console.error('[bookmark] ❌ Failed to update after decrypt:', err))
                })
                .catch((error) => {
                  console.error('[bookmark] ❌ Auto-decrypt failed:', evt.id.slice(0, 8), error)
                })
            }
          }
        }
      )

      // Final update after EOSE
      await this.buildAndEmitBookmarks(relayPool, maybeAccount, signerCandidate)
      console.log('[bookmark] ✅ Bookmark load complete')
    } catch (error) {
      console.error('[bookmark] ❌ Failed to load bookmarks:', error)
      this.bookmarksListeners.forEach(cb => cb([]))
    } finally {
      this.setLoading(false)
    }
  }
}

// Singleton instance
export const bookmarkController = new BookmarkController()

