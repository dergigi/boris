import { nip19 } from 'nostr-tools'
import type { NostrEvent } from 'nostr-tools'

export function getNpubFallbackDisplay(pubkey: string): string {
  try {
    const npub = nip19.npubEncode(pubkey)
    return `${npub.slice(5, 12)}...`
  } catch {
    return `${pubkey.slice(0, 8)}...`
  }
}

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

    if (profileData.name) return profileData.name
    if (profileData.display_name) return profileData.display_name
    if (profileData.nip05) return profileData.nip05

    return getNpubFallbackDisplay(profileEvent.pubkey)
  } catch {
    try {
      return getNpubFallbackDisplay(profileEvent.pubkey)
    } catch {
      return ''
    }
  }
}


