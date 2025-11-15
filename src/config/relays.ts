/**
 * Centralized relay configuration
 * Single set of relays used throughout the application
 */

// All relays including local relays
export const RELAYS = [
  'ws://localhost:10547',
  'ws://localhost:4869',
  'wss://relay.nsec.app',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://wot.dergigi.com',
  'wss://relay.snort.social',
  'wss://nostr-pub.wellorder.net',
  'wss://purplepag.es',
  'wss://relay.primal.net',
  'wss://proxy.nostr-relay.app/5d0d38afc49c4b84ca0da951a336affa18438efed302aeedfa92eb8b0d3fcb87',
]

/**
 * Relays that should NOT be used as content hints (auth/signer, etc.)
 * These relays are fine for connection and other purposes, but shouldn't
 * be suggested as places where posts/highlights are likely to be found.
 */
export const NON_CONTENT_RELAYS = [
  'wss://relay.nsec.app',
]

/**
 * Check if a relay URL is suitable for use as a content hint
 * Returns true for remote relays that are reasonable for posts/highlights
 */
export function isContentRelay(url: string): boolean {
  return !NON_CONTENT_RELAYS.includes(url)
}

