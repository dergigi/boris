import { RelayPool } from 'applesauce-relay'
import { IEventStore, Helpers } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'
import { KINDS } from '../config/kinds'
import { queryEvents } from './dataFetch'
import { BlogPostPreview } from './exploreService'

const { getArticleTitle, getArticleSummary, getArticleImage, getArticlePublished } = Helpers

type WritingsCallback = (posts: BlogPostPreview[]) => void
type LoadingCallback = (loading: boolean) => void

/**
 * Shared writings controller
 * Manages the user's nostr-native long-form articles (kind:30023) centrally,
 * similar to highlightsController
 */
class WritingsController {
  private writingsListeners: WritingsCallback[] = []
  private loadingListeners: LoadingCallback[] = []
  
  private currentPosts: BlogPostPreview[] = []
  private lastLoadedPubkey: string | null = null
  private generation = 0

  onWritings(cb: WritingsCallback): () => void {
    this.writingsListeners.push(cb)
    return () => {
      this.writingsListeners = this.writingsListeners.filter(l => l !== cb)
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

  private emitWritings(posts: BlogPostPreview[]): void {
    this.writingsListeners.forEach(cb => cb(posts))
  }

  /**
   * Get current writings without triggering a reload
   */
  getWritings(): BlogPostPreview[] {
    return [...this.currentPosts]
  }

  /**
   * Check if writings are loaded for a specific pubkey
   */
  isLoadedFor(pubkey: string): boolean {
    return this.lastLoadedPubkey === pubkey && this.currentPosts.length >= 0
  }

  /**
   * Reset state (for logout or manual refresh)
   */
  reset(): void {
    this.generation++
    this.currentPosts = []
    this.lastLoadedPubkey = null
    this.emitWritings(this.currentPosts)
  }

  /**
   * Convert NostrEvent to BlogPostPreview using applesauce Helpers
   */
  private toPreview(event: NostrEvent): BlogPostPreview {
    return {
      event,
      title: getArticleTitle(event) || 'Untitled',
      summary: getArticleSummary(event),
      image: getArticleImage(event),
      published: getArticlePublished(event),
      author: event.pubkey
    }
  }

  /**
   * Sort posts by published/created date (most recent first)
   */
  private sortPosts(posts: BlogPostPreview[]): BlogPostPreview[] {
    return posts.slice().sort((a, b) => {
      const timeA = a.published || a.event.created_at
      const timeB = b.published || b.event.created_at
      return timeB - timeA
    })
  }

  /**
   * Load writings for a user (kind:30023)
   * Streams results and stores in event store
   * Always fetches ALL writings to ensure completeness
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
      this.emitWritings(this.currentPosts)
      return
    }

    // Increment generation to cancel any in-flight work
    this.generation++
    const currentGeneration = this.generation

    this.setLoading(true)

    try {
      const seenIds = new Set<string>()
      const uniqueByReplaceable = new Map<string, BlogPostPreview>()

      // Fetch ALL writings without limits (no since filter)
      // This ensures we get complete results for profile/my pages
      const filter = {
        kinds: [KINDS.BlogPost],
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

            // Dedupe by replaceable key (author + d-tag)
            const dTag = evt.tags.find(t => t[0] === 'd')?.[1] || ''
            const key = `${evt.pubkey}:${dTag}`
            
            const preview = this.toPreview(evt)
            const existing = uniqueByReplaceable.get(key)
            
            // Keep the newest version for replaceable events
            if (!existing || evt.created_at > existing.event.created_at) {
              uniqueByReplaceable.set(key, preview)

              // Stream to listeners
              const sortedPosts = this.sortPosts(Array.from(uniqueByReplaceable.values()))
              this.currentPosts = sortedPosts
              this.emitWritings(sortedPosts)
            }
          }
        }
      )

      // Check if still active after async operation
      if (currentGeneration !== this.generation) {
        return
      }

      // Store all events in event store
      events.forEach(evt => eventStore.add(evt))

      // Final processing - ensure we have the latest version of each replaceable
      events.forEach(evt => {
        const dTag = evt.tags.find(t => t[0] === 'd')?.[1] || ''
        const key = `${evt.pubkey}:${dTag}`
        const existing = uniqueByReplaceable.get(key)
        
        if (!existing || evt.created_at > existing.event.created_at) {
          uniqueByReplaceable.set(key, this.toPreview(evt))
        }
      })

      const sorted = this.sortPosts(Array.from(uniqueByReplaceable.values()))

      this.currentPosts = sorted
      this.lastLoadedPubkey = pubkey
      this.emitWritings(sorted)

    } catch (error) {
      console.error('[writings] ❌ Failed to load writings:', error)
      this.currentPosts = []
      this.emitWritings(this.currentPosts)
    } finally {
      // Only clear loading if this generation is still active
      if (currentGeneration === this.generation) {
        this.setLoading(false)
      }
    }
  }
}

// Singleton instance
export const writingsController = new WritingsController()

