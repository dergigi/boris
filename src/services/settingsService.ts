import { EventStore } from 'applesauce-core'
import { APP_DATA_KIND, getAppDataContent } from 'applesauce-core/helpers/app-data'
import { AppDataBlueprint } from 'applesauce-factory/blueprints'
import { EventFactory } from 'applesauce-factory'
import { RelayPool, onlyEvents, mapEventsToStore } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Account } from 'applesauce-accounts'

const SETTINGS_IDENTIFIER = 'com.dergigi.boris.user-settings'

export interface UserSettings {
  collapseOnArticleOpen?: boolean
  defaultViewMode?: 'compact' | 'cards' | 'large'
  showUnderlines?: boolean
  sidebarCollapsed?: boolean
  highlightsCollapsed?: boolean
}

export async function loadSettings(
  relayPool: RelayPool,
  eventStore: EventStore,
  pubkey: string,
  relays: string[]
): Promise<UserSettings | null> {
  return new Promise((resolve) => {
    let hasResolved = false
    const timeout = setTimeout(() => {
      if (!hasResolved) {
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
        complete: () => {
          clearTimeout(timeout)
          if (!hasResolved) {
            hasResolved = true
            const event = eventStore.replaceable(APP_DATA_KIND, pubkey, SETTINGS_IDENTIFIER).value
            if (event) {
              const content = getAppDataContent<UserSettings>(event)
              resolve(content || null)
            } else {
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
    }, 5000)
  })
}

export async function saveSettings(
  relayPool: RelayPool,
  eventStore: EventStore,
  factory: EventFactory,
  settings: UserSettings,
  relays: string[]
): Promise<void> {
  const draft = await factory.create(AppDataBlueprint, SETTINGS_IDENTIFIER, settings, false)
  const signed = await factory.sign(draft)
  
  eventStore.add(signed)
  await relayPool.publish(relays, signed)
}

export function watchSettings(
  eventStore: EventStore,
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
