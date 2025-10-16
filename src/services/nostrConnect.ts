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
    const bunkerRelays = account.signer.relays
    pool.group(bunkerRelays)
    
    // Wait for at least one bunker relay to be connected
    // This ensures signing/decryption requests can be sent
    console.log('[bunker] Waiting for relay connections...', bunkerRelays)
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const connectedRelays = bunkerRelays.filter(url => {
          const relay = pool.relays.get(url)
          return relay?.connected
        })
        
        if (connectedRelays.length > 0) {
          console.log('[bunker] ✅ Connected to', connectedRelays.length, 'bunker relay(s)')
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        console.warn('[bunker] ⚠️  Timeout waiting for relay connections, proceeding anyway')
        resolve()
      }, 5000)
    })
  }
  
  // Open signer subscription if not already listening
  if (!account.signer.listening) {
    console.log('[bunker] Opening signer subscription for NIP-46 responses...')
    await account.signer.open()
    console.log('[bunker] ✅ Signer subscription active, listening for bunker responses')
  } else {
    console.log('[bunker] Signer already listening')
  }
  
  // Mark as connected (bunker remembers permissions from initial connection)
  account.signer.isConnected = true
  console.log('[bunker] Signer marked as connected, ready for signing/decryption')
  
  // Expose nip04/nip44 at account level for compatibility with logging
  // This allows bookmark decryption to work without accessing account.signer
  if (!('nip04' in account)) {
    Object.defineProperty(account, 'nip04', {
      get() { 
        const original = this.signer.nip04
        return {
          encrypt: async (pubkey: string, plaintext: string) => {
            console.log('[bunker] 🔐 nip04.encrypt called', { pubkey: pubkey.slice(0, 8) })
            const result = await original.encrypt(pubkey, plaintext)
            console.log('[bunker] ✅ nip04.encrypt completed')
            return result
          },
          decrypt: async (pubkey: string, ciphertext: string) => {
            console.log('[bunker] 🔓 nip04.decrypt called', { pubkey: pubkey.slice(0, 8), ciphertextLength: ciphertext.length })
            try {
              const result = await original.decrypt(pubkey, ciphertext)
              console.log('[bunker] ✅ nip04.decrypt completed')
              return result
            } catch (err) {
              console.error('[bunker] ❌ nip04.decrypt failed:', err)
              throw err
            }
          }
        }
      },
      enumerable: true,
      configurable: true
    })
  }
  if (!('nip44' in account)) {
    Object.defineProperty(account, 'nip44', {
      get() { 
        const original = this.signer.nip44
        return {
          encrypt: async (pubkey: string, plaintext: string) => {
            console.log('[bunker] 🔐 nip44.encrypt called', { pubkey: pubkey.slice(0, 8) })
            const result = await original.encrypt(pubkey, plaintext)
            console.log('[bunker] ✅ nip44.encrypt completed')
            return result
          },
          decrypt: async (pubkey: string, ciphertext: string) => {
            console.log('[bunker] 🔓 nip44.decrypt called', { pubkey: pubkey.slice(0, 8), ciphertextLength: ciphertext.length })
            try {
              const result = await original.decrypt(pubkey, ciphertext)
              console.log('[bunker] ✅ nip44.decrypt completed', { plaintextLength: result.length })
              return result
            } catch (err) {
              console.error('[bunker] ❌ nip44.decrypt failed:', err)
              throw err
            }
          }
        }
      },
      enumerable: true,
      configurable: true
    })
  }
}

