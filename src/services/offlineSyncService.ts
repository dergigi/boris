import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { RELAYS } from '../config/relays'
import { isLocalRelay } from '../utils/helpers'
import { setHighlightMetadata, getHighlightMetadata } from './highlightEventProcessor'

const OFFLINE_EVENTS_KEY = 'offlineCreatedEvents'

let isSyncing = false

/**
 * Load offline events from localStorage
 */
function loadOfflineEventsFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(OFFLINE_EVENTS_KEY)
    if (!raw) return new Set()
    
    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed)
  } catch {
    // Silently fail on parse errors or if storage is unavailable
    return new Set()
  }
}

/**
 * Save offline events to localStorage
 */
function saveOfflineEventsToStorage(events: Set<string>): void {
  try {
    const array = Array.from(events)
    localStorage.setItem(OFFLINE_EVENTS_KEY, JSON.stringify(array))
  } catch {
    // Silently fail if storage is full or unavailable
  }
}

// Track events created during offline period
const offlineCreatedEvents = loadOfflineEventsFromStorage()

// Track events currently being synced
const syncingEvents = new Set<string>()

// Callbacks to notify when sync state changes
const syncStateListeners: Array<(eventId: string, isSyncing: boolean) => void> = []

/**
 * Marks an event as created during offline period
 */
export function markEventAsOfflineCreated(eventId: string): void {
  offlineCreatedEvents.add(eventId)
  saveOfflineEventsToStorage(offlineCreatedEvents)
}

/**
 * Check if an event was created during offline period (flight mode)
 */
export function isEventOfflineCreated(eventId: string): boolean {
  return offlineCreatedEvents.has(eventId)
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
      saveOfflineEventsToStorage(offlineCreatedEvents)
      return
    }

    // Deduplicate events by id
    const uniqueEvents = Array.from(
      new Map(eventsToSync.map(e => [e.id, e])).values()
    )

    // Mark all events as syncing and update metadata
    uniqueEvents.forEach(event => {
      syncingEvents.add(event.id)
      notifySyncStateChange(event.id, true)
      
      // Update metadata cache to reflect syncing state
      const existingMetadata = getHighlightMetadata(event.id)
      setHighlightMetadata(event.id, {
        ...existingMetadata,
        isSyncing: true
      })
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
      
      // Update metadata cache: sync complete, no longer local-only
      const existingMetadata = getHighlightMetadata(eventId)
      setHighlightMetadata(eventId, {
        ...existingMetadata,
        isSyncing: false,
        isLocalOnly: false
      })
    })
    
    // Save updated offline events set to localStorage
    saveOfflineEventsToStorage(offlineCreatedEvents)
    
    // Clear syncing state for failed events
    uniqueEvents.forEach(event => {
      if (!successfulIds.includes(event.id)) {
        syncingEvents.delete(event.id)
        notifySyncStateChange(event.id, false)
        
        // Update metadata cache: sync failed, still local-only
        const existingMetadata = getHighlightMetadata(event.id)
        setHighlightMetadata(event.id, {
          ...existingMetadata,
          isSyncing: false
          // Keep isLocalOnly as true (sync failed)
        })
      }
    })
  } catch (error) {
    // Silently fail
  } finally {
    isSyncing = false
  }
}

