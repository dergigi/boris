import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IAccount } from 'applesauce-core/helpers'
import { RELAYS } from '../config/relays'
import { isLocalRelay } from '../utils/helpers'

let isSyncing = false

/**
 * Syncs local-only events to remote relays when coming back online
 */
export async function syncLocalEventsToRemote(
  relayPool: RelayPool,
  account: IAccount
): Promise<void> {
  if (isSyncing) {
    console.log('⏳ Sync already in progress, skipping...')
    return
  }

  console.log('🔄 Coming back online - syncing local events to remote relays...')
  isSyncing = true

  try {
    const localRelays = RELAYS.filter(isLocalRelay)
    const remoteRelays = RELAYS.filter(url => !isLocalRelay(url))

    if (localRelays.length === 0 || remoteRelays.length === 0) {
      console.log('⚠️ No local or remote relays available for sync')
      return
    }

    // Get events from local relays that were created in the last 24 hours
    const since = Math.floor(Date.now() / 1000) - (24 * 60 * 60)
    const eventsToSync: NostrEvent[] = []

    // Query for user's events from local relays
    const filters = [
      { kinds: [9802], authors: [account.pubkey], since }, // Highlights
      { kinds: [10003, 30003], authors: [account.pubkey], since }, // Bookmarks
    ]

    for (const filter of filters) {
      const events = await new Promise<NostrEvent[]>((resolve) => {
        const collected: NostrEvent[] = []
        const sub = relayPool.req(localRelays, filter, {
          onevent: (event: NostrEvent) => {
            collected.push(event)
          },
          oneose: () => {
            sub.close()
            resolve(collected)
          }
        })

        // Timeout after 5 seconds
        setTimeout(() => {
          sub.close()
          resolve(collected)
        }, 5000)
      })

      eventsToSync.push(...events)
    }

    if (eventsToSync.length === 0) {
      console.log('✅ No local events to sync')
      isSyncing = false
      return
    }

    // Deduplicate events by id
    const uniqueEvents = Array.from(
      new Map(eventsToSync.map(e => [e.id, e])).values()
    )

    console.log(`📤 Syncing ${uniqueEvents.length} event(s) to remote relays...`)

    // Publish to remote relays
    let successCount = 0
    for (const event of uniqueEvents) {
      try {
        await relayPool.publish(remoteRelays, event)
        successCount++
      } catch (error) {
        console.warn(`⚠️ Failed to sync event ${event.id.slice(0, 8)}:`, error)
      }
    }

    console.log(`✅ Synced ${successCount}/${uniqueEvents.length} events to remote relays`)
  } catch (error) {
    console.error('❌ Error during offline sync:', error)
  } finally {
    isSyncing = false
  }
}

