import { RelayPool } from 'applesauce-relay'
import { Helpers, IEventStore } from 'applesauce-core'
import { createAddressLoader } from 'applesauce-loaders/loaders'
import { NostrEvent } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { merge } from 'rxjs'
import { KINDS } from '../config/kinds'
import { RELAYS } from '../config/relays'
import { readingProgressController } from './readingProgressController'
import { archiveController } from './archiveController'

const { getArticleTitle, getArticleSummary, getArticleImage, getArticlePublished } = Helpers

export interface ReadItem {
  id: string // naddr coordinate
  source: 'reading-progress' | 'marked-as-read' | 'bookmark'
  type: 'article' | 'external'
  
  // Article data
  event?: NostrEvent
  url?: string
  title?: string
  summary?: string
  image?: string
  published?: number
  author?: string
  
  // Reading metadata
  readingProgress?: number // 0-1
  readingTimestamp?: number // Unix timestamp of last reading activity
  markedAsRead?: boolean
  markedAt?: number
}

type ReadsCallback = (reads: ReadItem[]) => void
type LoadingCallback = (loading: boolean) => void

/**
 * Reads controller - manages read articles with progressive hydration
 * Follows the same pattern as bookmarkController
 */
class ReadsController {
  private readsListeners: ReadsCallback[] = []
  private loadingListeners: LoadingCallback[] = []
  
  private currentReads: Map<string, ReadItem> = new Map()
  private isLoading = false
  private hydrationGeneration = 0
  
  // Address loader for efficient batching
  private addressLoader: ReturnType<typeof createAddressLoader> | null = null
  private eventStore: IEventStore | null = null

  onReads(cb: ReadsCallback): () => void {
    this.readsListeners.push(cb)
    return () => {
      this.readsListeners = this.readsListeners.filter(l => l !== cb)
    }
  }

  onLoading(cb: LoadingCallback): () => void {
    this.loadingListeners.push(cb)
    return () => {
      this.loadingListeners = this.loadingListeners.filter(l => l !== cb)
    }
  }

  reset(): void {
    this.hydrationGeneration++
    this.currentReads.clear()
    this.setLoading(false)
  }

  private setLoading(loading: boolean): void {
    if (this.isLoading !== loading) {
      this.isLoading = loading
      this.loadingListeners.forEach(cb => cb(loading))
    }
  }

  getReads(): ReadItem[] {
    return Array.from(this.currentReads.values())
  }

  /**
   * Hydrate article events by coordinates using AddressLoader (auto-batching, streaming)
   */
  private hydrateArticles(
    coordinates: string[],
    onProgress: () => void,
    generation: number
  ): void {
    if (!this.addressLoader) {
      return
    }

    if (coordinates.length === 0) return

    // Parse coordinates into pointers
    const pointers: Array<{ kind: number; pubkey: string; identifier: string }> = []
    
    for (const coord of coordinates) {
      try {
        // Decode naddr to get article coordinates
        if (coord.startsWith('naddr1')) {
          const decoded = nip19.decode(coord)
          if (decoded.type === 'naddr' && decoded.data.kind === KINDS.BlogPost) {
            pointers.push({
              kind: decoded.data.kind,
              pubkey: decoded.data.pubkey,
              identifier: decoded.data.identifier || ''
            })
          }
        }
      } catch (e) {
        console.warn('Failed to decode article coordinate:', coord)
      }
    }

    if (pointers.length === 0) return

    // Use AddressLoader - it auto-batches and streams results
    merge(...pointers.map(this.addressLoader)).subscribe({
      next: (event) => {
        // Check if hydration was cancelled
        if (this.hydrationGeneration !== generation) return

        const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
        
        // Build naddr from event
        try {
          const naddr = nip19.naddrEncode({
            kind: event.kind,
            pubkey: event.pubkey,
            identifier: dTag
          })

          const item = this.currentReads.get(naddr)
          if (item) {
            // Enrich the item with article data
            item.event = event
            item.title = getArticleTitle(event) || 'Untitled'
            item.summary = getArticleSummary(event)
            item.image = getArticleImage(event)
            item.published = getArticlePublished(event)
            item.author = event.pubkey
            
            // Store in event store if available
            if (this.eventStore) {
              this.eventStore.add(event)
            }
            
            onProgress()
          }
        } catch (e) {
          console.warn('Failed to encode naddr for event:', event.id)
        }
      },
      error: () => {
        // Silent error - AddressLoader handles retries
      }
    })
  }

  /**
   * Build ReadItems from reading progress and emit them
   */
  private buildAndEmitReads(): void {
    const progressMap = readingProgressController.getProgressMap()
    const markedIds = Array.from(new Set([
      ...readingProgressController.getMarkedAsReadIds(),
      ...archiveController.getMarkedIds()
    ]))

    // Build read items from progress map
    const readItems: ReadItem[] = []
    
    for (const [id, progress] of progressMap.entries()) {
      const existing = this.currentReads.get(id)
      const item: ReadItem = existing || {
        id,
        source: 'reading-progress',
        type: 'article',
        readingProgress: progress,
        readingTimestamp: Math.floor(Date.now() / 1000)
      }
      
      // Update progress
      item.readingProgress = progress
      item.markedAsRead = markedIds.includes(id)
      
      readItems.push(item)
      this.currentReads.set(id, item)
    }

    // Include items that are only marked-as-read (no progress event yet)
    for (const id of markedIds) {
      if (!this.currentReads.has(id) && id.startsWith('naddr1')) {
        const item: ReadItem = {
          id,
          source: 'marked-as-read',
          type: 'article',
          markedAsRead: true,
          readingTimestamp: Math.floor(Date.now() / 1000)
        }
        readItems.push(item)
        this.currentReads.set(id, item)
      }
    }

    // Emit current state (items without article data yet)
    this.readsListeners.forEach(cb => cb(Array.from(this.currentReads.values())))

    // Fetch missing articles in background (progressive hydration)
    const generation = this.hydrationGeneration
    const onProgress = () => {
      this.readsListeners.forEach(cb => cb(Array.from(this.currentReads.values())))
    }

    const coordinatesToFetch = readItems
      .filter(item => !item.event && item.type === 'article')
      .map(item => item.id)

    this.hydrateArticles(coordinatesToFetch, onProgress, generation)
  }

  async start(options: {
    relayPool: RelayPool
    eventStore: IEventStore
    pubkey: string
  }): Promise<void> {
    const { relayPool, eventStore } = options

    // Increment generation to cancel any in-flight hydration
    this.hydrationGeneration++
    this.eventStore = eventStore
    
    // Initialize loader for this session
    this.addressLoader = createAddressLoader(relayPool, { 
      eventStore,
      extraRelays: RELAYS
    })
    
    this.setLoading(true)

    try {
      // Subscribe to reading progress changes
      const unsubProgress = readingProgressController.onProgress(() => {
        this.buildAndEmitReads()
      })

      const unsubMarked = archiveController.onMarked(() => {
        this.buildAndEmitReads()
      })

      // Build initial reads
      this.buildAndEmitReads()

      // Cleanup subscriptions on next start
      setTimeout(() => {
        unsubProgress()
        unsubMarked()
      }, 0)

    } catch (error) {
      console.error('Failed to load reads:', error)
      this.readsListeners.forEach(cb => cb([]))
    } finally {
      this.setLoading(false)
    }
  }
}

// Singleton instance
export const readsController = new ReadsController()

