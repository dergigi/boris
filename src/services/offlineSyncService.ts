import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IAccount, IEventStore } from 'applesauce-core'
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
 * Now uses applesauce EventStore instead of querying relays
 */
export async function syncLocalEventsToRemote(
  relayPool: RelayPool,
  account: IAccount,
  eventStore: IEventStore
): Promise<void> {
  if (isSyncing) {
    console.log('⏳ Sync already in progress, skipping...')
    return
  }

  console.log('🔄 Coming back online - syncing local events to remote relays...')
  console.log(`📦 Offline events tracked: ${offlineCreatedEvents.size}`)
  isSyncing = true

  try {
    const remoteRelays = RELAYS.filter(url => !isLocalRelay(url))

    console.log(`📡 Remote relays: ${remoteRelays.length}`)
    
    if (remoteRelays.length === 0) {
      console.log('⚠️ No remote relays available for sync')
      isSyncing = false
      return
    }

    if (offlineCreatedEvents.size === 0) {
      console.log('✅ No offline events to sync')
      isSyncing = false
      return
    }

    // Get events from EventStore using the tracked IDs
    const eventsToSync: NostrEvent[] = []
    console.log(`🔍 Querying EventStore for ${offlineCreatedEvents.size} offline events...`)

    for (const eventId of offlineCreatedEvents) {
      const event = eventStore.getEvent(eventId)
      if (event) {
        console.log(`📥 Found event ${eventId.slice(0, 8)} (kind ${event.kind}) in EventStore`)
        eventsToSync.push(event)
      } else {
        console.warn(`⚠️ Event ${eventId.slice(0, 8)} not found in EventStore`)
      }
    }

    console.log(`📊 Total events to sync: ${eventsToSync.length}`)

    if (eventsToSync.length === 0) {
      console.log('✅ No events found in EventStore to sync')
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

