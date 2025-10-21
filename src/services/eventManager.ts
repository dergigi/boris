import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { createEventLoader } from 'applesauce-loaders/loaders'
import { NostrEvent } from 'nostr-tools'

type PendingRequest = {
  resolve: (event: NostrEvent) => void
  reject: (error: Error) => void
}

/**
 * Centralized event manager for event fetching and caching
 * Handles deduplication of concurrent requests and coordinate with relay pool
 */
class EventManager {
  private eventStore: IEventStore | null = null
  private relayPool: RelayPool | null = null
  private eventLoader: ReturnType<typeof createEventLoader> | null = null
  
  // Track pending requests to deduplicate and resolve all at once
  private pendingRequests = new Map<string, PendingRequest[]>()
  
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
      
      // Retry any pending requests now that we have a loader
      this.retryAllPending()
    }
  }
  
  /**
   * Get cached event from event store
   */
  getCachedEvent(eventId: string): NostrEvent | null {
    if (!this.eventStore) return null
    return this.eventStore.getEvent(eventId) || null
  }
  
  /**
   * Fetch an event by ID, returning a promise
   * Automatically deduplicates concurrent requests for the same event
   */
  fetchEvent(eventId: string): Promise<NostrEvent> {
    // Check cache first
    const cached = this.getCachedEvent(eventId)
    if (cached) {
      return Promise.resolve(cached)
    }
    
    return new Promise<NostrEvent>((resolve, reject) => {
      // Check if we're already fetching this event
      if (this.pendingRequests.has(eventId)) {
        // Add to existing request queue
        this.pendingRequests.get(eventId)!.push({ resolve, reject })
        return
      }
      
      // Start a new fetch request
      this.pendingRequests.set(eventId, [{ resolve, reject }])
      this.fetchFromRelay(eventId)
    })
  }
  
  /**
   * Actually fetch the event from relay
   */
  private fetchFromRelay(eventId: string): void {
    // If no loader yet, schedule retry
    if (!this.relayPool || !this.eventLoader) {
      setTimeout(() => {
        if (this.eventLoader && this.pendingRequests.has(eventId)) {
          this.fetchFromRelay(eventId)
        }
      }, 500)
      return
    }
    
    const subscription = this.eventLoader({ id: eventId }).subscribe({
      next: (event: NostrEvent) => {
        // Resolve all pending requests
        const requests = this.pendingRequests.get(eventId) || []
        this.pendingRequests.delete(eventId)
        
        requests.forEach(req => req.resolve(event))
        subscription.unsubscribe()
      },
      error: (err: unknown) => {
        // Reject all pending requests
        const requests = this.pendingRequests.get(eventId) || []
        this.pendingRequests.delete(eventId)
        
        const error = err instanceof Error ? err : new Error(String(err))
        requests.forEach(req => req.reject(error))
        subscription.unsubscribe()
      }
    })
  }
  
  /**
   * Retry all pending requests after relay pool becomes available
   */
  private retryAllPending(): void {
    const pendingIds = Array.from(this.pendingRequests.keys())
    pendingIds.forEach(eventId => {
      this.fetchFromRelay(eventId)
    })
  }
}

// Singleton instance
export const eventManager = new EventManager()
