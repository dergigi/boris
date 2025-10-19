import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { Filter, NostrEvent } from 'nostr-tools'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { RELAYS } from '../config/relays'
import { processReadingProgress } from './readingDataProcessor'
import { ReadItem } from './readsService'
import { MARK_AS_READ_EMOJI } from './reactionService'

type ProgressMapCallback = (progressMap: Map<string, number>) => void
type LoadingCallback = (loading: boolean) => void

const LAST_SYNCED_KEY = 'reading_progress_last_synced'
const PROGRESS_CACHE_KEY = 'reading_progress_cache_v1'

/**
 * Shared reading progress controller
 * Manages the user's reading progress (kind:39802) centrally
 */
class ReadingProgressController {
  private progressListeners: ProgressMapCallback[] = []
  private loadingListeners: LoadingCallback[] = []
  
  private currentProgressMap: Map<string, number> = new Map()
  private markedAsReadIds: Set<string> = new Set()
  private lastLoadedPubkey: string | null = null
  private generation = 0
  private timelineSubscription: { unsubscribe: () => void } | null = null

  onProgress(cb: ProgressMapCallback): () => void {
    this.progressListeners.push(cb)
    return () => {
      this.progressListeners = this.progressListeners.filter(l => l !== cb)
    }
  }

  onLoading(cb: LoadingCallback): () => void {
    this.loadingListeners.push(cb)
    return () => {
      this.loadingListeners = this.loadingListeners.filter(l => l !== cb)
    }
  }

  private setLoading(loading: boolean): void {
    this.loadingListeners.forEach(cb => cb(loading))
  }

  private emitProgress(progressMap: Map<string, number>): void {
    this.progressListeners.forEach(cb => cb(new Map(progressMap)))
  }

  /**
   * Get current reading progress map without triggering a reload
   */
  getProgressMap(): Map<string, number> {
    return new Map(this.currentProgressMap)
  }

  /**
   * Load cached progress from localStorage for a pubkey
   */
  private loadCachedProgress(pubkey: string): Map<string, number> {
    try {
      const raw = localStorage.getItem(PROGRESS_CACHE_KEY)
      if (!raw) return new Map()
      const parsed = JSON.parse(raw) as Record<string, Record<string, number>>
      const forUser = parsed[pubkey] || {}
      return new Map(Object.entries(forUser))
    } catch {
      return new Map()
    }
  }

