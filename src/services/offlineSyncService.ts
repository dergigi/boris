import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IAccount } from 'applesauce-core/helpers'
import { RELAYS } from '../config/relays'
import { isLocalRelay } from '../utils/helpers'

let isSyncing = false

// Track events created during offline period
const offlineCreatedEvents = new Set<string>()

/**
 * Marks an event as created during offline period
 */
export function markEventAsOfflineCreated(eventId: string): void {
  offlineCreatedEvents.add(eventId)
  console.log(`📝 Marked event ${eventId.slice(0, 8)} as offline-created. Total: ${offlineCreatedEvents.size}`)
}

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
  console.log(`📦 Offline events tracked: ${offlineCreatedEvents.size}`)
  isSyncing = true

  try {
    const localRelays = RELAYS.filter(isLocalRelay)
    const remoteRelays = RELAYS.filter(url => !isLocalRelay(url))

    console.log(`📡 Local relays: ${localRelays.length}, Remote relays: ${remoteRelays.length}`)
    
    if (localRelays.length === 0) {
      console.log('⚠️ No local relays available for sync')
      isSyncing = false
      return
    }
    
    if (remoteRelays.length === 0) {
      console.log('⚠️ No remote relays available for sync')
      isSyncing = false
      return
    }

    // Get events from local relays that were created in the last 24 hours
    const since = Math.floor(Date.now() / 1000) - (24 * 60 * 60)
    const eventsToSync: NostrEvent[] = []

    console.log(`🔍 Querying local relays for events since ${new Date(since * 1000).toISOString()}...`)

    // Query for user's events from local relays
    const filters = [
      { kinds: [9802], authors: [account.pubkey], since }, // Highlights
      { kinds: [10003, 30003], authors: [account.pubkey], since }, // Bookmarks
    ]

    for (const filter of filters) {
      console.log(`🔎 Querying with filter:`, filter)
      const events = await new Promise<NostrEvent[]>((resolve) => {
        const collected: NostrEvent[] = []
        const sub = relayPool.req(localRelays, filter, {
          onevent: (event: NostrEvent) => {
            console.log(`📥 Received event ${event.id.slice(0, 8)} (kind ${event.kind}) from local relay`)
            collected.push(event)
          },
          oneose: () => {
            console.log(`✅ EOSE received, collected ${collected.length} events`)
            sub.close()
            resolve(collected)
          }
        })

        // Timeout after 10 seconds (increased from 5)
        setTimeout(() => {
          console.log(`⏱️ Query timeout, collected ${collected.length} events`)
          sub.close()
          resolve(collected)
        }, 10000)
      })

      eventsToSync.push(...events)
    }

    console.log(`📊 Total events collected: ${eventsToSync.length}`)

    if (eventsToSync.length === 0) {
      console.log('✅ No local events to sync')
      isSyncing = false
      offlineCreatedEvents.clear()
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
    
    // Clear offline events tracking after successful sync
    offlineCreatedEvents.clear()
  } catch (error) {
    console.error('❌ Error during offline sync:', error)
  } finally {
    isSyncing = false
  }
}

