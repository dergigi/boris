import { normalizeRelayUrl } from '../utils/helpers'

/**
 * Centralized relay configuration
 * Single set of relays used throughout the application
 */

export type RelayRole = 'local-cache' | 'default' | 'fallback' | 'non-content' | 'bunker'

export interface RelayConfig {
  url: string
  roles: RelayRole[]
}

/**
 * Central relay registry with role annotations
 */
const RELAY_CONFIGS: RelayConfig[] = [
  { url: 'ws://localhost:10547', roles: ['local-cache'] },
  { url: 'ws://localhost:4869', roles: ['local-cache'] },
  { url: 'wss://relay.nsec.app', roles: ['default', 'non-content'] },
  { url: 'wss://relay.damus.io', roles: ['default', 'fallback'] },
  { url: 'wss://nos.lol', roles: ['default', 'fallback'] },
  { url: 'wss://relay.nostr.band', roles: ['default', 'fallback'] },
  { url: 'wss://wot.dergigi.com', roles: ['default'] },
  { url: 'wss://relay.snort.social', roles: ['default'] },
  { url: 'wss://nostr-pub.wellorder.net', roles: ['default'] },
  { url: 'wss://purplepag.es', roles: ['default'] },
  { url: 'wss://relay.primal.net', roles: ['default', 'fallback'] },
  { url: 'wss://proxy.nostr-relay.app/5d0d38afc49c4b84ca0da951a336affa18438efed302aeedfa92eb8b0d3fcb87', roles: ['default'] },
]

/**
 * Get all local cache relays (localhost relays)
 */
export function getLocalRelays(): string[] {
  return RELAY_CONFIGS
    .filter(config => config.roles.includes('local-cache'))
    .map(config => config.url)
}

/**
 * Get all default relays (main public relays)
 */
export function getDefaultRelays(): string[] {
  return RELAY_CONFIGS
    .filter(config => config.roles.includes('default'))
    .map(config => config.url)
}

/**
 * Get fallback content relays (last resort public relays for content fetching)
 * These are reliable public relays that should be tried when other methods fail
 */
export function getFallbackContentRelays(): string[] {
  return RELAY_CONFIGS
    .filter(config => config.roles.includes('fallback'))
    .map(config => config.url)
}

/**
 * Get relays suitable for content fetching (excludes non-content relays like auth/signer relays)
 */
export function getContentRelays(): string[] {
  return RELAY_CONFIGS
    .filter(config => !config.roles.includes('non-content'))
    .map(config => config.url)
}

/**
 * Get relays that should NOT be used as content hints
 */
export function getNonContentRelays(): string[] {
  return RELAY_CONFIGS
    .filter(config => config.roles.includes('non-content'))
    .map(config => config.url)
}

/**
 * All relays including local relays (backwards compatibility)
 */
export const RELAYS = [
  ...getLocalRelays(),
  ...getDefaultRelays(),
]

/**
 * Relays that should NOT be used as content hints (backwards compatibility)
 */
export const NON_CONTENT_RELAYS = getNonContentRelays()

/**
 * Check if a relay URL is suitable for use as a content hint
 * Returns true for relays that are reasonable for posts/highlights
 */
export function isContentRelay(url: string): boolean {
  const normalized = normalizeRelayUrl(url)
  const nonContentRelays = getNonContentRelays().map(normalizeRelayUrl)
  return !nonContentRelays.includes(normalized)
}

