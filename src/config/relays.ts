/**
 * Centralized relay configuration
 * All relay URLs used throughout the application
 */

// Local relay URL (hardcoded for development)
export const LOCAL_RELAY = 'ws://localhost:7777'

// Public relays for general use
export const PUBLIC_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.dergigi.com',
  'wss://wot.dergigi.com',
  'wss://relay.snort.social',
  'wss://relay.current.fyi',
  'wss://nostr-pub.wellorder.net'
]

// Relays for profile lookups
export const PROFILE_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.primal.net',
  'wss://relay.nostr.band'
]

// Relays for highlights (read and write)
export const HIGHLIGHT_RELAYS = [
  LOCAL_RELAY,
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://purplepag.es'
]

// Relays for articles
export const ARTICLE_RELAYS = [
  LOCAL_RELAY,
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net'
]

// Relays for settings (read and write)
export const SETTINGS_RELAYS = [
  LOCAL_RELAY,
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.dergigi.com',
  'wss://wot.dergigi.com'
]

// All relays including local (for general operations and relay pool initialization)
export const ALL_RELAYS = [LOCAL_RELAY, ...PUBLIC_RELAYS]

// All write relays (where we publish events)
export const WRITE_RELAYS = [
  LOCAL_RELAY,
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://purplepag.es',
  'wss://relay.dergigi.com'
]

