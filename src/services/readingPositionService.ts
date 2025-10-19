import { IEventStore, mapEventsToStore } from 'applesauce-core'
import { EventFactory } from 'applesauce-factory'
import { RelayPool, onlyEvents } from 'applesauce-relay'
import { NostrEvent, nip19 } from 'nostr-tools'
import { firstValueFrom } from 'rxjs'
import { publishEvent } from './writeService'
import { RELAYS } from '../config/relays'
import { KINDS } from '../config/kinds'

const APP_DATA_KIND = KINDS.AppData // 30078 - Legacy NIP-78 Application Data
const READING_PROGRESS_KIND = KINDS.ReadingProgress // 39802 - NIP-39802 Reading Progress
const READING_POSITION_PREFIX = 'boris:reading-position:' // Legacy prefix

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

// Helper to extract and parse reading position from legacy event (kind 30078)
function getReadingPositionContent(event: NostrEvent): ReadingPosition | undefined {
  if (!event.content || event.content.length === 0) return undefined
  try {
    return JSON.parse(event.content) as ReadingPosition
  } catch {
    return undefined
  }
}

// Helper to extract and parse reading progress from new event (kind 39802)
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
function generateDTag(naddrOrUrl: string): string {
  // If it's a nostr article (naddr format), decode and build coordinate
  if (naddrOrUrl.startsWith('naddr1')) {
    try {
      const decoded = nip19.decode(naddrOrUrl)
      if (decoded.type === 'naddr') {
        return `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier || ''}`
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
  const tags: string[][] = [['d', dTag], ['client', 'boris']]
  
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
 * Save reading position to Nostr
 * Supports both new kind 39802 and legacy kind 30078 (dual-write during migration)
 */
export async function saveReadingPosition(
  relayPool: RelayPool,
  eventStore: IEventStore,
  factory: EventFactory,
  articleIdentifier: string,
  position: ReadingPosition,
  options?: {
    useProgressKind?: boolean // Default: true
    writeLegacy?: boolean // Default: true (dual-write)
  }
): Promise<void> {
  const useProgressKind = options?.useProgressKind !== false
  const writeLegacy = options?.writeLegacy !== false
  
  console.log('💾 [ReadingPosition] Saving position:', {
    identifier: articleIdentifier.slice(0, 32) + '...',
    position: position.position,
    positionPercent: Math.round(position.position * 100) + '%',
    timestamp: position.timestamp,
    scrollTop: position.scrollTop,
    useProgressKind,
    writeLegacy
  })

  const now = Math.floor(Date.now() / 1000)

  // Write new kind 39802 (preferred)
  if (useProgressKind) {
    const progressContent: ReadingProgressContent = {
      progress: position.position,
      ts: position.timestamp,
      loc: position.scrollTop,
      ver: '1'
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
    
    console.log('✅ [ReadingProgress] Saved kind 39802, event ID:', signed.id.slice(0, 8))
  }

  // Write legacy kind 30078 (for backward compatibility)
  if (writeLegacy) {
    const legacyDTag = `${READING_POSITION_PREFIX}${articleIdentifier}`
    
    const legacyDraft = await factory.create(async () => ({
      kind: APP_DATA_KIND,
      content: JSON.stringify(position),
      tags: [
        ['d', legacyDTag],
        ['client', 'boris']
      ],
      created_at: now
    }))

    const legacySigned = await factory.sign(legacyDraft)
    await publishEvent(relayPool, eventStore, legacySigned)
    
    console.log('✅ [ReadingPosition] Saved legacy kind 30078, event ID:', legacySigned.id.slice(0, 8))
  }
}

/**
 * Load reading position from Nostr
 * Tries new kind 39802 first, falls back to legacy kind 30078
 */
export async function loadReadingPosition(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  articleIdentifier: string,
  options?: {
    useProgressKind?: boolean // Default: true
  }
): Promise<ReadingPosition | null> {
  const useProgressKind = options?.useProgressKind !== false
  const progressDTag = generateDTag(articleIdentifier)
  const legacyDTag = `${READING_POSITION_PREFIX}${articleIdentifier}`

  console.log('📖 [ReadingPosition] Loading position:', {
    pubkey: pubkey.slice(0, 8) + '...',
    identifier: articleIdentifier.slice(0, 32) + '...',
    progressDTag: progressDTag.slice(0, 50) + '...',
    legacyDTag: legacyDTag.slice(0, 50) + '...'
  })

  // Try new kind 39802 first (if enabled)
  if (useProgressKind) {
    try {
      const localEvent = await firstValueFrom(
        eventStore.replaceable(READING_PROGRESS_KIND, pubkey, progressDTag)
      )
      if (localEvent) {
        const content = getReadingProgressContent(localEvent)
        if (content) {
          console.log('✅ [ReadingProgress] Loaded kind 39802 from local store:', {
            position: content.position,
            positionPercent: Math.round(content.position * 100) + '%',
            timestamp: content.timestamp
          })
          
          // Fetch from relays in background
          relayPool
            .subscription(RELAYS, {
              kinds: [READING_PROGRESS_KIND],
              authors: [pubkey],
              '#d': [progressDTag]
            })
            .pipe(onlyEvents(), mapEventsToStore(eventStore))
            .subscribe()
          
          return content
        }
      }
    } catch (err) {
      console.log('📭 No cached kind 39802 found, trying relays...')
    }

    // Try fetching kind 39802 from relays
    const progressResult = await fetchFromRelays(
      relayPool,
      eventStore,
      pubkey,
      READING_PROGRESS_KIND,
      progressDTag,
      getReadingProgressContent
    )
    
    if (progressResult) {
      console.log('✅ [ReadingProgress] Loaded kind 39802 from relays')
      return progressResult
    }
  }

  // Fall back to legacy kind 30078
  console.log('📭 No kind 39802 found, trying legacy kind 30078...')
  
  try {
    const localEvent = await firstValueFrom(
      eventStore.replaceable(APP_DATA_KIND, pubkey, legacyDTag)
    )
    if (localEvent) {
      const content = getReadingPositionContent(localEvent)
      if (content) {
        console.log('✅ [ReadingPosition] Loaded legacy kind 30078 from local store:', {
          position: content.position,
          positionPercent: Math.round(content.position * 100) + '%',
          timestamp: content.timestamp
        })
        
        // Fetch from relays in background
        relayPool
          .subscription(RELAYS, {
            kinds: [APP_DATA_KIND],
            authors: [pubkey],
            '#d': [legacyDTag]
          })
          .pipe(onlyEvents(), mapEventsToStore(eventStore))
          .subscribe()
        
        return content
      }
    }
  } catch (err) {
    console.log('📭 No cached legacy position found, trying relays...')
  }

  // Try fetching legacy from relays
  const legacyResult = await fetchFromRelays(
    relayPool,
    eventStore,
    pubkey,
    APP_DATA_KIND,
    legacyDTag,
    getReadingPositionContent
  )
  
  if (legacyResult) {
    console.log('✅ [ReadingPosition] Loaded legacy kind 30078 from relays')
    return legacyResult
  }

  console.log('📭 No reading position found')
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

