/**
 * Nostr gateway URLs for viewing events and profiles on the web
 */

export const NOSTR_GATEWAY = {
  /** Primary gateway for general nostr content (events, notes, addresses) */
  PRIMARY: 'https://njump.me',
  
  /** Search gateway for profiles and events */
  SEARCH: 'https://search.dergigi.com',
} as const

/**
 * Get a profile URL on the search gateway
 */
export function getProfileUrl(npub: string): string {
  return `${NOSTR_GATEWAY.SEARCH}/p/${npub}`
}

/**
 * Get an event URL on the search gateway
 */
export function getEventUrl(nevent: string): string {
  return `${NOSTR_GATEWAY.SEARCH}/e/${nevent}`
}

/**
 * Get a general nostr link on the primary gateway
 */
export function getNostrUrl(identifier: string): string {
  return `${NOSTR_GATEWAY.PRIMARY}/${identifier}`
}

