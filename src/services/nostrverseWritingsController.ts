import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { toBlogPostPreview } from '../utils/toBlogPostPreview'
import { NostrEvent } from 'nostr-tools'
import { KINDS } from '../config/kinds'
import { queryEvents } from './dataFetch'
import { BlogPostPreview } from './exploreService'
import { cacheArticleEvent } from './articleService'

type WritingsCallback = (posts: BlogPostPreview[]) => void
type LoadingCallback = (loading: boolean) => void

const LAST_SYNCED_KEY = 'nostrverse_writings_last_synced'

function toPreview(event: NostrEvent): BlogPostPreview {
  return toBlogPostPreview(event)
}

function sortPosts(posts: BlogPostPreview[]): BlogPostPreview[] {
  return posts.slice().sort((a, b) => {
    const timeA = a.published || a.event.created_at
    const timeB = b.published || b.event.created_at
    return timeB - timeA
  })
}

class NostrverseWritingsController {
  private writingsListeners: WritingsCallback[] = []
  private loadingListeners: LoadingCallback[] = []

  private currentPosts: BlogPostPreview[] = []
  private loaded = false
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

  getWritings(): BlogPostPreview[] {
    return [...this.currentPosts]
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

  private setLastSyncedAt(ts: number): void {
    try { localStorage.setItem(LAST_SYNCED_KEY, JSON.stringify({ ts })) } catch { /* ignore */ }
  }

  async start(options: {
    relayPool: RelayPool
    eventStore: IEventStore
    force?: boolean
  }): Promise<void> {
    const { relayPool, eventStore, force = false } = options

    if (!force && this.loaded) {
      this.emitWritings(this.currentPosts)
      return
    }

    this.generation++
    const currentGeneration = this.generation
    this.setLoading(true)

    try {
      const seenIds = new Set<string>()
      const uniqueByReplaceable = new Map<string, BlogPostPreview>()

      // Shared helper: dedupe first, then cache only if accepted
      const upsertPost = (evt: NostrEvent, emit: boolean): void => {
        const dTag = evt.tags.find(t => t[0] === 'd')?.[1] || ''
        const key = `${evt.pubkey}:${dTag}`
        const existing = uniqueByReplaceable.get(key)
        if (!existing || evt.created_at > existing.event.created_at) {
          const preview = toPreview(evt)
          uniqueByReplaceable.set(key, preview)
          cacheArticleEvent(evt)
          if (emit) {
            const sorted = sortPosts(Array.from(uniqueByReplaceable.values()))
            this.currentPosts = sorted
            this.emitWritings(sorted)
          }
        }
      }

      const lastSyncedAt = force ? null : this.getLastSyncedAt()
      const filter: { kinds: number[]; since?: number } = { kinds: [KINDS.BlogPost] }
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
            upsertPost(evt, true)
          }
        }
      )

      if (currentGeneration !== this.generation) return

      events.forEach(evt => eventStore.add(evt))

      events.forEach(evt => {
        upsertPost(evt, false)
      })

      const sorted = sortPosts(Array.from(uniqueByReplaceable.values()))
      this.currentPosts = sorted
      this.loaded = true
      this.emitWritings(sorted)

      if (sorted.length > 0) {
        const newest = Math.max(...sorted.map(p => p.event.created_at))
        this.setLastSyncedAt(newest)
      }
    } catch {
      this.currentPosts = []
      this.emitWritings(this.currentPosts)
    } finally {
      if (currentGeneration === this.generation) this.setLoading(false)
    }
  }
}

export const nostrverseWritingsController = new NostrverseWritingsController()


