import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { Highlight } from '../types/highlights'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { eventToHighlight, sortHighlights } from './highlightEventProcessor'

type HighlightsCallback = (highlights: Highlight[]) => void
type LoadingCallback = (loading: boolean) => void

const LAST_SYNCED_KEY = 'nostrverse_highlights_last_synced'

class NostrverseHighlightsController {
  private highlightsListeners: HighlightsCallback[] = []
  private loadingListeners: LoadingCallback[] = []

  private currentHighlights: Highlight[] = []
  private loaded = false
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

  getHighlights(): Highlight[] {
    return [...this.currentHighlights]
  }

  isLoaded(): boolean {
    return this.loaded
  }

  private getLastSyncedAt(): number | null {
    try {
      const raw = localStorage.getItem(LAST_SYNCED_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return typeof parsed?.ts === 'number' ? parsed.ts : null
    } catch {
      return null
    }
  }

  private setLastSyncedAt(timestamp: number): void {
    try {
      localStorage.setItem(LAST_SYNCED_KEY, JSON.stringify({ ts: timestamp }))
    } catch { /* ignore */ }
  }

  async start(options: {
    relayPool: RelayPool
    eventStore: IEventStore
    force?: boolean
  }): Promise<void> {
    const { relayPool, eventStore, force = false } = options

    if (!force && this.loaded) {
      this.emitHighlights(this.currentHighlights)
      return
    }

    this.generation++
    const currentGeneration = this.generation
    this.setLoading(true)

  try {
    const seenIds = new Set<string>()
    // Start with existing highlights when doing incremental sync
    const highlightsMap = new Map<string, Highlight>(
      this.currentHighlights.map(h => [h.id, h])
    )

    const lastSyncedAt = force ? null : this.getLastSyncedAt()
    const filter: { kinds: number[]; since?: number } = { kinds: [KINDS.Highlights] }
    if (lastSyncedAt) filter.since = lastSyncedAt

      const events = await queryEvents(
        relayPool,
        filter,
        {
          onEvent: (evt) => {
            if (currentGeneration !== this.generation) return
            if (seenIds.has(evt.id)) return
            seenIds.add(evt.id)

            eventStore.add(evt)
            const highlight = eventToHighlight(evt)
            highlightsMap.set(highlight.id, highlight)

            const sorted = sortHighlights(Array.from(highlightsMap.values()))
            this.currentHighlights = sorted
            this.emitHighlights(sorted)
          }
        }
      )

      if (currentGeneration !== this.generation) return

    events.forEach(evt => eventStore.add(evt))

    const highlights = events.map(eventToHighlight)
    // Merge new highlights with existing ones
    highlights.forEach(h => highlightsMap.set(h.id, h))
    const sorted = sortHighlights(Array.from(highlightsMap.values()))

    this.currentHighlights = sorted
    this.loaded = true
    this.emitHighlights(sorted)

      if (sorted.length > 0) {
        const newest = Math.max(...sorted.map(h => h.created_at))
        this.setLastSyncedAt(newest)
      }
    } catch (err) {
      // On error, keep existing highlights instead of clearing them
      console.error('[nostrverse-highlights] Failed to sync:', err)
      this.emitHighlights(this.currentHighlights)
    } finally {
      if (currentGeneration === this.generation) this.setLoading(false)
    }
  }
}

export const nostrverseHighlightsController = new NostrverseHighlightsController()


