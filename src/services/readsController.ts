import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { Bookmark } from '../types/bookmarks'
import { fetchAllReads, ReadItem } from './readsService'
import { mergeReadItem } from '../utils/readItemMerge'

type ReadsCallback = (reads: ReadItem[]) => void
type LoadingCallback = (loading: boolean) => void

const LAST_SYNCED_KEY = 'reads_last_synced'

/**
 * Shared reads controller
 * Manages the user's reading activity centrally:
 * - Reading progress (kind:39802)
 * - Marked as read reactions (kind:7, kind:17)
 * - Highlights
 * - Bookmarked articles
 * 
 * Streams updates as data arrives, similar to highlightsController
 */
class ReadsController {
  private readsListeners: ReadsCallback[] = []
  private loadingListeners: LoadingCallback[] = []
  
  private currentReads: ReadItem[] = []
  private lastLoadedPubkey: string | null = null
  private generation = 0

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

  private setLoading(loading: boolean): void {
    this.loadingListeners.forEach(cb => cb(loading))
  }

  private emitReads(reads: ReadItem[]): void {
    this.readsListeners.forEach(cb => cb([...reads]))
  }

  /**
   * Get current reads without triggering a reload
   */
  getReads(): ReadItem[] {
    return [...this.currentReads]
  }

  /**
   * Check if reads are loaded for a specific pubkey
   */
  isLoadedFor(pubkey: string): boolean {
    return this.lastLoadedPubkey === pubkey && this.currentReads.length >= 0
  }

  /**
   * Reset state (for logout or manual refresh)
   */
  reset(): void {
    this.generation++
    this.currentReads = []
    this.lastLoadedPubkey = null
    this.emitReads(this.currentReads)
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
      console.warn('[reads] Failed to save last synced timestamp:', err)
    }
  }

  /**
   * Load reads for a user
   * Streams results as they arrive from relays
   */
  async start(params: {
    relayPool: RelayPool
    eventStore: IEventStore
    pubkey: string
    force?: boolean
  }): Promise<void> {
    const { relayPool, eventStore, pubkey, force = false } = params
    const startGeneration = this.generation

    // Skip if already loaded for this pubkey (unless forced)
    if (!force && this.isLoadedFor(pubkey)) {
      this.emitReads(this.currentReads)
      return
    }

    this.setLoading(true)
    this.lastLoadedPubkey = pubkey

    try {
      const readsMap = new Map<string, ReadItem>()

      // Stream items as they're fetched
      // This updates the UI progressively as reading progress, marks as read, bookmarks arrive
      await fetchAllReads(relayPool, pubkey, [], (item) => {
        // Check if this generation is still active (user didn't log out)
        if (startGeneration !== this.generation) return

        // Merge and update internal state
        mergeReadItem(readsMap, item)
        
        // Sort and emit to listeners
        const sorted = Array.from(readsMap.values()).sort((a, b) => {
          const timeA = a.readingTimestamp || a.markedAt || 0
          const timeB = b.readingTimestamp || b.markedAt || 0
          return timeB - timeA
        })
        
        this.currentReads = sorted
        this.emitReads(sorted)
      })

      // Check if still active after async operation
      if (startGeneration !== this.generation) {
        return
      }

      // Update last synced timestamp
      const newestTimestamp = Math.max(
        ...Array.from(readsMap.values()).map(r => r.readingTimestamp || r.markedAt || 0)
      )
      if (newestTimestamp > 0) {
        this.setLastSyncedAt(pubkey, Math.floor(newestTimestamp))
      }

    } catch (error) {
      console.error('[reads] Failed to load reads:', error)
      this.currentReads = []
      this.emitReads(this.currentReads)
    } finally {
      // Only clear loading if this generation is still active
      if (startGeneration === this.generation) {
        this.setLoading(false)
      }
    }
  }
}

// Singleton instance
export const readsController = new ReadsController()