  /**
   * Save current progress map to localStorage for the active pubkey
   */
  private persistProgress(pubkey: string, progressMap: Map<string, number>): void {
    try {
      const raw = localStorage.getItem(PROGRESS_CACHE_KEY)
      const parsed: Record<string, Record<string, number>> = raw ? JSON.parse(raw) : {}
      parsed[pubkey] = Object.fromEntries(progressMap.entries())
      localStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify(parsed))
    } catch (err) {
      // Silently fail cache persistence
    }
  }

  /**
   * Get progress for a specific article by naddr
   */
  getProgress(naddr: string): number | undefined {
    return this.currentProgressMap.get(naddr)
  }

  /**
   * Check if article is marked as read
   */
  isMarkedAsRead(naddr: string): boolean {
    return this.markedAsReadIds.has(naddr)
  }

  /**
   * Check if reading progress is loaded for a specific pubkey
   */
  isLoadedFor(pubkey: string): boolean {
    return this.lastLoadedPubkey === pubkey
  }

  /**
   * Reset state (for logout or manual refresh)
   */
  reset(): void {
    this.generation++
    // Unsubscribe from any active timeline subscription
    if (this.timelineSubscription) {
      try {
        this.timelineSubscription.unsubscribe()
      } catch (err) {
        // Silently fail on unsubscribe
      }
      this.timelineSubscription = null
    }
    this.currentProgressMap = new Map()
    this.lastLoadedPubkey = null
    this.emitProgress(this.currentProgressMap)
  }

  /**
   * Get last synced timestamp for incremental loading
   */
  private getLastSyncedAt(pubkey: string): number | null {
    try {
      const data = localStorage.getItem(LAST_SYNCED_KEY)
      if (!data) return null
      const parsed = JSON.parse(data)
      return parsed[pubkey] || null
    } catch {
      return null
    }
  }

  /**
   * Update last synced timestamp
   */
  private updateLastSyncedAt(pubkey: string, timestamp: number): void {
    try {
      const data = localStorage.getItem(LAST_SYNCED_KEY)
      const parsed = data ? JSON.parse(data) : {}
      parsed[pubkey] = timestamp
      localStorage.setItem(LAST_SYNCED_KEY, JSON.stringify(parsed))
    } catch (err) {
      // Silently fail
    }
  }

  /**
   * Load and watch reading progress for a user
   */
  async start(params: {
    relayPool: RelayPool
    eventStore: IEventStore
    pubkey: string
    force?: boolean
  }): Promise<void> {
    const { relayPool, eventStore, pubkey, force = false } = params
    const startGeneration = this.generation

    // Skip if already loaded for this pubkey and not forcing
    if (!force && this.isLoadedFor(pubkey)) {
      return
    }

    this.setLoading(true)
    this.lastLoadedPubkey = pubkey

    try {
      // Seed from local cache immediately (survives refresh/flight mode)
      const cached = this.loadCachedProgress(pubkey)
      if (cached.size > 0) {
        this.currentProgressMap = cached
        this.emitProgress(this.currentProgressMap)
      }

      // Subscribe to local timeline for immediate and reactive updates
      // Clean up any previous subscription first
      if (this.timelineSubscription) {
        try {
          this.timelineSubscription.unsubscribe()
        } catch (err) {
          // Silently fail
        }
        this.timelineSubscription = null
      }

      const timeline$ = eventStore.timeline({
        kinds: [KINDS.ReadingProgress],
        authors: [pubkey]
      })
      const generationAtSubscribe = this.generation
      this.timelineSubscription = timeline$.subscribe((localEvents: NostrEvent[]) => {
        // Ignore if controller generation has changed (e.g., logout/login)
        if (generationAtSubscribe !== this.generation) return
        if (!Array.isArray(localEvents) || localEvents.length === 0) return
        this.processEvents(localEvents)
      })

      // Query events from relays
      // Force full sync if map is empty (first load) or if explicitly forced
      const needsFullSync = force || this.currentProgressMap.size === 0
      const lastSynced = needsFullSync ? null : this.getLastSyncedAt(pubkey)
      
      const filter: Filter = {
        kinds: [KINDS.ReadingProgress],
        authors: [pubkey]
      }
      
      if (lastSynced && !needsFullSync) {
        filter.since = lastSynced
      }

      const relayEvents = await queryEvents(relayPool, filter, { relayUrls: RELAYS })
      
      if (startGeneration !== this.generation) {
        return
      }

      if (relayEvents.length > 0) {
        // Add to event store
        relayEvents.forEach(e => eventStore.add(e))
        
        // Process and emit (merge with existing)
        this.processEvents(relayEvents)
        
        // Update last synced
        const now = Math.floor(Date.now() / 1000)
        this.updateLastSyncedAt(pubkey, now)
      }

      // Also fetch mark-as-read reactions in parallel
      const [kind7Events, kind17Events] = await Promise.all([
        queryEvents(relayPool, { kinds: [7], authors: [pubkey] }, { relayUrls: RELAYS }),
        queryEvents(relayPool, { kinds: [17], authors: [pubkey] }, { relayUrls: RELAYS })
      ])

      if (startGeneration !== this.generation) {
        return
      }

      // Process mark-as-read reactions
      ;[...kind7Events, ...kind17Events].forEach((evt) => {
        if (evt.content === MARK_AS_READ_EMOJI) {
          // Extract article ID from tags
          const eTag = evt.tags.find(t => t[0] === 'e')?.[1]
          const rTag = evt.tags.find(t => t[0] === 'r')?.[1]
          
          if (eTag) {
            // For kind:7, look up the article from progress map by event ID
            const articleId = Array.from(this.currentProgressMap.keys()).find(id => id.includes(eTag))
            if (articleId) this.markedAsReadIds.add(articleId)
          } else if (rTag) {
            // For kind:17, the URL is the article ID
            this.markedAsReadIds.add(rTag)
          }
        }
      })
    } catch (err) {
      console.error('📊 [ReadingProgress] Failed to load:', err)
    } finally {
      if (startGeneration === this.generation) {
        this.setLoading(false)
      }
    }
  }

  /**
   * Process events and update progress map
   */
  private processEvents(events: NostrEvent[]): void {
    const readsMap = new Map<string, ReadItem>()
    
    // Merge with existing progress
    for (const [id, progress] of this.currentProgressMap.entries()) {
      readsMap.set(id, {
        id,
        source: 'reading-progress',
        type: 'article',
        readingProgress: progress
      })
    }
    
    // Process new events
    processReadingProgress(events, readsMap)
    
    // Convert back to progress map (naddr -> progress)
    const newProgressMap = new Map<string, number>()
    for (const [id, item] of readsMap.entries()) {
      if (item.readingProgress !== undefined && item.type === 'article') {
        newProgressMap.set(id, item.readingProgress)
      }
    }
    
    this.currentProgressMap = newProgressMap
    this.emitProgress(this.currentProgressMap)

    // Persist for current user so it survives refresh/flight mode
    if (this.lastLoadedPubkey) {
      this.persistProgress(this.lastLoadedPubkey, this.currentProgressMap)
    }
  }
}

export const readingProgressController = new ReadingProgressController()

