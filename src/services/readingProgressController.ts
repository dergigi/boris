import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { RELAYS } from '../config/relays'
import { processReadingProgress } from './readingDataProcessor'
import { ReadItem } from './readsService'

type ProgressMapCallback = (progressMap: Map<string, number>) => void
type LoadingCallback = (loading: boolean) => void

const LAST_SYNCED_KEY = 'reading_progress_last_synced'

/**
 * Shared reading progress controller
 * Manages the user's reading progress (kind:39802) centrally
 */
class ReadingProgressController {
  private progressListeners: ProgressMapCallback[] = []
  private loadingListeners: LoadingCallback[] = []
  
  private currentProgressMap: Map<string, number> = new Map()
  private lastLoadedPubkey: string | null = null
  private generation = 0

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
    console.log('[progress] 📡 Emitting to', this.progressListeners.length, 'listeners with', progressMap.size, 'items')
    this.progressListeners.forEach(cb => cb(new Map(progressMap)))
  }

  /**
   * Get current reading progress map without triggering a reload
   */
  getProgressMap(): Map<string, number> {
    return new Map(this.currentProgressMap)
  }

  /**
   * Get progress for a specific article by naddr
   */
  getProgress(naddr: string): number | undefined {
    return this.currentProgressMap.get(naddr)
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
      console.warn('Failed to update last synced timestamp:', err)
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
      console.log('📊 [ReadingProgress] Already loaded for', pubkey.slice(0, 8))
      return
    }

    console.log('📊 [ReadingProgress] Loading for', pubkey.slice(0, 8), force ? '(forced)' : '')
    
    this.setLoading(true)
    this.lastLoadedPubkey = pubkey

    try {
      // 1. First, get events from local event store timeline (instant, non-blocking)
      const timeline = eventStore.timeline({
        kinds: [KINDS.ReadingProgress],
        authors: [pubkey]
      })
      
      // Subscribe to get initial events synchronously
      const subscription = timeline.subscribe((localEvents) => {
        console.log('📊 [ReadingProgress] Found', localEvents.length, 'events in local store')
        if (localEvents.length > 0) {
          this.processEvents(localEvents)
        }
      })
      
      // Unsubscribe immediately after getting initial value
      subscription.unsubscribe()
      
      // 2. Then fetch from relays (incremental or full) to augment local data
      const lastSynced = force ? null : this.getLastSyncedAt(pubkey)
      const filter: any = {
        kinds: [KINDS.ReadingProgress],
        authors: [pubkey]
      }
      
      if (lastSynced && !force) {
        filter.since = lastSynced
        console.log('📊 [ReadingProgress] Incremental sync from relays since', new Date(lastSynced * 1000).toISOString())
      } else {
        console.log('📊 [ReadingProgress] Full sync from relays')
      }

      const relayEvents = await queryEvents(relayPool, filter, { relayUrls: RELAYS })
      
      if (startGeneration !== this.generation) {
        console.log('📊 [ReadingProgress] Cancelled (generation changed)')
        return
      }

      if (relayEvents.length > 0) {
        // Add to event store
        relayEvents.forEach(e => eventStore.add(e))
        
        // Process and emit (merge with existing)
        this.processEvents(relayEvents)
        console.log('📊 [ReadingProgress] Loaded', relayEvents.length, 'events from relays')
        
        // Update last synced
        const now = Math.floor(Date.now() / 1000)
        this.updateLastSyncedAt(pubkey, now)
      } else {
        console.log('📊 [ReadingProgress] No new events from relays')
      }
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
  private processEvents(events: any[]): void {
    console.log('[progress] 🔄 Processing', events.length, 'events')
    
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
    
    console.log('[progress] 📦 Starting with', readsMap.size, 'existing items')
    
    // Process new events
    processReadingProgress(events, readsMap)
    
    console.log('[progress] 📦 After processing:', readsMap.size, 'items')
    
    // Convert back to progress map (naddr -> progress)
    const newProgressMap = new Map<string, number>()
    for (const [id, item] of readsMap.entries()) {
      if (item.readingProgress !== undefined && item.type === 'article') {
        newProgressMap.set(id, item.readingProgress)
        console.log('[progress] ✅ Added:', id.slice(0, 50) + '...', '=', Math.round(item.readingProgress * 100) + '%')
      }
    }
    
    console.log('[progress] 📊 Final progress map size:', newProgressMap.size)
    
    this.currentProgressMap = newProgressMap
    this.emitProgress(this.currentProgressMap)
  }
}

export const readingProgressController = new ReadingProgressController()

