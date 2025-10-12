/**
 * Nostr gateway URLs for viewing events and profiles on the web
 */

export const NOSTR_GATEWAY = 'https://ants.sh' as const

/**
 * Get a profile URL on the gateway
 */
export function getProfileUrl(npub: string): string {
  return `${NOSTR_GATEWAY}/p/${npub}`
}

/**
 * Get an event URL on the gateway
 */
export function getEventUrl(nevent: string): string {
  return `${NOSTR_GATEWAY}/e/${nevent}`
}

/**
 * Get a general nostr link on the gateway
 */
export function getNostrUrl(identifier: string): string {
  return `${NOSTR_GATEWAY}/${identifier}`
}

