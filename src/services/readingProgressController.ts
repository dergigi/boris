import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { RELAYS } from '../config/relays'
import { processReadingProgress } from './readingDataProcessor'
import { ReadItem } from './readsService'
import { ARCHIVE_EMOJI } from './reactionService'
import { nip19 } from 'nostr-tools'

console.log('[readingProgress] Module loaded')

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
  private markedAsReadListeners: (() => void)[] = []
  
  private currentProgressMap: Map<string, number> = new Map()
  private markedAsReadIds: Set<string> = new Set()
  private lastLoadedPubkey: string | null = null
  private generation = 0
  private timelineSubscription: { unsubscribe: () => void } | null = null
  private isLoading = false

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

  onMarkedAsReadChanged(cb: () => void): () => void {
    this.markedAsReadListeners.push(cb)
    return () => {
      this.markedAsReadListeners = this.markedAsReadListeners.filter(l => l !== cb)
    }
  }

  private setLoading(loading: boolean): void {
    this.loadingListeners.forEach(cb => cb(loading))
  }

  private emitProgress(progressMap: Map<string, number>): void {
    this.progressListeners.forEach(cb => cb(new Map(progressMap)))
  }

  private emitMarkedAsReadChanged(): void {
    this.markedAsReadListeners.forEach(cb => cb())
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
   * Get all marked as read IDs (for debugging)
   */
  getMarkedAsReadIds(): string[] {
    return Array.from(this.markedAsReadIds)
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
    this.markedAsReadIds = new Set()
    this.lastLoadedPubkey = null
    this.emitProgress(this.currentProgressMap)
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

    console.log('[readingProgress] start() called for pubkey:', pubkey.slice(0, 16), '...', 'force:', force)

    // Skip if already loaded for this pubkey and not forcing
    if (!force && this.isLoadedFor(pubkey)) {
      console.log('[readingProgress] Already loaded for pubkey, skipping')
      return
    }

    // Prevent concurrent starts
    if (this.isLoading) {
      console.log('[readingProgress] Already loading, skipping concurrent start')
      return
    }

    this.setLoading(true)
    this.isLoading = true

    try {
      // Seed from local cache immediately (survives refresh/flight mode)
      const cached = this.loadCachedProgress(pubkey)
      if (cached.size > 0) {
        this.currentProgressMap = cached
        this.emitProgress(this.currentProgressMap)
      }

      // Subscribe to local eventStore timeline for immediate and reactive updates
      // This handles both local writes and synced events from relays
      if (this.timelineSubscription) {
        try {
          this.timelineSubscription.unsubscribe()
        } catch (err) {
          // Silently fail
        }
        this.timelineSubscription = null
      }

      console.log('[readingProgress] Setting up eventStore subscription...')
      const timeline$ = eventStore.timeline({
        kinds: [KINDS.ReadingProgress],
        authors: [pubkey]
      })
      const generationAtSubscribe = this.generation
      this.timelineSubscription = timeline$.subscribe((localEvents: NostrEvent[]) => {
        if (generationAtSubscribe !== this.generation) return
        if (!Array.isArray(localEvents) || localEvents.length === 0) return
        this.processEvents(localEvents)
      })
      console.log('[readingProgress] EventStore subscription ready - updates streaming')

      // Mark as loaded immediately - queries run in background non-blocking
      this.lastLoadedPubkey = pubkey

      // Query reading progress from relays in background (non-blocking, fire-and-forget)
      console.log('[readingProgress] Starting background relay query for reading progress...')
      queryEvents(relayPool, {
        kinds: [KINDS.ReadingProgress],
        authors: [pubkey]
      }, { relayUrls: RELAYS })
        .then((relayEvents) => {
          if (startGeneration !== this.generation) return
          console.log('[readingProgress] Got reading progress from relays:', relayEvents.length)
          if (relayEvents.length > 0) {
            relayEvents.forEach(e => eventStore.add(e))
            this.processEvents(relayEvents)
            const now = Math.floor(Date.now() / 1000)
            this.updateLastSyncedAt(pubkey, now)
          }
        })
        .catch((err) => {
          console.warn('[readingProgress] Background reading progress query failed:', err)
        })

      // Load mark-as-read reactions in background (non-blocking, streaming)
      console.log('[readingProgress] Starting background relay query for mark-as-read reactions...')
      this.loadMarkAsReadReactions(relayPool, eventStore, pubkey, startGeneration)
        .then(() => {
          console.log('[readingProgress] Mark-as-read reactions loading complete')
        })
        .catch((err) => {
          console.warn('[readingProgress] Mark-as-read reactions loading failed:', err)
        })

    } catch (err) {
      console.error('📊 [ReadingProgress] Failed to setup:', err)
    } finally {
      if (startGeneration === this.generation) {
        this.setLoading(false)
      }
      this.isLoading = false
      console.log('[readingProgress] === LOADED ===')
      console.log('[readingProgress] progressMap keys:', Array.from(this.currentProgressMap.keys()))
      console.log('[readingProgress] markedAsReadIds:', Array.from(this.markedAsReadIds))
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

  /**
   * Load mark-as-read reactions in background (non-blocking)
   */
  private async loadMarkAsReadReactions(
    relayPool: RelayPool,
    _eventStore: IEventStore,
    pubkey: string,
    generation: number
  ): Promise<void> {
    try {
      // Stream kind:17 (URL reactions) and kind:7 (event reactions) in parallel
      console.log('[readingProgress] Querying kind:17 and kind:7 reactions (streaming)...')
      const seenReactionIds = new Set<string>()

      const handleUrlReaction = (evt: NostrEvent) => {
        if (seenReactionIds.has(evt.id)) return
        seenReactionIds.add(evt.id)
        if (evt.content !== ARCHIVE_EMOJI) return
        const rTag = evt.tags.find(t => t[0] === 'r')?.[1]
        if (!rTag) return
        this.markedAsReadIds.add(rTag)
        this.emitMarkedAsReadChanged()
      }

      const pendingEventIds = new Set<string>()
      const handleEventReaction = (evt: NostrEvent) => {
        if (seenReactionIds.has(evt.id)) return
        seenReactionIds.add(evt.id)
        if (evt.content !== ARCHIVE_EMOJI) return
        const eTag = evt.tags.find(t => t[0] === 'e')?.[1]
        if (!eTag) return
        pendingEventIds.add(eTag)
      }

      // Fire queries with onEvent callbacks for streaming behavior
      const [kind17Events, kind7Events] = await Promise.all([
        queryEvents(relayPool, { kinds: [17], authors: [pubkey] }, { relayUrls: RELAYS, onEvent: handleUrlReaction }),
        queryEvents(relayPool, { kinds: [7], authors: [pubkey] }, { relayUrls: RELAYS, onEvent: handleEventReaction })
      ])

      if (generation !== this.generation) return

      // Include any reactions that arrived only at EOSE
      kind17Events.forEach(handleUrlReaction)
      kind7Events.forEach(handleEventReaction)

      if (pendingEventIds.size > 0) {
        // Fetch referenced 30023 events, streaming not required here
        const ids = Array.from(pendingEventIds)
        const articleEvents = await queryEvents(relayPool, { kinds: [KINDS.BlogPost], ids }, { relayUrls: RELAYS })
        const eventIdToNaddr = new Map<string, string>()
        for (const article of articleEvents) {
          const dTag = article.tags.find(t => t[0] === 'd')?.[1]
          if (!dTag) continue
          try {
            const naddr = nip19.naddrEncode({ kind: KINDS.BlogPost, pubkey: article.pubkey, identifier: dTag })
            eventIdToNaddr.set(article.id, naddr)
          } catch (e) {
            console.warn('[readingProgress] Failed to encode naddr for article:', article.id)
          }
        }

        // Map pending event IDs to naddrs and emit
        for (const eId of pendingEventIds) {
          const naddr = eventIdToNaddr.get(eId)
          if (naddr) {
            this.markedAsReadIds.add(naddr)
          }
        }
        this.emitMarkedAsReadChanged()
      }

      console.log('[readingProgress] Mark-as-read reactions complete. Total:', Array.from(this.markedAsReadIds).length)
    } catch (err) {
      console.warn('[readingProgress] Failed to load mark-as-read reactions:', err)
    }
  }
}

export const readingProgressController = new ReadingProgressController()

