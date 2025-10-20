import { RelayPool } from 'applesauce-relay'
import { prioritizeLocalRelays } from '../utils/helpers'

/**
 * Local relays that are always included
 */
export const ALWAYS_LOCAL_RELAYS = [
  'ws://localhost:10547',
  'ws://localhost:4869'
]

/**
 * Gets active relay URLs from the relay pool
 */
export function getActiveRelayUrls(relayPool: RelayPool): string[] {
  const urls = Array.from(relayPool.relays.keys())
  return prioritizeLocalRelays(urls)
}

/**
 * Applies a new relay set to the pool: adds missing relays, removes extras
 */
export function applyRelaySetToPool(
  relayPool: RelayPool,
  finalUrls: string[]
): void {
  const currentUrls = new Set(Array.from(relayPool.relays.keys()))
  const targetUrls = new Set(finalUrls)

  // Add new relays
  const toAdd = finalUrls.filter(url => !currentUrls.has(url))
  if (toAdd.length > 0) {
    relayPool.group(toAdd)
  }

  // Remove relays not in target (but always keep local relays)
  const toRemove: string[] = []
  for (const url of currentUrls) {
    if (!targetUrls.has(url) && !ALWAYS_LOCAL_RELAYS.includes(url)) {
      toRemove.push(url)
    }
  }

  for (const url of toRemove) {
    const relay = relayPool.relays.get(url)
    if (relay) {
      relay.close()
      relayPool.relays.delete(url)
    }
  }
}

