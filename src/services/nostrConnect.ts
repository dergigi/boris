import { NostrConnectSigner } from 'applesauce-signers'

/**
 * Get default NIP-46 permissions for bunker connections
 * These permissions cover all event kinds and encryption/decryption operations Boris needs
 */
export function getDefaultBunkerPermissions(): string[] {
  return [
    // Signing permissions for event kinds we create
    ...NostrConnectSigner.buildSigningPermissions([
      0,      // Profile metadata
      5,      // Event deletion
      7,      // Reactions (nostr events)
      17,     // Reactions (websites)
      9802,   // Highlights
      30078,  // Settings & reading positions
      39701,  // Web bookmarks
    ]),
    // Encryption/decryption for hidden content
    'nip04_encrypt',
    'nip04_decrypt',
    'nip44_encrypt',
    'nip44_decrypt',
  ]
}

