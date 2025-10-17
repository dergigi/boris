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

// Batching constants
const IDS_BATCH_SIZE = 100
const D_TAG_BATCH_SIZE = 50
const AUTHORS_BATCH_SIZE = 50

/**
 * Chunk array into smaller batches
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

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
   * Hydrate events by IDs in batches
   */
  private async hydrateByIds(
    relayPool: RelayPool,
    ids: string[],
    idToEvent: Map<string, NostrEvent>,
    onProgress: () => void,
    generation: number
  ): Promise<void> {
    // Filter to unique IDs not already hydrated
    const unique = Array.from(new Set(ids)).filter(id => !idToEvent.has(id))
    if (unique.length === 0) {
      console.log('[bookmark] 🔧 All IDs already hydrated, skipping')
      return
    }

    console.log('[bookmark] 🔧 Hydrating', unique.length, 'IDs in batches of', IDS_BATCH_SIZE)
    
    const batches = chunk(unique, IDS_BATCH_SIZE)
    for (let i = 0; i < batches.length; i++) {
      // Check if hydration was cancelled
      if (this.hydrationGeneration !== generation) {
        console.log('[bookmark] ⏹️ Hydration cancelled (generation changed)')
        return
      }

      const batch = batches[i]
      console.log('[bookmark] 🔧 Fetching batch', i + 1, '/', batches.length, '(', batch.length, 'IDs )')
      console.log('[bookmark] 🔧 First few IDs in batch:', batch.slice(0, 3))
      
      try {
        console.log('[bookmark] 🔧 Calling queryEvents...')
        const events = await queryEvents(
          relayPool,
          { ids: batch },
          {
            onEvent: (e: NostrEvent) => {
              console.log('[bookmark] 📨 Received event:', e.id.slice(0, 8), 'kind:', e.kind)
              idToEvent.set(e.id, e)
              // Also index by coordinate for addressable events
              if (e.kind && e.kind >= 30000 && e.kind < 40000) {
                const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
                const coordinate = `${e.kind}:${e.pubkey}:${dTag}`
                idToEvent.set(coordinate, e)
              }
              onProgress()
            }
          }
        )
        console.log('[bookmark] ✅ Batch', i + 1, 'completed with', events.length, 'events')
      } catch (error) {
        console.error('[bookmark] ❌ Batch', i + 1, 'failed:', error)
      }
    }
  }

  /**
   * Hydrate addressable events by coordinates in batches
   */
  private async hydrateByCoordinates(
    relayPool: RelayPool,
    coords: Array<{ kind: number; pubkey: string; identifier: string }>,
    idToEvent: Map<string, NostrEvent>,
    onProgress: () => void,
    generation: number
  ): Promise<void> {
    if (coords.length === 0) return

    console.log('[bookmark] 🔧 Hydrating', coords.length, 'coordinates by kind')

    // Group by kind for efficient queries
    const byKind = new Map<number, Array<{ pubkey: string; identifier: string }>>()
    coords.forEach(c => {
      if (!byKind.has(c.kind)) byKind.set(c.kind, [])
      byKind.get(c.kind)!.push({ pubkey: c.pubkey, identifier: c.identifier })
    })

    for (const [kind, items] of byKind.entries()) {
      // Check if hydration was cancelled
      if (this.hydrationGeneration !== generation) {
        console.log('[bookmark] ⏹️ Hydration cancelled (generation changed)')
        return
      }

      const authors = Array.from(new Set(items.map(i => i.pubkey)))
      const identifiers = Array.from(new Set(items.map(i => i.identifier)))

      console.log('[bookmark] 🔧 Kind', kind, ':', authors.length, 'authors ×', identifiers.length, 'identifiers')

      // Batch authors and identifiers
      const authorBatches = chunk(authors, AUTHORS_BATCH_SIZE)
      const idBatches = chunk(identifiers, D_TAG_BATCH_SIZE)

      for (const authorBatch of authorBatches) {
        for (const idBatch of idBatches) {
          // Check if hydration was cancelled
          if (this.hydrationGeneration !== generation) {
            console.log('[bookmark] ⏹️ Hydration cancelled (generation changed)')
            return
          }

          console.log('[bookmark] 🔧 Fetching kind', kind, ':', authorBatch.length, 'authors ×', idBatch.length, 'identifiers')
          
          try {
            console.log('[bookmark] 🔧 Calling queryEvents for coordinates...')
            const events = await queryEvents(
              relayPool,
              { kinds: [kind], authors: authorBatch, '#d': idBatch },
              {
                onEvent: (e: NostrEvent) => {
                  console.log('[bookmark] 📨 Received coordinate event:', e.id.slice(0, 8), 'kind:', e.kind)
                  const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
                  const coordinate = `${e.kind}:${e.pubkey}:${dTag}`
                  idToEvent.set(coordinate, e)
                  idToEvent.set(e.id, e)
                  onProgress()
                }
              }
            )
            console.log('[bookmark] ✅ Kind', kind, 'batch completed with', events.length, 'events')
          } catch (error) {
            console.error('[bookmark] ❌ Kind', kind, 'batch failed:', error)
          }
        }
      }
    }
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

      // Now fetch events progressively in background using batched hydrators
      console.log('[bookmark] 🔧 Background hydration:', noteIds.length, 'note IDs and', coordinates.length, 'coordinates')
      
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
      
      // Kick off batched hydration (sequential, fire-and-forget)
      this.hydrateByIds(relayPool, noteIds, idToEvent, onProgress, generation)
        .then(() => this.hydrateByCoordinates(relayPool, coordObjs, idToEvent, onProgress, generation))
        .catch(error => {
          console.warn('[bookmark] ⚠️ Hydration failed:', error)
        })
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

    // Increment generation to cancel any in-flight hydration
    this.hydrationGeneration++
    
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

