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
  ver?: string // Schema version
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
        console.log('[progress] 📋 Generated d-tag from naddr:', {
          naddr: naddrOrUrl.slice(0, 50) + '...',
          dTag: dTag.slice(0, 80) + '...'
        })
        return dTag
      }
    } catch (e) {
      console.warn('Failed to decode naddr:', naddrOrUrl)
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
  // For URLs, use base64url encoding (URL-safe)
  return btoa(naddrOrUrl)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
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
  console.log('[progress] 💾 saveReadingPosition: Starting save:', {
    identifier: articleIdentifier.slice(0, 50) + '...',
    position: position.position,
    positionPercent: Math.round(position.position * 100) + '%',
    timestamp: position.timestamp,
    scrollTop: position.scrollTop
  })

  const now = Math.floor(Date.now() / 1000)

  const progressContent: ReadingProgressContent = {
    progress: position.position,
    ts: position.timestamp,
    loc: position.scrollTop,
    ver: '1'
  }
  
  const tags = generateProgressTags(articleIdentifier)
  
  console.log('[progress] 📝 Creating event with:', {
    kind: READING_PROGRESS_KIND,
    content: progressContent,
    tags: tags.map(t => `[${t.join(', ')}]`).join(', '),
    created_at: now
  })
  
  const draft = await factory.create(async () => ({
    kind: READING_PROGRESS_KIND,
    content: JSON.stringify(progressContent),
    tags,
    created_at: now
  }))

  console.log('[progress] ✍️ Signing event...')
  const signed = await factory.sign(draft)
  
  console.log('[progress] 📡 Publishing event:', {
    id: signed.id,
    kind: signed.kind,
    pubkey: signed.pubkey.slice(0, 8) + '...',
    content: signed.content,
    tags: signed.tags
  })
  
  await publishEvent(relayPool, eventStore, signed)
  
  console.log('[progress] ✅ Event published successfully, ID:', signed.id.slice(0, 16))
}

/**
 * Load reading position from Nostr (kind 39802)
 */
export async function loadReadingPosition(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  articleIdentifier: string
): Promise<ReadingPosition | null> {
  const dTag = generateDTag(articleIdentifier)

  console.log('📖 [ReadingProgress] Loading position:', {
    pubkey: pubkey.slice(0, 8) + '...',
    identifier: articleIdentifier.slice(0, 32) + '...',
    dTag: dTag.slice(0, 50) + '...'
  })

  // Check local event store first
  try {
    const localEvent = await firstValueFrom(
      eventStore.replaceable(READING_PROGRESS_KIND, pubkey, dTag)
    )
    if (localEvent) {
      const content = getReadingProgressContent(localEvent)
      if (content) {
        console.log('✅ [ReadingProgress] Loaded from local store:', {
          position: content.position,
          positionPercent: Math.round(content.position * 100) + '%',
          timestamp: content.timestamp
        })
        
        // Fetch from relays in background to get any updates
        relayPool
          .subscription(RELAYS, {
            kinds: [READING_PROGRESS_KIND],
            authors: [pubkey],
            '#d': [dTag]
          })
          .pipe(onlyEvents(), mapEventsToStore(eventStore))
          .subscribe()
        
        return content
      }
    }
  } catch (err) {
    console.log('📭 No cached reading progress found, fetching from relays...')
  }

  // Fetch from relays
  const result = await fetchFromRelays(
    relayPool,
    eventStore,
    pubkey,
    READING_PROGRESS_KIND,
    dTag,
    getReadingProgressContent
  )
  
  if (result) {
    console.log('✅ [ReadingProgress] Loaded from relays')
    return result
  }

  console.log('📭 No reading progress found')
  return null
}

// Helper function to fetch from relays with timeout
async function fetchFromRelays(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  kind: number,
  dTag: string,
  parser: (event: NostrEvent) => ReadingPosition | undefined
): Promise<ReadingPosition | null> {
  return new Promise((resolve) => {
    let hasResolved = false
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true
        resolve(null)
      }
    }, 3000)

    const sub = relayPool
      .subscription(RELAYS, {
        kinds: [kind],
        authors: [pubkey],
        '#d': [dTag]
      })
      .pipe(onlyEvents(), mapEventsToStore(eventStore))
      .subscribe({
        complete: async () => {
          clearTimeout(timeout)
          if (!hasResolved) {
            hasResolved = true
            try {
              const event = await firstValueFrom(
                eventStore.replaceable(kind, pubkey, dTag)
              )
              if (event) {
                const content = parser(event)
                resolve(content || null)
              } else {
                resolve(null)
              }
            } catch (err) {
              resolve(null)
            }
          }
        },
        error: () => {
          clearTimeout(timeout)
          if (!hasResolved) {
            hasResolved = true
            resolve(null)
          }
        }
      })

    setTimeout(() => {
      sub.unsubscribe()
    }, 3000)
  })
}

