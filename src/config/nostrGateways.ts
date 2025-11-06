/**
 * Nostr gateway URLs for viewing events and profiles on the web
 */

export const NOSTR_GATEWAY = 'https://njump.to' as const
export const SEARCH_PORTAL = 'https://ants.sh' as const

/**
 * Get a profile URL on the gateway
 */
export function getProfileUrl(npub: string): string {
  return `${NOSTR_GATEWAY}/${npub}`
}

/**
 * Get an event URL on the gateway
 */
export function getEventUrl(nevent: string): string {
  return `${NOSTR_GATEWAY}/${nevent}`
}

/**
 * Get a general nostr link on the gateway
 * Automatically detects if it's a profile (npub/nprofile) or event (note/nevent/naddr)
 */
export function getNostrUrl(identifier: string): string {
  // njump.to uses simple /{identifier} format for all types
  return `${NOSTR_GATEWAY}/${identifier}`
}

/**
 * Get a search portal URL with a query
 */
export function getSearchUrl(query: string): string {
  return `${SEARCH_PORTAL}/?q=${encodeURIComponent(query)}`
}

