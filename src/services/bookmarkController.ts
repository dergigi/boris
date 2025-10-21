import { RelayPool } from 'applesauce-relay'
import { Helpers, EventStore } from 'applesauce-core'
import { createEventLoader, createAddressLoader } from 'applesauce-loaders/loaders'
import { NostrEvent } from 'nostr-tools'
import { EventPointer } from 'nostr-tools/nip19'
import { merge } from 'rxjs'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { RELAYS } from '../config/relays'
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
  private hydrationGeneration = 0
  
  // Event loaders for efficient batching
  private eventStore = new EventStore()
  private eventLoader: ReturnType<typeof createEventLoader> | null = null
  private addressLoader: ReturnType<typeof createAddressLoader> | null = null

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
    this.hydrationGeneration++
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

  /**
   * Hydrate events by IDs using EventLoader (auto-batching, streaming)
   */
  private hydrateByIds(
    ids: string[],
    idToEvent: Map<string, NostrEvent>,
    onProgress: () => void,
    generation: number
  ): void {
    if (!this.eventLoader) {
      return
    }

    // Filter to unique IDs not already hydrated
    const unique = Array.from(new Set(ids)).filter(id => !idToEvent.has(id))
    if (unique.length === 0) {
      return
    }
    
    console.log(`📡 hydrateByIds: requesting ${unique.length} events from EventLoader`)
    
    // Convert IDs to EventPointers
    const pointers: EventPointer[] = unique.map(id => ({ id }))
    
    // Use EventLoader - it auto-batches and streams results
    merge(...pointers.map(this.eventLoader)).subscribe({
      next: (event) => {
        // Check if hydration was cancelled
        if (this.hydrationGeneration !== generation) return
        
        idToEvent.set(event.id, event)
        
        if (event.kind === 1 && event.content) {
          console.log('✅ Fetched kind:1 with content:', {
            id: event.id.slice(0, 12),
            content: event.content.slice(0, 30),
            totalInMap: idToEvent.size
          })
        }
        
        // Also index by coordinate for addressable events
        if (event.kind && event.kind >= 30000 && event.kind < 40000) {
          const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
          const coordinate = `${event.kind}:${event.pubkey}:${dTag}`
          idToEvent.set(coordinate, event)
        }
        
        onProgress()
      },
      error: () => {
        // Silent error - EventLoader handles retries
      }
    })
  }

  /**
   * Hydrate addressable events by coordinates using AddressLoader (auto-batching, streaming)
   */
  private hydrateByCoordinates(
    coords: Array<{ kind: number; pubkey: string; identifier: string }>,
    idToEvent: Map<string, NostrEvent>,
    onProgress: () => void,
    generation: number
  ): void {
    if (!this.addressLoader) {
      return
    }

    if (coords.length === 0) return

    // Convert coordinates to AddressPointers
    const pointers = coords.map(c => ({
      kind: c.kind,
      pubkey: c.pubkey,
      identifier: c.identifier
    }))

    // Use AddressLoader - it auto-batches and streams results
    merge(...pointers.map(this.addressLoader)).subscribe({
      next: (event) => {
        // Check if hydration was cancelled
        if (this.hydrationGeneration !== generation) return

        const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
        const coordinate = `${event.kind}:${event.pubkey}:${dTag}`
        idToEvent.set(coordinate, event)
        idToEvent.set(event.id, event)
        
        onProgress()
      },
      error: () => {
        // Silent error - AddressLoader handles retries
      }
    })
  }

  private async buildAndEmitBookmarks(
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
    
    if (readyEvents.length === 0) {
      this.bookmarksListeners.forEach(cb => cb([]))
      return
    }

    try {
      // Separate unencrypted and decrypted events
      const unencryptedEvents = readyEvents.filter(evt => !hasEncryptedContent(evt))
      const decryptedEvents = readyEvents.filter(evt => hasEncryptedContent(evt))
      
      // Process unencrypted events
      const { publicItemsAll: publicUnencrypted, privateItemsAll: privateUnencrypted, newestCreatedAt, latestContent, allTags } = 
        await collectBookmarksFromEvents(unencryptedEvents, activeAccount, signerCandidate)
      
      // Merge in decrypted results
      let publicItemsAll = [...publicUnencrypted]
      let privateItemsAll = [...privateUnencrypted]
      
      decryptedEvents.forEach(evt => {
        const eventKey = getEventKey(evt)
        const decrypted = this.decryptedResults.get(eventKey)
        if (decrypted) {
          publicItemsAll = [...publicItemsAll, ...decrypted.publicItems]
          privateItemsAll = [...privateItemsAll, ...decrypted.privateItems]
        }
      })

      const allItems = [...publicItemsAll, ...privateItemsAll]
      
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
      
      console.log(`📋 Requesting hydration for: ${noteIds.length} note IDs, ${coordinates.length} coordinates`)
      
      // Helper to build and emit bookmarks
      const emitBookmarks = (idToEvent: Map<string, NostrEvent>) => {
        const allBookmarks = dedupeBookmarksById([
          ...hydrateItems(publicItemsAll, idToEvent),
          ...hydrateItems(privateItemsAll, idToEvent)
        ])
        
        // Debug: log what we have
        const kind1Items = allBookmarks.filter(b => b.kind === 1)
        if (kind1Items.length > 0) {
          console.log('🔄 Emitting bookmarks with hydration:', {
            totalKind1: kind1Items.length,
            withContent: kind1Items.filter(b => b.content).length,
            mapSize: idToEvent.size,
            sample: kind1Items.slice(0, 2).map(b => ({
              id: b.id.slice(0, 12),
              content: b.content?.slice(0, 30),
              inMap: idToEvent.has(b.id)
            }))
          })
        }

        const enriched = allBookmarks.map(b => ({
          ...b,
          tags: b.tags || [],
          content: b.content || ''
        }))
        
        const sortedBookmarks = enriched
          .map(b => ({ ...b, urlReferences: extractUrlsFromContent(b.content) }))
          .sort((a, b) => ((b.added_at || 0) - (a.added_at || 0)) || ((b.created_at || 0) - (a.created_at || 0)))

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
        
        // Debug: log the actual content being emitted
        const kind1InEmit = sortedBookmarks.filter(b => b.kind === 1)
        if (kind1InEmit.length > 0) {
          console.log('📤 Emitting Bookmark object with individualBookmarks:', {
            totalKind1: kind1InEmit.length,
            withContent: kind1InEmit.filter(b => b.content && b.content.length > 0).length,
            samples: kind1InEmit.slice(0, 2).map(b => ({
              id: b.id.slice(0, 12),
              content: b.content?.slice(0, 20),
              contentLength: b.content?.length
            }))
          })
        }
        
        this.bookmarksListeners.forEach(cb => cb([bookmark]))
      }

      // Emit immediately with empty metadata (show placeholders)
      const idToEvent: Map<string, NostrEvent> = new Map()
      emitBookmarks(idToEvent)

      // Now fetch events progressively in background using batched hydrators
      
      const generation = this.hydrationGeneration
      const onProgress = () => emitBookmarks(idToEvent)
      
      // Parse coordinates from strings to objects
      const coordObjs = coordinates.map(c => {
        const parts = c.split(':')
        return {
          kind: parseInt(parts[0]),
          pubkey: parts[1],
          identifier: parts[2] || ''
        }
      })
      
      // Kick off batched hydration (streaming, non-blocking)
      // EventLoader and AddressLoader handle batching and streaming automatically
      this.hydrateByIds(noteIds, idToEvent, onProgress, generation)
      this.hydrateByCoordinates(coordObjs, idToEvent, onProgress, generation)
    } catch (error) {
      console.error('Failed to build bookmarks:', error)
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
      return
    }

    const account = activeAccount as { pubkey: string; [key: string]: unknown }

    // Increment generation to cancel any in-flight hydration
    this.hydrationGeneration++
    
    // Initialize loaders for this session
    this.eventLoader = createEventLoader(relayPool, { 
      eventStore: this.eventStore,
      extraRelays: RELAYS 
    })
    this.addressLoader = createAddressLoader(relayPool, { 
      eventStore: this.eventStore,
      extraRelays: RELAYS
    })
    
    this.setLoading(true)

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
            
            // Emit raw event for Debug UI
            this.emitRawEvent(evt)
            
            // Build bookmarks immediately for unencrypted events
            const isEncrypted = hasEncryptedContent(evt)
            if (!isEncrypted) {
              // For unencrypted events, build bookmarks immediately (progressive update)
              this.buildAndEmitBookmarks(maybeAccount, signerCandidate)
                .catch(() => {
                  // Silent error - will retry on next event
                })
            }
            
            // Auto-decrypt if event has encrypted content (fire-and-forget, non-blocking)
            if (isEncrypted) {
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
                  
                  // Emit decrypt complete for Debug UI
                  this.decryptCompleteListeners.forEach(cb => 
                    cb(evt.id, publicItemsAll.length, privateItemsAll.length)
                  )
                  
                  // Rebuild bookmarks with newly decrypted content (progressive update)
                  this.buildAndEmitBookmarks(maybeAccount, signerCandidate)
                    .catch(() => {
                      // Silent error - will retry on next event
                    })
                })
                .catch(() => {
                  // Silent error - decrypt failed
                })
            }
          }
        }
      )

      // Final update after EOSE
      await this.buildAndEmitBookmarks(maybeAccount, signerCandidate)
    } catch (error) {
      console.error('Failed to load bookmarks:', error)
      this.bookmarksListeners.forEach(cb => cb([]))
    } finally {
      this.setLoading(false)
    }
  }
}

// Singleton instance
export const bookmarkController = new BookmarkController()

