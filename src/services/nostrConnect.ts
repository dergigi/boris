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
 * Ensures the signer is listening and ready for signing/decryption
 */
export async function reconnectBunkerSigner(
  account: Accounts.NostrConnectAccount<unknown>,
  pool: RelayPool
): Promise<void> {
  // Add bunker relays to pool
  if (account.signer.relays) {
    pool.group(account.signer.relays)
  }
  
  // Open signer subscription for NIP-46 responses
  if (!account.signer.listening) {
    await account.signer.open()
  }

  // Ensure the signer is connected to the remote signer
  // Important: do NOT set isConnected manually; establish connection properly
  try {
    console.log('[bunker] Connecting to bunker remote...')
    // Re-request permissions on reconnect to ensure decrypt is allowed
    await account.signer.connect(undefined, getDefaultBunkerPermissions())
    console.log('[bunker] ✅ Connected to bunker remote')
  } catch (err) {
    console.error('[bunker] ❌ Failed to connect to bunker remote:', err)
  }
  
  // Expose nip04/nip44 at account level (like ExtensionAccount does)
  if (!('nip04' in account)) {
    (account as any).nip04 = account.signer.nip04
  }
  if (!('nip44' in account)) {
    (account as any).nip44 = account.signer.nip44
  }
}

