import { RelayPool } from 'applesauce-relay'
import { fetchContacts } from './contactService'

type ContactsCallback = (contacts: Set<string>) => void
type LoadingCallback = (loading: boolean) => void

/**
 * Shared contacts/friends controller
 * Manages the user's follow list centrally, similar to bookmarkController
 */
class ContactsController {
  private contactsListeners: ContactsCallback[] = []
  private loadingListeners: LoadingCallback[] = []
  
  private currentContacts: Set<string> = new Set()
  private lastLoadedPubkey: string | null = null

  onContacts(cb: ContactsCallback): () => void {
    this.contactsListeners.push(cb)
    return () => {
      this.contactsListeners = this.contactsListeners.filter(l => l !== cb)
    }
  }

  onLoading(cb: LoadingCallback): () => void {
    this.loadingListeners.push(cb)
    return () => {
      this.loadingListeners = this.loadingListeners.filter(l => l !== cb)
    }
  }

  private setLoading(loading: boolean): void {
    this.loadingListeners.forEach(cb => cb(loading))
  }

  private emitContacts(contacts: Set<string>): void {
    this.contactsListeners.forEach(cb => cb(contacts))
  }

  /**
   * Get current contacts without triggering a reload
   */
  getContacts(): Set<string> {
    return new Set(this.currentContacts)
  }

  /**
   * Check if contacts are loaded for a specific pubkey
   */
  isLoadedFor(pubkey: string): boolean {
    return this.lastLoadedPubkey === pubkey && this.currentContacts.size > 0
  }

  /**
   * Reset state (for logout or manual refresh)
   */
  reset(): void {
    this.currentContacts.clear()
    this.lastLoadedPubkey = null
    this.emitContacts(this.currentContacts)
  }

  /**
   * Load contacts for a user
   * Streams partial results and caches the final list
   */
  async start(options: {
    relayPool: RelayPool
    pubkey: string
    force?: boolean
  }): Promise<void> {
    const { relayPool, pubkey, force = false } = options

    // Skip if already loaded for this pubkey (unless forced)
    if (!force && this.isLoadedFor(pubkey)) {
      this.emitContacts(this.currentContacts)
      return
    }

    this.setLoading(true)

    try {
      const contacts = await fetchContacts(
        relayPool,
        pubkey,
        (partial) => {
          // Stream partial updates
          this.currentContacts = new Set(partial)
          this.emitContacts(this.currentContacts)
        }
      )

      // Store final result
      this.currentContacts = new Set(contacts)
      this.lastLoadedPubkey = pubkey
      this.emitContacts(this.currentContacts)
      
    } catch (error) {
      console.error('[contacts] ❌ Failed to load contacts:', error)
      this.currentContacts.clear()
      this.emitContacts(this.currentContacts)
    } finally {
      this.setLoading(false)
    }
  }
}

// Singleton instance
export const contactsController = new ContactsController()

