import { persistEncryptedContent, EncryptedContentCache } from 'applesauce-common/helpers'
import { IEventStoreStreams } from 'applesauce-core/event-store'

const STORAGE_PREFIX = 'boris-encrypted-content:'

/**
 * A localStorage-backed cache for decrypted event content.
 * Implements the EncryptedContentCache interface from applesauce-common.
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
