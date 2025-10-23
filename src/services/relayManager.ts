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
 * Hardcoded relays that are always included
 */
export const HARDCODED_RELAYS = [
  'wss://relay.nostr.band'
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

  

  // Add new relays (use original URLs for adding, not normalized)
  const toAdd = finalUrls.filter(url => !currentUrls.has(normalizeRelayUrl(url)))
  
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
  

  for (const url of toRemove) {
    const relay = relayPool.relays.get(url)
    if (relay) {
      try {
        // Only close if relay is actually connected or attempting to connect
        // This helps avoid WebSocket warnings for connections that never started
        relay.close()
      } catch (error) {
        // Suppress errors when closing relays that haven't fully connected yet
        // This can happen when switching relay sets before connections establish
        console.debug('[relay-manager] Ignoring error when closing relay:', url, error)
      }
      relayPool.relays.delete(url)
    }
  }
  
  
}

