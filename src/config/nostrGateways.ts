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
 * Automatically detects if it's a profile (npub/nprofile) or event (note/nevent/naddr)
 */
export function getNostrUrl(identifier: string): string {
  // Check the prefix to determine if it's a profile or event
  if (identifier.startsWith('npub') || identifier.startsWith('nprofile')) {
    return `${NOSTR_GATEWAY}/p/${identifier}`
  }
  
  // Everything else (note, nevent, naddr) goes to /e/
  return `${NOSTR_GATEWAY}/e/${identifier}`
}

