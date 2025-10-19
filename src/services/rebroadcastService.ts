import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { UserSettings } from './settingsService'
import { RELAYS } from '../config/relays'
import { isLocalRelay } from '../utils/helpers'

/**
 * Rebroadcasts events to relays based on user settings
 * @param events Events to rebroadcast
 * @param relayPool The relay pool to use for publishing
 * @param settings User settings to determine which relays to broadcast to
 */
export async function rebroadcastEvents(
  events: NostrEvent[],
  relayPool: RelayPool,
  settings?: UserSettings
): Promise<void> {
  if (!events || events.length === 0) {
    return
  }

  // Check if any rebroadcast is enabled
  const useLocalCache = settings?.useLocalRelayAsCache ?? true
  const broadcastToAll = settings?.rebroadcastToAllRelays ?? false

  if (!useLocalCache && !broadcastToAll) {
    return // No rebroadcast enabled
  }

  // Check current relay connectivity - don't rebroadcast in flight mode
  const connectedRelays = Array.from(relayPool.relays.values())
  const connectedRemoteRelays = connectedRelays.filter(relay => relay.connected && !isLocalRelay(relay.url))
  const hasRemoteConnection = connectedRemoteRelays.length > 0
  
  // If we're in flight mode (only local relays connected) and user wants to broadcast to all relays, skip
  if (broadcastToAll && !hasRemoteConnection) {
    return
  }

  // Determine target relays based on settings
  let targetRelays: string[] = []
  
  if (broadcastToAll) {
    // Broadcast to all relays (only if we have remote connection)
    targetRelays = RELAYS
  } else if (useLocalCache) {
    // Only broadcast to local relays
    targetRelays = RELAYS.filter(isLocalRelay)
  }

  if (targetRelays.length === 0) {
    return
  }

  // Rebroadcast each event
  const rebroadcastPromises = events.map(async (event) => {
    try {
      await relayPool.publish(targetRelays, event)
    } catch (error) {
      console.warn('⚠️ Failed to rebroadcast event', event.id?.slice(0, 8), error)
    }
  })

  // Execute all rebroadcasts (don't block on completion)
  Promise.all(rebroadcastPromises).catch((err) => {
    console.warn('⚠️ Some rebroadcasts failed:', err)
  })

    broadcastToAll,
    useLocalCache,
    targetRelays
  })
}

