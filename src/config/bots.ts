import { nip19 } from 'nostr-tools'

/**
 * Hardcoded list of bot pubkeys (hex format) to hide articles from
 * These are accounts known to be bots or automated services
 */
export const BOT_PUBKEYS = new Set([
  // Step Counter Bot (npub14l5xklll5vxzrf6hfkv8m6n2gqevythn5pqc6ezluespah0e8ars4279ss)
  nip19.decode('npub14l5xklll5vxzrf6hfkv8m6n2gqevythn5pqc6ezluespah0e8ars4279ss').data as string,
])

/**
 * Check if a pubkey corresponds to a known bot
 */
export function isKnownBot(pubkey: string): boolean {
  return BOT_PUBKEYS.has(pubkey)
}
