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
  // Temporary: Add some relays from user's relay list to test
  'wss://filter.nostr.wine',
  'wss://nostr.wine',
  'wss://nostr.oxtr.dev',
  'wss://atlas.nostr.land',
  'wss://eden.nostr.land',
  'wss://puravida.nostr.land',
  'wss://premium.primal.net'
]

