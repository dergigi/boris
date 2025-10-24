import { IEventStore, mapEventsToStore } from 'applesauce-core'
import { EventFactory } from 'applesauce-factory'
import { RelayPool, onlyEvents } from 'applesauce-relay'
import { NostrEvent, nip19 } from 'nostr-tools'
import { firstValueFrom } from 'rxjs'
import { publishEvent } from './writeService'
import { RELAYS } from '../config/relays'
import { KINDS } from '../config/kinds'

const READING_PROGRESS_KIND = KINDS.ReadingProgress // 39802 - NIP-85 Reading Progress

export interface ReadingPosition {
  position: number // 0-1 scroll progress
  timestamp: number // Unix timestamp
  scrollTop?: number // Optional: pixel position
}

export interface ReadingProgressContent {
  progress: number // 0-1 scroll progress
  ts?: number // Unix timestamp (optional, for display)
  loc?: number // Optional: pixel position
}

// Helper to extract and parse reading progress from event (kind 39802)
function getReadingProgressContent(event: NostrEvent): ReadingPosition | undefined {
  if (!event.content || event.content.length === 0) return undefined
  try {
    const content = JSON.parse(event.content) as ReadingProgressContent
    return {
      position: content.progress,
      timestamp: content.ts || event.created_at,
      scrollTop: content.loc
    }
  } catch {
    return undefined
  }
}

// Generate d tag for kind 39802 based on target
// Test cases:
// - naddr1... → "30023:<pubkey>:<identifier>"
// - https://example.com/post → "url:<base64url>"
// - Invalid naddr → "url:<base64url>" (fallback)
function generateDTag(naddrOrUrl: string): string {
  // If it's a nostr article (naddr format), decode and build coordinate
  if (naddrOrUrl.startsWith('naddr1')) {
    try {
      const decoded = nip19.decode(naddrOrUrl)
      if (decoded.type === 'naddr') {
        const dTag = `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier || ''}`
        return dTag
      }
    } catch (e) {
      // Ignore decode errors
    }
  }
  
  // For URLs, use url: prefix with base64url encoding
  const base64url = btoa(naddrOrUrl)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `url:${base64url}`
}

// Generate tags for kind 39802 event
function generateProgressTags(naddrOrUrl: string): string[][] {
  const dTag = generateDTag(naddrOrUrl)
  const tags: string[][] = [['d', dTag]]
  
  // Add 'a' tag for nostr articles
  if (naddrOrUrl.startsWith('naddr1')) {
    try {
      const decoded = nip19.decode(naddrOrUrl)
      if (decoded.type === 'naddr') {
        const coordinate = `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier || ''}`
        tags.push(['a', coordinate])
      }
    } catch (e) {
      // Ignore decode errors
    }
  } else {
    // Add 'r' tag for URLs
    tags.push(['r', naddrOrUrl])
  }
  
  return tags
}

/**
 * Generate a unique identifier for an article
 * For Nostr articles: use the naddr directly
 * For external URLs: use base64url encoding of the URL
 */
export function generateArticleIdentifier(naddrOrUrl: string): string {
  // If it starts with "nostr:", extract the naddr
  if (naddrOrUrl.startsWith('nostr:')) {
    return naddrOrUrl.replace('nostr:', '')
  }
  // For URLs, return the raw URL. Downstream tag generation will encode as needed.
  return naddrOrUrl
}

/**
 * Save reading position to Nostr (kind 39802)
 */
export async function saveReadingPosition(
  relayPool: RelayPool,
  eventStore: IEventStore,
  factory: EventFactory,
  articleIdentifier: string,
  position: ReadingPosition
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  const progressContent: ReadingProgressContent = {
    progress: position.position,
    ts: position.timestamp,
    loc: position.scrollTop
  }
  
  const tags = generateProgressTags(articleIdentifier)
  
  const draft = await factory.create(async () => ({
    kind: READING_PROGRESS_KIND,
    content: JSON.stringify(progressContent),
    tags,
    created_at: now
  }))

  const signed = await factory.sign(draft)
  
  await publishEvent(relayPool, eventStore, signed)
}

