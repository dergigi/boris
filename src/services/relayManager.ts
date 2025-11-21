import { RelayPool } from 'applesauce-relay'
import { prioritizeLocalRelays } from '../utils/helpers'
import { getLocalRelays } from '../config/relays'

/**
 * Local relays that are always included
 */
export const ALWAYS_LOCAL_RELAYS = getLocalRelays()

/**
 * Hardcoded relays that are always included (minimal reliable set)
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
export function normalizeRelayUrl(url: string): string {
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

export interface RelaySetChangeSummary {
  added: string[]
  removed: string[]
}

/**
 * Applies a new relay set to the pool: adds missing relays, removes extras
 * Always preserves local relays even if not in finalUrls
 * @returns Summary of changes for debugging
 */
export function applyRelaySetToPool(
  relayPool: RelayPool,
  finalUrls: string[],
  options?: { preserveAlwaysLocal?: boolean }
): RelaySetChangeSummary {
  const preserveLocal = options?.preserveAlwaysLocal !== false // default true
  
  // Ensure local relays are always included
  const urlsWithLocal = preserveLocal
    ? Array.from(new Set([...finalUrls, ...ALWAYS_LOCAL_RELAYS]))
    : finalUrls
  
  // Normalize all URLs consistently for comparison
  const normalizedCurrent = new Set(
    Array.from(relayPool.relays.keys()).map(normalizeRelayUrl)
  )
  const normalizedTarget = new Set(urlsWithLocal.map(normalizeRelayUrl))
  
  // Map normalized URLs back to original for adding
  const normalizedToOriginal = new Map<string, string>()
  for (const url of urlsWithLocal) {
    normalizedToOriginal.set(normalizeRelayUrl(url), url)
  }
  
  // Find relays to add (not in current pool)
  const toAdd: string[] = []
  for (const normalizedUrl of normalizedTarget) {
    if (!normalizedCurrent.has(normalizedUrl)) {
      const originalUrl = normalizedToOriginal.get(normalizedUrl) || normalizedUrl
      toAdd.push(originalUrl)
    }
  }
  
  // Find relays to remove (not in target, but preserve local relays)
  const normalizedLocal = new Set(ALWAYS_LOCAL_RELAYS.map(normalizeRelayUrl))
  const toRemove: string[] = []
  for (const currentUrl of relayPool.relays.keys()) {
    const normalizedCurrentUrl = normalizeRelayUrl(currentUrl)
    if (!normalizedTarget.has(normalizedCurrentUrl)) {
      // Always preserve local relays
      if (!preserveLocal || !normalizedLocal.has(normalizedCurrentUrl)) {
        toRemove.push(currentUrl)
      }
    }
  }
  
  // Apply changes
  if (toAdd.length > 0) {
    relayPool.group(toAdd)
  }
  
  for (const url of toRemove) {
    const relay = relayPool.relays.get(url)
    if (relay) {
      try {
        relay.close()
      } catch (error) {
        // Suppress errors when closing relays that haven't fully connected yet
      }
      relayPool.relays.delete(url)
    }
  }
  
  // Return summary for debugging (useful for understanding relay churn)
  if (import.meta.env.DEV && (toAdd.length > 0 || toRemove.length > 0)) {
    console.debug('[relay-pool] Changes:', { added: toAdd, removed: toRemove })
  }
  
  return { added: toAdd, removed: toRemove }
}

