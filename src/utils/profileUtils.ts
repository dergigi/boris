import { NostrEvent } from 'nostr-tools'
import { getNpubFallbackDisplay } from './nostrUriResolver'

/**
 * Extract display name from a profile event (kind:0) with consistent priority order
 * Priority: name || display_name || nip05 || npub fallback
 * 
 * @param profileEvent The profile event (kind:0) to extract name from
 * @returns Display name string, or empty string if event is invalid
 */
export function extractProfileDisplayName(profileEvent: NostrEvent | null | undefined): string {
  if (!profileEvent || profileEvent.kind !== 0) {
    return ''
  }

  try {
    const profileData = JSON.parse(profileEvent.content || '{}') as { 
      name?: string
      display_name?: string
      nip05?: string
    }
    
    // Consistent priority: name || display_name || nip05
    if (profileData.name) return profileData.name
    if (profileData.display_name) return profileData.display_name
    if (profileData.nip05) return profileData.nip05
    
    // Fallback to npub if no name fields
    return getNpubFallbackDisplay(profileEvent.pubkey)
  } catch (error) {
    // If JSON parsing fails, use npub fallback
    try {
      return getNpubFallbackDisplay(profileEvent.pubkey)
    } catch {
      // If npub encoding also fails, return empty string
      return ''
    }
  }
}

