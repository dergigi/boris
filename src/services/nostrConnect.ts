import { NostrConnectSigner } from 'applesauce-signers'
import { Accounts } from 'applesauce-accounts'
import { RelayPool } from 'applesauce-relay'

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

/**
 * Reconnect a bunker signer after page load
 * Ensures the signer is listening and connected to the correct relays
 */
export async function reconnectBunkerSigner(
  account: Accounts.NostrConnectAccount<unknown>,
  pool: RelayPool
): Promise<void> {
  // Add bunker relays to pool for signing communication
  if (account.signer.relays) {
    pool.group(account.signer.relays)
  }
  
  // Open signer subscription if not already listening
  if (!account.signer.listening) {
    await account.signer.open()
  }
  
  // Mark as connected (bunker remembers permissions from initial connection)
  account.signer.isConnected = true
  
  // Expose nip04/nip44 at account level for compatibility
  // This allows bookmark decryption to work without accessing account.signer
  if (!('nip04' in account)) {
    Object.defineProperty(account, 'nip04', {
      get() { return this.signer.nip04 },
      enumerable: true,
      configurable: true
    })
  }
  if (!('nip44' in account)) {
    Object.defineProperty(account, 'nip44', {
      get() { return this.signer.nip44 },
      enumerable: true,
      configurable: true
    })
  }
}

