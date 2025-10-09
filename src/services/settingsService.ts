import { IEventStore, mapEventsToStore } from 'applesauce-core'
import { EventFactory } from 'applesauce-factory'
import { RelayPool, onlyEvents } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { firstValueFrom } from 'rxjs'

const SETTINGS_IDENTIFIER = 'com.dergigi.boris.user-settings'
const APP_DATA_KIND = 30078 // NIP-78 Application Data

// Helper to extract and parse app data content from an event
function getAppDataContent<R>(event: NostrEvent): R | undefined {
  if (!event.content || event.content.length === 0) return undefined
  try {
    return JSON.parse(event.content) as R
  } catch {
    return undefined
  }
}

export interface UserSettings {
  collapseOnArticleOpen?: boolean
  defaultViewMode?: 'compact' | 'cards' | 'large'
  showHighlights?: boolean
  sidebarCollapsed?: boolean
  highlightsCollapsed?: boolean
  readingFont?: string
  fontSize?: number
  highlightStyle?: 'marker' | 'underline'
  highlightColor?: string
  // Three-level highlight colors
  highlightColorNostrverse?: string
  highlightColorFriends?: string
  highlightColorMine?: string
  // Default highlight visibility toggles
  defaultHighlightVisibilityNostrverse?: boolean
  defaultHighlightVisibilityFriends?: boolean
  defaultHighlightVisibilityMine?: boolean
  // Zap split weights (treated as relative weights, not strict percentages)
  zapSplitHighlighterWeight?: number // default 50
  zapSplitBorisWeight?: number // default 2.1
  zapSplitAuthorWeight?: number // default 50
  // Relay rebroadcast settings
  useLocalRelayAsCache?: boolean // Rebroadcast events to local relays
  rebroadcastToAllRelays?: boolean // Rebroadcast events to all relays
  // Image cache settings
  enableImageCache?: boolean // Enable caching images in localStorage
  imageCacheSizeMB?: number // Maximum cache size in megabytes (default: 50MB)
}

export async function loadSettings(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  relays: string[]
): Promise<UserSettings | null> {
  console.log('⚙️ Loading settings from nostr...', { pubkey: pubkey.slice(0, 8) + '...', relays })
  
  // First, check if we already have settings in the local event store
  try {
    const localEvent = await firstValueFrom(
      eventStore.replaceable(APP_DATA_KIND, pubkey, SETTINGS_IDENTIFIER)
    )
    if (localEvent) {
      const content = getAppDataContent<UserSettings>(localEvent)
      console.log('✅ Settings loaded from local store (cached):', content)
      
      // Still fetch from relays in the background to get any updates
      relayPool
        .subscription(relays, {
          kinds: [APP_DATA_KIND],
          authors: [pubkey],
          '#d': [SETTINGS_IDENTIFIER]
        })
        .pipe(onlyEvents(), mapEventsToStore(eventStore))
        .subscribe()
      
      return content || null
    }
  } catch (err) {
    console.log('📭 No cached settings found, fetching from relays...')
  }
  
  // If not in local store, fetch from relays
  return new Promise((resolve) => {
    let hasResolved = false
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        console.warn('⚠️ Settings load timeout - no settings event found')
        hasResolved = true
        resolve(null)
      }
    }, 5000)

    const sub = relayPool
      .subscription(relays, {
        kinds: [APP_DATA_KIND],
        authors: [pubkey],
        '#d': [SETTINGS_IDENTIFIER]
      })
      .pipe(onlyEvents(), mapEventsToStore(eventStore))
      .subscribe({
        complete: async () => {
          clearTimeout(timeout)
          if (!hasResolved) {
            hasResolved = true
            try {
              const event = await firstValueFrom(
                eventStore.replaceable(APP_DATA_KIND, pubkey, SETTINGS_IDENTIFIER)
              )
              if (event) {
                const content = getAppDataContent<UserSettings>(event)
                console.log('✅ Settings loaded from relays:', content)
                resolve(content || null)
              } else {
                console.log('📭 No settings event found - using defaults')
                resolve(null)
              }
            } catch (err) {
              console.error('❌ Error loading settings:', err)
              resolve(null)
            }
          }
        },
        error: (err) => {
          console.error('❌ Settings subscription error:', err)
          clearTimeout(timeout)
          if (!hasResolved) {
            hasResolved = true
            resolve(null)
          }
        }
      })

    setTimeout(() => {
      sub.unsubscribe()
    }, 5000)
  })
}

export async function saveSettings(
  relayPool: RelayPool,
  eventStore: IEventStore,
  factory: EventFactory,
  settings: UserSettings,
  relays: string[]
): Promise<void> {
  console.log('💾 Saving settings to nostr:', settings)
  
  // Create NIP-78 application data event manually
  // Note: AppDataBlueprint is not available in the npm package
  const draft = await factory.create(async () => ({
    kind: APP_DATA_KIND,
    content: JSON.stringify(settings),
    tags: [['d', SETTINGS_IDENTIFIER]],
    created_at: Math.floor(Date.now() / 1000)
  }))
  
  const signed = await factory.sign(draft)
  
  console.log('📤 Publishing settings event:', signed.id, 'to', relays.length, 'relays')
  
  eventStore.add(signed)
  await relayPool.publish(relays, signed)
  
  console.log('✅ Settings published successfully')
}

export function watchSettings(
  eventStore: IEventStore,
  pubkey: string,
  callback: (settings: UserSettings | null) => void
) {
  return eventStore.replaceable(APP_DATA_KIND, pubkey, SETTINGS_IDENTIFIER).subscribe((event: NostrEvent | undefined) => {
    if (event) {
      const content = getAppDataContent<UserSettings>(event)
      callback(content || null)
    } else {
      callback(null)
    }
  })
}
