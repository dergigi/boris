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
 * Normalizes a relay URL to match what applesauce-relay stores internally
 * Adds trailing slash for URLs without a path
 */
function normalizeRelayUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // If the pathname is empty or just "/", ensure it ends with "/"
    if (parsed.pathname === '' || parsed.pathname === '/') {
      return url.endsWith('/') ? url : url + '/'
    }
    return url
  } catch {
    // If URL parsing fails, return as-is
    return url
  }
}

/**
 * Applies a new relay set to the pool: adds missing relays, removes extras
 */
export function applyRelaySetToPool(
  relayPool: RelayPool,
  finalUrls: string[]
): void {
  // Normalize all URLs to match pool's internal format
  const currentUrls = new Set(Array.from(relayPool.relays.keys()))
  const normalizedTargetUrls = new Set(finalUrls.map(normalizeRelayUrl))

  console.log('[relayManager] applyRelaySetToPool called')
  console.log('[relayManager] Current pool has:', currentUrls.size, 'relays')
  console.log('[relayManager] Target has:', finalUrls.length, 'relays')

  // Add new relays (use original URLs for adding, not normalized)
  const toAdd = finalUrls.filter(url => !currentUrls.has(normalizeRelayUrl(url)))
  console.log('[relayManager] Will add:', toAdd.length, 'relays', toAdd)
  if (toAdd.length > 0) {
    relayPool.group(toAdd)
  }

  // Remove relays not in target (but always keep local relays)
  const toRemove: string[] = []
  for (const url of currentUrls) {
    // Check if this normalized URL is in the target set
    if (!normalizedTargetUrls.has(url)) {
      // Also check if it's a local relay (check both normalized and original forms)
      const isLocal = ALWAYS_LOCAL_RELAYS.some(localUrl => 
        normalizeRelayUrl(localUrl) === url || localUrl === url
      )
      if (!isLocal) {
        toRemove.push(url)
      }
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

