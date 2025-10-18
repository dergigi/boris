import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { Highlight } from '../types/highlights'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { eventToHighlight, sortHighlights } from './highlightEventProcessor'

type HighlightsCallback = (highlights: Highlight[]) => void
type LoadingCallback = (loading: boolean) => void

const LAST_SYNCED_KEY = 'highlights_last_synced'

/**
 * Shared highlights controller
 * Manages the user's highlights centrally, similar to bookmarkController
 */
class HighlightsController {
  private highlightsListeners: HighlightsCallback[] = []
  private loadingListeners: LoadingCallback[] = []
  
  private currentHighlights: Highlight[] = []
  private lastLoadedPubkey: string | null = null
  private generation = 0

  onHighlights(cb: HighlightsCallback): () => void {
    this.highlightsListeners.push(cb)
    return () => {
      this.highlightsListeners = this.highlightsListeners.filter(l => l !== cb)
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

  private emitHighlights(highlights: Highlight[]): void {
    this.highlightsListeners.forEach(cb => cb(highlights))
  }

  /**
   * Get current highlights without triggering a reload
   */
  getHighlights(): Highlight[] {
    return [...this.currentHighlights]
  }

  /**
   * Check if highlights are loaded for a specific pubkey
   */
  isLoadedFor(pubkey: string): boolean {
    return this.lastLoadedPubkey === pubkey && this.currentHighlights.length >= 0
  }

  /**
   * Reset state (for logout or manual refresh)
   */
  reset(): void {
    this.generation++
    this.currentHighlights = []
    this.lastLoadedPubkey = null
    this.emitHighlights(this.currentHighlights)
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
  private setLastSyncedAt(pubkey: string, timestamp: number): void {
    try {
      const data = localStorage.getItem(LAST_SYNCED_KEY)
      const parsed = data ? JSON.parse(data) : {}
      parsed[pubkey] = timestamp
      localStorage.setItem(LAST_SYNCED_KEY, JSON.stringify(parsed))
    } catch (err) {
      console.warn('[highlights] Failed to save last synced timestamp:', err)
    }
  }

  /**
   * Load highlights for a user
   * Streams results and stores in event store
   */
  async start(options: {
    relayPool: RelayPool
    eventStore: IEventStore
    pubkey: string
    force?: boolean
  }): Promise<void> {
    const { relayPool, eventStore, pubkey, force = false } = options

    // Skip if already loaded for this pubkey (unless forced)
    if (!force && this.isLoadedFor(pubkey)) {
      console.log('[highlights] ✅ Already loaded for', pubkey.slice(0, 8))
      this.emitHighlights(this.currentHighlights)
      return
    }

    // Increment generation to cancel any in-flight work
    this.generation++
    const currentGeneration = this.generation

    this.setLoading(true)
    console.log('[highlights] 🔍 Loading highlights for', pubkey.slice(0, 8))

    try {
      const seenIds = new Set<string>()
      const highlightsMap = new Map<string, Highlight>()

      // Get last synced timestamp for incremental loading
      const lastSyncedAt = force ? null : this.getLastSyncedAt(pubkey)
      const filter: { kinds: number[]; authors: string[]; since?: number } = {
        kinds: [KINDS.Highlights],
        authors: [pubkey]
      }
      if (lastSyncedAt) {
        filter.since = lastSyncedAt
        console.log('[highlights] 📅 Incremental sync since', new Date(lastSyncedAt * 1000).toISOString())
      }

      const events = await queryEvents(
        relayPool,
        filter,
        {
          onEvent: (evt) => {
            // Check if this generation is still active
            if (currentGeneration !== this.generation) return

            if (seenIds.has(evt.id)) return
            seenIds.add(evt.id)

            // Store in event store immediately
            eventStore.add(evt)

            // Convert to highlight and add to map
            const highlight = eventToHighlight(evt)
            highlightsMap.set(highlight.id, highlight)

            // Stream to listeners
            const sortedHighlights = sortHighlights(Array.from(highlightsMap.values()))
            this.currentHighlights = sortedHighlights
            this.emitHighlights(sortedHighlights)
          }
        }
      )

      // Check if still active after async operation
      if (currentGeneration !== this.generation) {
        console.log('[highlights] ⚠️ Load cancelled (generation mismatch)')
        return
      }

      // Store all events in event store
      events.forEach(evt => eventStore.add(evt))

      // Final processing
      const highlights = events.map(eventToHighlight)
      const uniqueHighlights = Array.from(
        new Map(highlights.map(h => [h.id, h])).values()
      )
      const sorted = sortHighlights(uniqueHighlights)

      this.currentHighlights = sorted
      this.lastLoadedPubkey = pubkey
      this.emitHighlights(sorted)

      // Update last synced timestamp
      if (sorted.length > 0) {
        const newestTimestamp = Math.max(...sorted.map(h => h.created_at))
        this.setLastSyncedAt(pubkey, newestTimestamp)
      }

      console.log('[highlights] ✅ Loaded', sorted.length, 'highlights')
    } catch (error) {
      console.error('[highlights] ❌ Failed to load highlights:', error)
      this.currentHighlights = []
      this.emitHighlights(this.currentHighlights)
    } finally {
      // Only clear loading if this generation is still active
      if (currentGeneration === this.generation) {
        this.setLoading(false)
      }
    }
  }
}

// Singleton instance
export const highlightsController = new HighlightsController()

