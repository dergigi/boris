import { persistEncryptedContent, EncryptedContentCache } from 'applesauce-common/helpers'
import { IEventStoreStreams } from 'applesauce-core/event-store'

const STORAGE_PREFIX = 'boris-encrypted-content:'

/**
 * A localStorage-backed cache for decrypted event content.
 * Implements the EncryptedContentCache interface from applesauce-common.
 *
 * Note: decrypted content is stored as plaintext in localStorage, which
 * persists across browser restarts and is readable by any script on the
 * same origin. The cache is cleared on logout via clearEncryptedContentCache().
 */
const encryptedContentStorage: EncryptedContentCache = {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(STORAGE_PREFIX + key)
    } catch {
      return null
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, value)
    } catch {
      // Storage full or unavailable, ignore
    }
  }
}

/**
 * Start persisting and restoring encrypted content for the given event store.
 * Returns a cleanup function that stops the persistence process.
 */
export function startEncryptedContentCache(eventStore: IEventStoreStreams): () => void {
  return persistEncryptedContent(eventStore, encryptedContentStorage)
}

/**
 * Clear all cached decrypted content from localStorage.
 * Call on logout to avoid leaving plaintext content behind.
 */
export function clearEncryptedContentCache(): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch {
    // localStorage unavailable, nothing to clear
  }
}
