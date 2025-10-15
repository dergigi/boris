import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { UserSettings } from './settingsService'
import { RELAYS } from '../config/relays'
import { isLocalRelay, areAllRelaysLocal } from '../utils/helpers'
import { markEventAsOfflineCreated } from './offlineSyncService'

/**
 * Unified write helper: add event to EventStore, detect connectivity, 
 * mark for offline sync if needed, and publish in background.
 */
export async function publishEvent(
  relayPool: RelayPool,
  eventStore: IEventStore,
  event: NostrEvent,
  settings?: UserSettings
): Promise<void> {
  // Store the event in the local EventStore FIRST for immediate UI display
  eventStore.add(event)
  console.log('💾 Stored event in EventStore:', event.id.slice(0, 8), `(kind ${event.kind})`)

  // Check current connection status - are we online or in flight mode?
  const connectedRelays = Array.from(relayPool.relays.values())
    .filter(relay => relay.connected)
    .map(relay => relay.url)

  const hasRemoteConnection = connectedRelays.some(url => !isLocalRelay(url))

  // Determine which relays we expect to succeed
  const expectedSuccessRelays = hasRemoteConnection
    ? RELAYS
    : RELAYS.filter(isLocalRelay)

  const isLocalOnly = areAllRelaysLocal(expectedSuccessRelays)

  console.log('📍 Event relay status:', {
    targetRelays: RELAYS.length,
    expectedSuccessRelays: expectedSuccessRelays.length,
    isLocalOnly,
    hasRemoteConnection,
    eventId: event.id.slice(0, 8)
  })

  // If we're in local-only mode, mark this event for later sync
  if (isLocalOnly) {
    markEventAsOfflineCreated(event.id)
  }

  // Publish to all configured relays in the background (non-blocking)
  relayPool.publish(RELAYS, event)
    .then(() => {
      console.log('✅ Event published to', RELAYS.length, 'relay(s):', event.id.slice(0, 8))
    })
    .catch((error) => {
      console.warn('⚠️ Failed to publish event to relays (event still saved locally):', error)
    })
}

