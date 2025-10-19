import { IEventStore, mapEventsToStore } from 'applesauce-core'
import { EventFactory } from 'applesauce-factory'
import { RelayPool, onlyEvents } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { firstValueFrom } from 'rxjs'
import { publishEvent } from './writeService'

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
  // Default explore scope
  defaultExploreScopeNostrverse?: boolean
  defaultExploreScopeFriends?: boolean
  defaultExploreScopeMine?: boolean
  // Zap split weights (treated as relative weights, not strict percentages)
  zapSplitHighlighterWeight?: number // default 50
  zapSplitBorisWeight?: number // default 2.1
  zapSplitAuthorWeight?: number // default 50
  // Relay rebroadcast settings
  useLocalRelayAsCache?: boolean // Rebroadcast events to local relays
  rebroadcastToAllRelays?: boolean // Rebroadcast events to all relays
  // Image cache settings
  enableImageCache?: boolean // Enable caching images in localStorage
  imageCacheSizeMB?: number // Maximum cache size in megabytes (default: 210MB)
  // Mobile settings
  autoCollapseSidebarOnMobile?: boolean // Auto-collapse sidebar on mobile (default: true)
  // Theme preference
  theme?: 'dark' | 'light' | 'system' // default: system
  darkColorTheme?: 'black' | 'midnight' | 'charcoal' // default: midnight
  lightColorTheme?: 'paper-white' | 'sepia' | 'ivory' // default: sepia
  // Reading settings
  paragraphAlignment?: 'left' | 'justify' // default: justify
  // Reading position sync
  syncReadingPosition?: boolean // default: false (opt-in)
  autoMarkAsReadOnCompletion?: boolean // default: false (opt-in)
  // Bookmark filtering
  hideBookmarksWithoutCreationDate?: boolean // default: false
}

export async function loadSettings(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  relays: string[]
): Promise<UserSettings | null> {
  
  // First, check if we already have settings in the local event store
  try {
    const localEvent = await firstValueFrom(
      eventStore.replaceable(APP_DATA_KIND, pubkey, SETTINGS_IDENTIFIER)
    )
    if (localEvent) {
      const content = getAppDataContent<UserSettings>(localEvent)
      
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
                resolve(content || null)
              } else {
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
  settings: UserSettings
): Promise<void> {

  // Create NIP-78 application data event manually
  // Note: AppDataBlueprint is not available in the npm package
  const draft = await factory.create(async () => ({
    kind: APP_DATA_KIND,
    content: JSON.stringify(settings),
    tags: [['d', SETTINGS_IDENTIFIER]],
    created_at: Math.floor(Date.now() / 1000)
  }))

  const signed = await factory.sign(draft)

  // Use unified write service
  await publishEvent(relayPool, eventStore, signed)

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
