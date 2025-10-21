import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { createEventLoader } from 'applesauce-loaders/loaders'
import { NostrEvent } from 'nostr-tools'
import { Observable } from 'rxjs'

/**
 * Centralized event manager for event fetching coordination
 * Manages initialization and provides utilities for event loading
 */
class EventManager {
  private eventStore: IEventStore | null = null
  private relayPool: RelayPool | null = null
  private eventLoader: ReturnType<typeof createEventLoader> | null = null
  
  /**
   * Initialize the event manager with event store and relay pool
   */
  setServices(eventStore: IEventStore | null, relayPool: RelayPool | null): void {
    this.eventStore = eventStore
    this.relayPool = relayPool
    
    // Recreate loader when services change
    if (relayPool) {
      this.eventLoader = createEventLoader(relayPool, {
        eventStore: eventStore || undefined
      })
    }
  }
  
  /**
   * Get the event loader for fetching events
   */
  getEventLoader(): ReturnType<typeof createEventLoader> | null {
    return this.eventLoader
  }
  
  /**
   * Get the event store
   */
  getEventStore(): IEventStore | null {
    return this.eventStore
  }
  
  /**
   * Get the relay pool
   */
  getRelayPool(): RelayPool | null {
    return this.relayPool
  }
  
  /**
   * Check if event exists in store and return it if available
   */
  getCachedEvent(eventId: string): NostrEvent | null {
    if (!this.eventStore) return null
    return this.eventStore.getEvent(eventId) || null
  }
  
  /**
   * Fetch event by ID, returning an observable
   */
  fetchEvent(eventId: string): Observable<NostrEvent> | null {
    if (!this.eventLoader) return null
    return this.eventLoader({ id: eventId })
  }
}

// Singleton instance
export const eventManager = new EventManager()