/**
 * Streaming reading position loader (non-blocking, EOSE-driven)
 * Seeds from local eventStore, streams relay updates to store in background
 * @returns Unsubscribe function to cancel both store watch and network stream
 */
export function startReadingPositionStream(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  articleIdentifier: string,
  onPosition: (pos: ReadingPosition | null) => void
): () => void {
  const dTag = generateDTag(articleIdentifier)

  // 1) Seed from local replaceable immediately and watch for updates
  const storeSub = eventStore
    .replaceable(READING_PROGRESS_KIND, pubkey, dTag)
    .subscribe((event: NostrEvent | undefined) => {
      if (!event) {
        onPosition(null)
        return
      }
      const parsed = getReadingProgressContent(event)
      onPosition(parsed || null)
    })

  // 2) Stream from relays in background; pipe into store; no timeout/unsubscribe timer
  const networkSub = relayPool
    .subscription(RELAYS, {
      kinds: [READING_PROGRESS_KIND],
      authors: [pubkey],
      '#d': [dTag]
    })
    .pipe(onlyEvents(), mapEventsToStore(eventStore))
    .subscribe()

  // Caller manages lifecycle
  return () => {
    try { storeSub.unsubscribe() } catch { /* ignore */ }
    try { networkSub.unsubscribe() } catch { /* ignore */ }
  }
}

/**
 * Stabilized reading position collector
 * Collects position updates for a brief window, then emits the best one (newest, then highest progress)
 * @returns Object with stop() to cancel and onStable(cb) to register callback
 */
export function collectReadingPositionsOnce(params: {
  relayPool: RelayPool
  eventStore: IEventStore
  pubkey: string
  articleIdentifier: string
  windowMs?: number
}): { stop: () => void; onStable: (cb: (pos: ReadingPosition | null) => void) => void } {
  const { relayPool, eventStore, pubkey, articleIdentifier, windowMs = 700 } = params
  
  const candidates: ReadingPosition[] = []
  let stableCallback: ((pos: ReadingPosition | null) => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let streamStop: (() => void) | null = null
  let hasEmitted = false

  const emitStable = () => {
    if (hasEmitted || !stableCallback) return
    hasEmitted = true

    if (candidates.length === 0) {
      stableCallback(null)
      return
    }

    // Sort: newest first, then highest progress
    candidates.sort((a, b) => {
      const timeDiff = b.timestamp - a.timestamp
      if (timeDiff !== 0) return timeDiff
      return b.position - a.position
    })

    stableCallback(candidates[0])
  }

  // Start streaming and collecting
  streamStop = startReadingPositionStream(
    relayPool,
    eventStore,
    pubkey,
    articleIdentifier,
    (pos) => {
      if (hasEmitted) return
      if (!pos) {
        return
      }
      if (pos.position <= 0.05 || pos.position >= 1) {
        return
      }
      
      candidates.push(pos)

      // Schedule one-shot emission if not already scheduled
      if (!timer) {
        timer = setTimeout(() => {
          emitStable()
          if (streamStop) streamStop()
        }, windowMs)
      }
    }
  )

  return {
    stop: () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (streamStop) {
        streamStop()
        streamStop = null
      }
    },
    onStable: (cb) => {
      stableCallback = cb
    }
  }
}

/**
 * Load reading position from Nostr (kind 39802)
 * @deprecated Use startReadingPositionStream for non-blocking behavior
 * Returns current local position immediately (or null) and starts background sync
 */
export async function loadReadingPosition(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  articleIdentifier: string
): Promise<ReadingPosition | null> {
  const dTag = generateDTag(articleIdentifier)

  let initial: ReadingPosition | null = null
  try {
    const localEvent = await firstValueFrom(
      eventStore.replaceable(READING_PROGRESS_KIND, pubkey, dTag)
    )
    if (localEvent) {
      const content = getReadingProgressContent(localEvent)
      if (content) initial = content
    }
  } catch {
    // ignore
  }

  // Start background sync (fire-and-forget; no timeout)
  relayPool
    .subscription(RELAYS, {
      kinds: [READING_PROGRESS_KIND],
      authors: [pubkey],
      '#d': [dTag]
    })
    .pipe(onlyEvents(), mapEventsToStore(eventStore))
    .subscribe()

  return initial
}

