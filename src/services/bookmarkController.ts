import { RelayPool } from 'applesauce-relay'
import { Helpers } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { collectBookmarksFromEvents } from './bookmarkProcessing'
import { Bookmark } from '../types/bookmarks'
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
  private decryptedEvents: Map<string, { public: number; private: number }> = new Map()
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
    this.decryptedEvents.clear()
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
    
    // Only process events that are ready (unencrypted or already decrypted)
    const readyEvents = allEvents.filter(evt => {
      const isEncrypted = hasEncryptedContent(evt)
      if (!isEncrypted) return true // Unencrypted - ready
      return this.decryptedEvents.has(evt.id) // Encrypted - only if decrypted
    })
    
    console.log('[controller] 📋 Building bookmarks:', readyEvents.length, 'ready of', allEvents.length, 'total')
    
    if (readyEvents.length === 0) {
      this.bookmarksListeners.forEach(cb => cb([]))
      return
    }

    try {
      // Collect bookmarks from ready events only
      const { publicItemsAll, privateItemsAll, newestCreatedAt, latestContent, allTags } = 
        await collectBookmarksFromEvents(readyEvents, activeAccount, signerCandidate)

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
      
      const idToEvent: Map<string, NostrEvent> = new Map()
      
      // Fetch regular events by ID
      if (noteIds.length > 0) {
        try {
          const fetchedEvents = await queryEvents(
            relayPool,
            { ids: Array.from(new Set(noteIds)) },
            {}
          )
          fetchedEvents.forEach((e: NostrEvent) => {
            idToEvent.set(e.id, e)
            if (e.kind && e.kind >= 30000 && e.kind < 40000) {
              const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
              const coordinate = `${e.kind}:${e.pubkey}:${dTag}`
              idToEvent.set(coordinate, e)
            }
          })
        } catch (error) {
          console.warn('[controller] Failed to fetch events by ID:', error)
        }
      }
      
      // Fetch addressable events by coordinates
      if (coordinates.length > 0) {
        try {
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
          
          for (const [kind, items] of byKind.entries()) {
            const authors = Array.from(new Set(items.map(i => i.pubkey)))
            const identifiers = Array.from(new Set(items.map(i => i.identifier)))
            
            const fetchedEvents = await queryEvents(
              relayPool,
              { kinds: [kind], authors, '#d': identifiers },
              {}
            )
            
            fetchedEvents.forEach((e: NostrEvent) => {
              const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
              const coordinate = `${e.kind}:${e.pubkey}:${dTag}`
              idToEvent.set(coordinate, e)
              idToEvent.set(e.id, e)
            })
          }
        } catch (error) {
          console.warn('[controller] Failed to fetch addressable events:', error)
        }
      }
      
      const allBookmarks = dedupeBookmarksById([
        ...hydrateItems(publicItemsAll, idToEvent),
        ...hydrateItems(privateItemsAll, idToEvent)
      ])

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
      
      console.log('[controller] 📋 Built bookmark with', sortedBookmarks.length, 'items')
      this.bookmarksListeners.forEach(cb => cb([bookmark]))
    } catch (error) {
      console.error('[controller] ❌ Failed to build bookmarks:', error)
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
      console.error('[controller] Invalid activeAccount')
      return
    }

    const account = activeAccount as { pubkey: string; [key: string]: unknown }

    this.setLoading(true)
    console.log('[controller] 🔍 Starting bookmark load for', account.pubkey.slice(0, 8))

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
            console.log('[controller] 📨 Event:', evt.kind, evt.id.slice(0, 8), 'encrypted:', hasEncryptedContent(evt))
            
            // Emit raw event for Debug UI
            this.emitRawEvent(evt)
            
            // Build bookmarks immediately for unencrypted events
            const isEncrypted = hasEncryptedContent(evt)
            if (!isEncrypted) {
              // For unencrypted events, build bookmarks immediately (progressive update)
              this.buildAndEmitBookmarks(relayPool, maybeAccount, signerCandidate)
                .catch(err => console.error('[controller] ❌ Failed to update after event:', err))
            }
            
            // Auto-decrypt if event has encrypted content (fire-and-forget, non-blocking)
            if (isEncrypted) {
              console.log('[controller] 🔓 Auto-decrypting event', evt.id.slice(0, 8))
              // Don't await - let it run in background
              collectBookmarksFromEvents([evt], account, signerCandidate)
                .then(({ publicItemsAll, privateItemsAll }) => {
                  this.decryptedEvents.set(evt.id, { 
                    public: publicItemsAll.length, 
                    private: privateItemsAll.length 
                  })
                  console.log('[controller] ✅ Auto-decrypted:', evt.id.slice(0, 8), {
                    public: publicItemsAll.length,
                    private: privateItemsAll.length
                  })
                  
                  // Emit decrypt complete for Debug UI
                  this.decryptCompleteListeners.forEach(cb => 
                    cb(evt.id, publicItemsAll.length, privateItemsAll.length)
                  )
                  
                  // Rebuild bookmarks with newly decrypted content (progressive update)
                  this.buildAndEmitBookmarks(relayPool, maybeAccount, signerCandidate)
                    .catch(err => console.error('[controller] ❌ Failed to update after decrypt:', err))
                })
                .catch((error) => {
                  console.error('[controller] ❌ Auto-decrypt failed:', evt.id.slice(0, 8), error)
                })
            }
          }
        }
      )

      // Final update after EOSE
      await this.buildAndEmitBookmarks(relayPool, maybeAccount, signerCandidate)
      console.log('[controller] ✅ Bookmark load complete')
    } catch (error) {
      console.error('[controller] ❌ Failed to load bookmarks:', error)
      this.bookmarksListeners.forEach(cb => cb([]))
    } finally {
      this.setLoading(false)
    }
  }
}

// Singleton instance
export const bookmarkController = new BookmarkController()

