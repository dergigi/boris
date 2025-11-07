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
  fullWidthImages?: boolean // default: false
  renderVideoLinksAsEmbeds?: boolean // default: false
  // Reading position sync
  syncReadingPosition?: boolean // default: false (opt-in)
  autoScrollToReadingPosition?: boolean // default: true - automatically scroll to saved position when opening article
  autoMarkAsReadOnCompletion?: boolean // default: false (opt-in)
  // Bookmark filtering
  hideBookmarksWithoutCreationDate?: boolean // default: false
  // Content filtering
  hideBotArticlesByName?: boolean // default: true - hide authors whose profile name includes "bot"
  // TTS language selection
  ttsUseSystemLanguage?: boolean // default: false
  ttsDetectContentLanguage?: boolean // default: true
  ttsLanguageMode?: 'system' | 'content' | string // default: 'content', can also be language code like 'en', 'es', etc.
  // Text-to-Speech settings
  ttsDefaultSpeed?: number // default: 2.1
  // Link color for article content
  linkColor?: string // default: #38bdf8 (sky-400)
}

/**
 * Streaming settings loader (non-blocking, EOSE-driven)
 * Seeds from local eventStore, streams relay updates to store in background
 * @returns Unsubscribe function to cancel both store watch and network stream
 */
export function startSettingsStream(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  relays: string[],
  onSettings: (settings: UserSettings | null) => void
): () => void {
  // 1) Seed from local replaceable immediately and watch for updates
  const storeSub = eventStore
    .replaceable(APP_DATA_KIND, pubkey, SETTINGS_IDENTIFIER)
    .subscribe((event: NostrEvent | undefined) => {
      if (!event) {
        onSettings(null)
        return
      }
      const content = getAppDataContent<UserSettings>(event)
      onSettings(content || null)
    })

  // 2) Stream from relays in background; pipe into store; no timeout/unsubscribe timer
  const networkSub = relayPool
    .subscription(relays, {
      kinds: [APP_DATA_KIND],
      authors: [pubkey],
      '#d': [SETTINGS_IDENTIFIER]
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
 * @deprecated Use startSettingsStream + watchSettings for non-blocking behavior.
 * Returns current local settings immediately (or null if not present) and starts background sync.
 */
export async function loadSettings(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  relays: string[]
): Promise<UserSettings | null> {
  let initial: UserSettings | null = null

  try {
    const localEvent = await firstValueFrom(
      eventStore.replaceable(APP_DATA_KIND, pubkey, SETTINGS_IDENTIFIER)
    )
    if (localEvent) {
      const content = getAppDataContent<UserSettings>(localEvent)
      initial = content || null
    }
  } catch {
    // ignore
  }

  // Start background sync (fire-and-forget; no timeout)
  relayPool
    .subscription(relays, {
      kinds: [APP_DATA_KIND],
      authors: [pubkey],
      '#d': [SETTINGS_IDENTIFIER]
    })
    .pipe(onlyEvents(), mapEventsToStore(eventStore))
    .subscribe()

  return initial
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
