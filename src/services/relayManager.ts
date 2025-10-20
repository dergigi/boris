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

  console.log('[relayManager] applyRelaySetToPool called')
  console.log('[relayManager] Current pool has:', currentUrls.size, 'relays')
  console.log('[relayManager] Target has:', finalUrls.length, 'relays')

  // Add new relays
  const toAdd = finalUrls.filter(url => !currentUrls.has(url))
  console.log('[relayManager] Will add:', toAdd.length, 'relays', toAdd)
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
  console.log('[relayManager] Will remove:', toRemove.length, 'relays', toRemove)

  for (const url of toRemove) {
    const relay = relayPool.relays.get(url)
    if (relay) {
      relay.close()
      relayPool.relays.delete(url)
    }
  }
  
  console.log('[relayManager] After apply, pool has:', relayPool.relays.size, 'relays')
}

