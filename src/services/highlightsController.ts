import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { Highlight } from '../types/highlights'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { eventToHighlight, sortHighlights } from './highlightEventProcessor'

type HighlightsCallback = (highlights: Highlight[]) => void
type LoadingCallback = (loading: boolean) => void

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
   * Load highlights for a user
   * Streams results and stores in event store
   * Always fetches ALL highlights to ensure completeness
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
      this.emitHighlights(this.currentHighlights)
      return
    }

    // Increment generation to cancel any in-flight work
    this.generation++
    const currentGeneration = this.generation

    this.setLoading(true)

    try {
      const seenIds = new Set<string>()
      const highlightsMap = new Map<string, Highlight>()

      // Fetch ALL highlights without limits (no since filter)
      // This ensures we get complete results for profile/my pages
      const filter = {
        kinds: [KINDS.Highlights],
        authors: [pubkey]
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

