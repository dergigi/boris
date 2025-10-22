import { RelayPool } from 'applesauce-relay'
import { Helpers, EventStore } from 'applesauce-core'
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
  private hydrationGeneration = 0
  private externalEventStore: EventStore | null = null
  private relayPool: RelayPool | null = null

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
   * Hydrate events by IDs using queryEvents (local-first, streaming)
   */
  private async hydrateByIds(
    ids: string[],
    idToEvent: Map<string, NostrEvent>,
    onProgress: () => void,
    generation: number
  ): Promise<void> {
    if (!this.relayPool) {
      return
    }

    // Filter to unique IDs not already hydrated
    const unique = Array.from(new Set(ids)).filter(id => !idToEvent.has(id))
    if (unique.length === 0) {
      return
    }
    
    // Fetch events using local-first queryEvents
    await queryEvents(
      this.relayPool,
      { ids: unique },
      {
        onEvent: (event) => {
          // Check if hydration was cancelled
          if (this.hydrationGeneration !== generation) return
          
          idToEvent.set(event.id, event)
          
          // Also index by coordinate for addressable events
          if (event.kind && event.kind >= 30000 && event.kind < 40000) {
            const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
            const coordinate = `${event.kind}:${event.pubkey}:${dTag}`
            idToEvent.set(coordinate, event)
          }
          
          // Add to external event store if available
          if (this.externalEventStore) {
            this.externalEventStore.add(event)
          }
          
          onProgress()
        }
      }
    )
  }

  /**
   * Hydrate addressable events by coordinates using queryEvents (local-first, streaming)
   */
  private async hydrateByCoordinates(
    coords: Array<{ kind: number; pubkey: string; identifier: string }>,
    idToEvent: Map<string, NostrEvent>,
    onProgress: () => void,
    generation: number
  ): Promise<void> {
    if (!this.relayPool) {
      return
    }

    if (coords.length === 0) {
      return
    }

    // Group by kind and pubkey for efficient batching
    const filtersByKind = new Map<number, Map<string, string[]>>()
    
    for (const coord of coords) {
      if (!filtersByKind.has(coord.kind)) {
        filtersByKind.set(coord.kind, new Map())
      }
      const byPubkey = filtersByKind.get(coord.kind)!
      if (!byPubkey.has(coord.pubkey)) {
        byPubkey.set(coord.pubkey, [])
      }
      byPubkey.get(coord.pubkey)!.push(coord.identifier || '')
    }

    // Kick off all queries in parallel (fire-and-forget)
    const promises: Promise<void>[] = []
    
    for (const [kind, byPubkey] of filtersByKind) {
      for (const [pubkey, identifiers] of byPubkey) {
        // Separate empty and non-empty identifiers
        const nonEmptyIdentifiers = identifiers.filter(id => id && id.length > 0)
        const hasEmptyIdentifier = identifiers.some(id => !id || id.length === 0)
        
        // Fetch events with non-empty d-tags
        if (nonEmptyIdentifiers.length > 0) {
          promises.push(
            queryEvents(
              this.relayPool,
              { kinds: [kind], authors: [pubkey], '#d': nonEmptyIdentifiers },
              {
                onEvent: (event) => {
                  // Check if hydration was cancelled
                  if (this.hydrationGeneration !== generation) return

                  const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
                  const coordinate = `${event.kind}:${event.pubkey}:${dTag}`
                  idToEvent.set(coordinate, event)
                  idToEvent.set(event.id, event)
                  
                  // Add to external event store if available
                  if (this.externalEventStore) {
                    this.externalEventStore.add(event)
                  }
                  
                  onProgress()
                }
              }
            ).then(() => {
              // Query completed successfully
            }).catch(() => {
              // Silent error - individual query failed
            })
          )
        }
        
        // Fetch events with empty d-tag separately (without '#d' filter)
        if (hasEmptyIdentifier) {
          promises.push(
            queryEvents(
              this.relayPool,
              { kinds: [kind], authors: [pubkey] },
              {
                onEvent: (event) => {
                  // Check if hydration was cancelled
                  if (this.hydrationGeneration !== generation) return
                  
                  // Only process events with empty d-tag
                  const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
                  if (dTag !== '') return

                  const coordinate = `${event.kind}:${event.pubkey}:`
                  idToEvent.set(coordinate, event)
                  idToEvent.set(event.id, event)
                  
                  // Add to external event store if available
                  if (this.externalEventStore) {
                    this.externalEventStore.add(event)
                  }
                  
                  onProgress()
                }
              }
            ).then(() => {
              // Query completed successfully
            }).catch(() => {
              // Silent error - individual query failed
            })
          )
        }
      }
    }
    
    // Wait for all queries to complete
    await Promise.all(promises)
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
      const deduped = dedupeBookmarksById(allItems)
      
      // Separate hex IDs from coordinates for fetching
      const noteIds: string[] = []
      const coordinates: string[] = []
      
      // Request hydration for all items that don't have content yet
      deduped.forEach(i => {
        // If item has no content, we need to fetch it
        if (!i.content || i.content.length === 0) {
          if (/^[0-9a-f]{64}$/i.test(i.id)) {
            noteIds.push(i.id)
          } else if (i.id.includes(':')) {
            coordinates.push(i.id)
          }
        }
      })
      
      // Helper to build and emit bookmarks
      const emitBookmarks = (idToEvent: Map<string, NostrEvent>) => {
        // Now hydrate the ORIGINAL items (which may have duplicates), using the deduplicated results
        // This preserves the original public/private split while still getting all the content
        const allBookmarks = [
          ...hydrateItems(publicItemsAll, idToEvent),
          ...hydrateItems(privateItemsAll, idToEvent)
        ]
        
        const enriched = allBookmarks.map(b => ({
          ...b,
          tags: b.tags || [],
          content: b.content || this.externalEventStore?.getEvent(b.id)?.content || '', // Fallback to eventStore content
          created_at: b.created_at || this.externalEventStore?.getEvent(b.id)?.created_at || b.created_at
        }))
        
        const sortedBookmarks = enriched
          .map(b => ({ 
            ...b, 
            urlReferences: extractUrlsFromContent(b.content)
          }))
          .sort((a, b) => {
            // Sort by created_at (timestamp of bookmark list event = when bookmarked)
            // Newest first (descending)
            return (b.created_at || 0) - (a.created_at || 0)
          })
        
        // DEBUG: Log sorting details for top 10 bookmarks
        console.log('🔍 Bookmark Sorting Debug:')
        sortedBookmarks.slice(0, 10).forEach((b, i) => {
          const bookmarkedDate = b.created_at ? new Date(b.created_at * 1000).toISOString() : 'none'
          const contentPreview = (b.content || '').substring(0, 50)
          console.log(`  ${i + 1}. [${b.type}] bookmarked at: ${bookmarkedDate}`)
          console.log(`     content: "${contentPreview}"`)
        })
        console.log(`Total bookmarks: ${sortedBookmarks.length}\n`)

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
        
        this.bookmarksListeners.forEach(cb => cb([bookmark]))
      }

      // Emit immediately with empty metadata (show placeholders)
      const idToEvent: Map<string, NostrEvent> = new Map()
      emitBookmarks(idToEvent)

      // Now fetch events progressively in background using local-first queries
      
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
      
      // Kick off hydration (streaming, non-blocking, local-first)
      // Fire-and-forget - don't await, let it run in background
      this.hydrateByIds(noteIds, idToEvent, onProgress, generation).catch(() => {
        // Silent error - hydration will retry or show partial results
      })
      this.hydrateByCoordinates(coordObjs, idToEvent, onProgress, generation).catch(() => {
        // Silent error - hydration will retry or show partial results
      })
    } catch (error) {
      console.error('Failed to build bookmarks:', error)
      this.bookmarksListeners.forEach(cb => cb([]))
    }
  }

  async start(options: {
    relayPool: RelayPool
    activeAccount: unknown
    accountManager: { getActive: () => unknown }
    eventStore?: EventStore
  }): Promise<void> {
    const { relayPool, activeAccount, accountManager, eventStore } = options
    
    // Store references for hydration
    this.relayPool = relayPool
    this.externalEventStore = eventStore || null

    if (!activeAccount || typeof (activeAccount as { pubkey?: string }).pubkey !== 'string') {
      return
    }

    const account = activeAccount as { pubkey: string; [key: string]: unknown }

    // Increment generation to cancel any in-flight hydration
    this.hydrationGeneration++
    
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

