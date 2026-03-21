/**
 * Regex to match nostr: URIs and bare bech32 identifiers.
 * Capture group 1 = the bech32 identifier (without nostr: prefix).
 */
export const nostrLinkPattern = /\b(?:nostr:)?((?:npub1|note1|nevent1|nprofile1|naddr1|nsec1|nrelay1)[a-z0-9]+)\b/gi
