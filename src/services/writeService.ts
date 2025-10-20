import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { isLocalRelay, areAllRelaysLocal } from '../utils/helpers'
import { markEventAsOfflineCreated } from './offlineSyncService'
import { getActiveRelayUrls } from './relayManager'

/**
 * Unified write helper: add event to EventStore, detect connectivity, 
 * mark for offline sync if needed, and publish in background.
 */
export async function publishEvent(
  relayPool: RelayPool,
  eventStore: IEventStore,
  event: NostrEvent
): Promise<void> {
  const isProgressEvent = event.kind === 39802
  const logPrefix = isProgressEvent ? '[progress]' : ''
  
  // Store the event in the local EventStore FIRST for immediate UI display
  eventStore.add(event)

  // Check current connection status - are we online or in flight mode?
  const connectedRelays = Array.from(relayPool.relays.values())
    .filter(relay => relay.connected)
    .map(relay => relay.url)

  const hasRemoteConnection = connectedRelays.some(url => !isLocalRelay(url))

  // Get active relay URLs from the pool
  const activeRelays = getActiveRelayUrls(relayPool)

  // Determine which relays we expect to succeed
  const expectedSuccessRelays = hasRemoteConnection
    ? activeRelays
    : activeRelays.filter(isLocalRelay)

  const isLocalOnly = areAllRelaysLocal(expectedSuccessRelays)

  // Publishing event

  // If we're in local-only mode, mark this event for later sync
  if (isLocalOnly) {
    markEventAsOfflineCreated(event.id)
  }

  // Publish to all configured relays in the background (non-blocking)
  relayPool.publish(activeRelays, event)
    .then(() => {
    })
    .catch((error) => {
      console.warn(`${logPrefix} ⚠️ Failed to publish event to relays (event still saved locally):`, error)
      
      // Surface common bunker signing errors for debugging
      if (error instanceof Error && error.message.includes('permission')) {
        console.warn('💡 Hint: This may be a bunker permission issue. Ensure your bunker connection has signing permissions.')
      }
    })
}

