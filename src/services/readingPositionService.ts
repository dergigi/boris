import { IEventStore, mapEventsToStore } from 'applesauce-core'
import { EventFactory } from 'applesauce-factory'
import { RelayPool, onlyEvents } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { firstValueFrom } from 'rxjs'
import { publishEvent } from './writeService'
import { RELAYS } from '../config/relays'

const APP_DATA_KIND = 30078 // NIP-78 Application Data
const READING_POSITION_PREFIX = 'boris:reading-position:'

export interface ReadingPosition {
  position: number // 0-1 scroll progress
  timestamp: number // Unix timestamp
  scrollTop?: number // Optional: pixel position
}

// Helper to extract and parse reading position from an event
function getReadingPositionContent(event: NostrEvent): ReadingPosition | undefined {
  if (!event.content || event.content.length === 0) return undefined
  try {
    return JSON.parse(event.content) as ReadingPosition
  } catch {
    return undefined
  }
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
 * Save reading position to Nostr (Kind 30078)
 */
export async function saveReadingPosition(
  relayPool: RelayPool,
  eventStore: IEventStore,
  factory: EventFactory,
  articleIdentifier: string,
  position: ReadingPosition
): Promise<void> {
  console.log('💾 [ReadingPosition] Saving position:', {
    identifier: articleIdentifier.slice(0, 32) + '...',
    position: position.position,
    positionPercent: Math.round(position.position * 100) + '%',
    timestamp: position.timestamp,
    scrollTop: position.scrollTop
  })

  const dTag = `${READING_POSITION_PREFIX}${articleIdentifier}`

  const draft = await factory.create(async () => ({
    kind: APP_DATA_KIND,
    content: JSON.stringify(position),
    tags: [
      ['d', dTag],
      ['client', 'boris']
    ],
    created_at: Math.floor(Date.now() / 1000)
  }))

  const signed = await factory.sign(draft)

  // Use unified write service
  await publishEvent(relayPool, eventStore, signed)

  console.log('✅ [ReadingPosition] Position saved successfully, event ID:', signed.id.slice(0, 8))
}

/**
 * Load reading position from Nostr
 */
export async function loadReadingPosition(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  articleIdentifier: string
): Promise<ReadingPosition | null> {
  const dTag = `${READING_POSITION_PREFIX}${articleIdentifier}`

  console.log('📖 [ReadingPosition] Loading position:', {
    pubkey: pubkey.slice(0, 8) + '...',
    identifier: articleIdentifier.slice(0, 32) + '...',
    dTag: dTag.slice(0, 50) + '...'
  })

  // First, check if we already have the position in the local event store
  try {
    const localEvent = await firstValueFrom(
      eventStore.replaceable(APP_DATA_KIND, pubkey, dTag)
    )
    if (localEvent) {
      const content = getReadingPositionContent(localEvent)
      if (content) {
        console.log('✅ [ReadingPosition] Loaded from local store:', {
          position: content.position,
          positionPercent: Math.round(content.position * 100) + '%',
          timestamp: content.timestamp
        })
        
        // Still fetch from relays in the background to get any updates
        relayPool
          .subscription(RELAYS, {
            kinds: [APP_DATA_KIND],
            authors: [pubkey],
            '#d': [dTag]
          })
          .pipe(onlyEvents(), mapEventsToStore(eventStore))
          .subscribe()
        
        return content
      }
    }
  } catch (err) {
    console.log('📭 No cached reading position found, fetching from relays...')
  }

  // If not in local store, fetch from relays
  return new Promise((resolve) => {
    let hasResolved = false
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        console.log('⏱️ Reading position load timeout - no position found')
        hasResolved = true
        resolve(null)
      }
    }, 3000) // Shorter timeout for reading positions

    const sub = relayPool
      .subscription(RELAYS, {
        kinds: [APP_DATA_KIND],
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
                eventStore.replaceable(APP_DATA_KIND, pubkey, dTag)
              )
              if (event) {
                const content = getReadingPositionContent(event)
                if (content) {
                  console.log('✅ [ReadingPosition] Loaded from relays:', {
                    position: content.position,
                    positionPercent: Math.round(content.position * 100) + '%',
                    timestamp: content.timestamp
                  })
                  resolve(content)
                } else {
                  console.log('⚠️ [ReadingPosition] Event found but no valid content')
                  resolve(null)
                }
              } else {
                console.log('📭 [ReadingPosition] No position found on relays')
                resolve(null)
              }
            } catch (err) {
              console.error('❌ Error loading reading position:', err)
              resolve(null)
            }
          }
        },
        error: (err) => {
          console.error('❌ Reading position subscription error:', err)
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

