import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'
import { RELAYS } from '../config/relays'
import { MARK_AS_READ_EMOJI } from './reactionService'
import { nip19 } from 'nostr-tools'

type MarkedChangeCallback = (markedIds: Set<string>) => void

class ArchiveController {
  private markedIds: Set<string> = new Set()
  private lastLoadedPubkey: string | null = null
  private listeners: MarkedChangeCallback[] = []
  private generation = 0
  private timelineSubscription: { unsubscribe: () => void } | null = null
  private pendingEventIds: Set<string> = new Set()

  onMarked(cb: MarkedChangeCallback): () => void {
    this.listeners.push(cb)
    // Emit current state immediately to new subscribers
    cb(new Set(this.markedIds))
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb)
    }
  }

  private emit(): void {
    const snapshot = new Set(this.markedIds)
    this.listeners.forEach(cb => cb(snapshot))
  }

  isMarked(id: string): boolean {
    return this.markedIds.has(id)
  }

  getMarkedIds(): string[] {
    return Array.from(this.markedIds)
  }

  isLoadedFor(pubkey: string): boolean {
    return this.lastLoadedPubkey === pubkey
  }

  reset(): void {
    this.generation++
    if (this.timelineSubscription) {
      try { this.timelineSubscription.unsubscribe() } catch {}
      this.timelineSubscription = null
    }
    this.markedIds = new Set()
    this.pendingEventIds = new Set()
    this.lastLoadedPubkey = null
    this.emit()
  }

  async start(options: {
    relayPool: RelayPool
    eventStore: IEventStore
    pubkey: string
    force?: boolean
  }): Promise<void> {
    const { relayPool, eventStore, pubkey, force = false } = options
    const startGen = this.generation

    if (!force && this.isLoadedFor(pubkey)) {
      console.log('[archive] start() skipped - already loaded for pubkey')
      return
    }

    // Mark as loaded immediately (fetch runs non-blocking)
    this.lastLoadedPubkey = pubkey
    console.log('[archive] start() begin for pubkey:', pubkey.slice(0, 12), '...')

    // Handlers for streaming queries
    const handleUrlReaction = (evt: NostrEvent) => {
      if (evt.content !== MARK_AS_READ_EMOJI) return
      const rTag = evt.tags.find(t => t[0] === 'r')?.[1]
      if (!rTag) return
      this.markedIds.add(rTag)
      this.emit()
      console.log('[archive] mark url:', rTag)
    }

    const handleEventReaction = (evt: NostrEvent) => {
      if (evt.content !== MARK_AS_READ_EMOJI) return
      const eTag = evt.tags.find(t => t[0] === 'e')?.[1]
      if (!eTag) return
      this.pendingEventIds.add(eTag)
      console.log('[archive] pending event id:', eTag)
    }

    try {
      // Stream kind:17 and kind:7 in parallel
      const [kind17, kind7] = await Promise.all([
        queryEvents(relayPool, { kinds: [17], authors: [pubkey] }, { relayUrls: RELAYS, onEvent: handleUrlReaction }),
        queryEvents(relayPool, { kinds: [7], authors: [pubkey] }, { relayUrls: RELAYS, onEvent: handleEventReaction })
      ])

      if (startGen !== this.generation) return

      // Include EOSE events
      kind17.forEach(handleUrlReaction)
      kind7.forEach(handleEventReaction)
      console.log('[archive] EOSE sizes kind17:', kind17.length, 'kind7:', kind7.length, 'pendingEventIds:', this.pendingEventIds.size)

      if (this.pendingEventIds.size > 0) {
        // Fetch referenced articles (kind:30023) and map event IDs to naddr
        const ids = Array.from(this.pendingEventIds)
        const articleEvents = await queryEvents(relayPool, { kinds: [KINDS.BlogPost], ids }, { relayUrls: RELAYS })
        console.log('[archive] fetched articles for mapping:', articleEvents.length)
        for (const article of articleEvents) {
          const dTag = article.tags.find(t => t[0] === 'd')?.[1]
          if (!dTag) continue
          try {
            const naddr = nip19.naddrEncode({ kind: KINDS.BlogPost, pubkey: article.pubkey, identifier: dTag })
            this.markedIds.add(naddr)
            console.log('[archive] mark naddr:', naddr.slice(0, 24), '...')
          } catch {
            // skip invalid
          }
        }
        this.emit()
      }
      console.log('[archive] total marked ids:', this.markedIds.size)

      // Try immediate mapping via eventStore for any still-pending e-ids
      if (this.pendingEventIds.size > 0) {
        const stillPending = new Set<string>()
        for (const eId of this.pendingEventIds) {
          try {
            // @ts-expect-error eventStore may have getEvent
            const evt: NostrEvent | undefined = (eventStore as unknown as { getEvent?: (id: string) => NostrEvent | undefined }).getEvent?.(eId)
            if (evt && evt.kind === KINDS.BlogPost) {
              const dTag = evt.tags.find(t => t[0] === 'd')?.[1]
              if (dTag) {
                const naddr = nip19.naddrEncode({ kind: KINDS.BlogPost, pubkey: evt.pubkey, identifier: dTag })
                this.markedIds.add(naddr)
                console.log('[archive] map via eventStore naddr:', naddr.slice(0, 24), '...')
              }
            } else {
              stillPending.add(eId)
            }
          } catch { stillPending.add(eId) }
        }
        this.pendingEventIds = stillPending
        if (stillPending.size > 0) {
          // Subscribe to future 30023 arrivals to finalize mapping
          if (this.timelineSubscription) {
            try { this.timelineSubscription.unsubscribe() } catch {}
            this.timelineSubscription = null
          }
          const sub$ = eventStore.timeline({ kinds: [KINDS.BlogPost] })
          const genAtSub = this.generation
          this.timelineSubscription = sub$.subscribe((events: NostrEvent[]) => {
            if (genAtSub !== this.generation) return
            for (const evt of events) {
              if (!this.pendingEventIds.has(evt.id)) continue
              const dTag = evt.tags.find(t => t[0] === 'd')?.[1]
              if (!dTag) continue
              try {
                const naddr = nip19.naddrEncode({ kind: KINDS.BlogPost, pubkey: evt.pubkey, identifier: dTag })
                this.markedIds.add(naddr)
                this.pendingEventIds.delete(evt.id)
                console.log('[archive] map via timeline naddr:', naddr.slice(0, 24), '...')
                this.emit()
              } catch {}
            }
          })
        }
      }
    } catch (err) {
      // Non-blocking fetch; ignore errors here
      console.warn('[archive] start() error:', err)
    }
  }
}

export const archiveController = new ArchiveController()


