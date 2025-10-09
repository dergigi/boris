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

  // Determine target relays based on settings
  let targetRelays: string[] = []
  
  if (broadcastToAll) {
    // Broadcast to all relays
    targetRelays = RELAYS
  } else if (useLocalCache) {
    // Only broadcast to local relays
    targetRelays = RELAYS.filter(isLocalRelay)
  }

  if (targetRelays.length === 0) {
    console.log('📡 No target relays for rebroadcast')
    return
  }

  // Rebroadcast each event
  const rebroadcastPromises = events.map(async (event) => {
    try {
      await relayPool.publish(targetRelays, event)
      console.log('📡 Rebroadcast event', event.id?.slice(0, 8), 'to', targetRelays.length, 'relay(s)')
    } catch (error) {
      console.warn('⚠️ Failed to rebroadcast event', event.id?.slice(0, 8), error)
    }
  })

  // Execute all rebroadcasts (don't block on completion)
  Promise.all(rebroadcastPromises).catch((err) => {
    console.warn('⚠️ Some rebroadcasts failed:', err)
  })

  console.log(`📡 Rebroadcasting ${events.length} event(s) to ${targetRelays.length} relay(s)`, {
    broadcastToAll,
    useLocalCache,
    targetRelays
  })
}

