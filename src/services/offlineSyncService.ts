import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { RELAYS } from '../config/relays'
import { isLocalRelay } from '../utils/helpers'

let isSyncing = false

// Track events created during offline period
const offlineCreatedEvents = new Set<string>()

// Track events currently being synced
const syncingEvents = new Set<string>()

// Callbacks to notify when sync state changes
const syncStateListeners: Array<(eventId: string, isSyncing: boolean) => void> = []

/**
 * Marks an event as created during offline period
 */
export function markEventAsOfflineCreated(eventId: string): void {
  offlineCreatedEvents.add(eventId)
}

/**
 * Check if an event is currently being synced
 */
export function isEventSyncing(eventId: string): boolean {
  return syncingEvents.has(eventId)
}

/**
 * Subscribe to sync state changes
 */
export function onSyncStateChange(callback: (eventId: string, isSyncing: boolean) => void): () => void {
  syncStateListeners.push(callback)
  return () => {
    const index = syncStateListeners.indexOf(callback)
    if (index > -1) syncStateListeners.splice(index, 1)
  }
}

/**
 * Notify listeners of sync state change
 */
function notifySyncStateChange(eventId: string, isSyncing: boolean): void {
  syncStateListeners.forEach(listener => listener(eventId, isSyncing))
}

/**
 * Syncs local-only events to remote relays when coming back online
 * Now uses applesauce EventStore instead of querying relays
 */
export async function syncLocalEventsToRemote(
  relayPool: RelayPool,
  eventStore: IEventStore
): Promise<void> {
  if (isSyncing) {
    return
  }

  isSyncing = true

  try {
    const remoteRelays = RELAYS.filter(url => !isLocalRelay(url))

    if (remoteRelays.length === 0) {
      isSyncing = false
      return
    }

    if (offlineCreatedEvents.size === 0) {
      isSyncing = false
      return
    }

    // Get events from EventStore using the tracked IDs
    const eventsToSync: NostrEvent[] = []

    for (const eventId of offlineCreatedEvents) {
      const event = eventStore.getEvent(eventId)
      if (event) {
        eventsToSync.push(event)
      }
    }

    if (eventsToSync.length === 0) {
      isSyncing = false
      offlineCreatedEvents.clear()
      return
    }

    // Deduplicate events by id
    const uniqueEvents = Array.from(
      new Map(eventsToSync.map(e => [e.id, e])).values()
    )

    // Mark all events as syncing
    uniqueEvents.forEach(event => {
      syncingEvents.add(event.id)
      notifySyncStateChange(event.id, true)
    })

    // Publish to remote relays
    const successfulIds: string[] = []
    
    for (const event of uniqueEvents) {
      try {
        await relayPool.publish(remoteRelays, event)
        successfulIds.push(event.id)
      } catch (error) {
        // Silently fail for individual events
      }
    }
    
    // Clear syncing state and offline tracking for successful events
    successfulIds.forEach(eventId => {
      syncingEvents.delete(eventId)
      offlineCreatedEvents.delete(eventId)
      notifySyncStateChange(eventId, false)
    })
    
    // Clear syncing state for failed events
    uniqueEvents.forEach(event => {
      if (!successfulIds.includes(event.id)) {
        syncingEvents.delete(event.id)
        notifySyncStateChange(event.id, false)
      }
    })
  } catch (error) {
    // Silently fail
  } finally {
    isSyncing = false
  }
}

