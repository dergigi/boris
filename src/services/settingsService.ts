import { IEventStore, mapEventsToStore } from 'applesauce-core'
import { APP_DATA_KIND, getAppDataContent } from 'applesauce-core/helpers/app-data'
import { AppDataBlueprint } from 'applesauce-factory/blueprints'
import { EventFactory } from 'applesauce-factory'
import { RelayPool, onlyEvents } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { firstValueFrom } from 'rxjs'

const SETTINGS_IDENTIFIER = 'com.dergigi.boris.user-settings'

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
}

export async function loadSettings(
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkey: string,
  relays: string[]
): Promise<UserSettings | null> {
  console.log('⚙️ Loading settings from nostr...', { pubkey: pubkey.slice(0, 8) + '...', relays })
  
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
                console.log('✅ Settings loaded from nostr:', content)
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
  
  const draft = await factory.create(AppDataBlueprint, SETTINGS_IDENTIFIER, settings, false)
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
