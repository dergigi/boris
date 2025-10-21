import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { createEventLoader } from 'applesauce-loaders/loaders'
import { NostrEvent } from 'nostr-tools'
import { BehaviorSubject, Observable } from 'rxjs'

type EventCallback = (event: NostrEvent) => void
type ErrorCallback = (error: Error) => void

/**
 * Centralized event manager for fetching and caching events
 * Handles deduplication of requests and provides a single source of truth
 */
class EventManager {
  private eventStore: IEventStore | null = null
  private relayPool: RelayPool | null = null
  private eventLoader: ReturnType<typeof createEventLoader> | null = null
  
  // Track pending requests to avoid duplicates
  private pendingRequests = new Map<string, Array<{ onSuccess: EventCallback; onError: ErrorCallback }>>()
  
  // Event stream for real-time updates
  private eventSubject = new BehaviorSubject<NostrEvent | null>(null)
  
  /**
   * Initialize the event manager with event store and relay pool
   */
  setServices(eventStore: IEventStore | null, relayPool: RelayPool | null): void {
    this.eventStore = eventStore
    this.relayPool = relayPool
    
    if (relayPool && this.eventLoader === null) {
      this.eventLoader = createEventLoader(relayPool, {
        eventStore: eventStore || undefined
      })
    }
  }
  
  /**
   * Fetch an event by ID, with automatic deduplication and caching
   */
  async fetchEvent(eventId: string): Promise<NostrEvent> {
    // Check cache first
    if (this.eventStore) {
      const cached = this.eventStore.getEvent(eventId)
      if (cached) {
        return cached
      }
    }
    
    // Return a promise that will be resolved when the event is fetched
    return new Promise((resolve, reject) => {
      this.fetchEventAsync(eventId, resolve, reject)
    })
  }
  
  /**
   * Subscribe to event fetching with callbacks
   */
  private fetchEventAsync(
    eventId: string,
    onSuccess: EventCallback,
    onError: ErrorCallback
  ): void {
    // Check if we're already fetching this event
    if (this.pendingRequests.has(eventId)) {
      // Add to existing request queue
      this.pendingRequests.get(eventId)!.push({ onSuccess, onError })
      return
    }
    
    // Start a new fetch request
    this.pendingRequests.set(eventId, [{ onSuccess, onError }])
    
    // If no relay pool yet, wait for it
    if (!this.relayPool || !this.eventLoader) {
      // Will retry when services are set
      setTimeout(() => {
        // Retry if still no pool
        if (!this.relayPool) {
          this.retryPendingRequest(eventId)
        }
      }, 1000)
      return
    }
    
    const subscription = this.eventLoader({ id: eventId }).subscribe({
      next: (event: NostrEvent) => {
        // Call all pending callbacks
        const callbacks = this.pendingRequests.get(eventId) || []
        this.pendingRequests.delete(eventId)
        
        callbacks.forEach(cb => cb.onSuccess(event))
        
        // Emit to stream
        this.eventSubject.next(event)
        
        subscription.unsubscribe()
      },
      error: (err: unknown) => {
        // Call all pending callbacks with error
        const callbacks = this.pendingRequests.get(eventId) || []
        this.pendingRequests.delete(eventId)
        
        const error = err instanceof Error ? err : new Error(String(err))
        callbacks.forEach(cb => cb.onError(error))
        
        subscription.unsubscribe()
      }
    })
  }
  
  /**
   * Retry pending requests after delay (useful when relay pool becomes available)
   */
  private retryPendingRequest(eventId: string): void {
    const callbacks = this.pendingRequests.get(eventId)
    if (!callbacks) return
    
    // Re-trigger the fetch
    this.pendingRequests.delete(eventId)
    if (callbacks.length > 0) {
      this.fetchEventAsync(eventId, callbacks[0].onSuccess, callbacks[0].onError)
    }
  }
  
  /**
   * Get the event stream for reactive updates
   */
  getEventStream(): Observable<NostrEvent | null> {
    return this.eventSubject.asObservable()
  }
}

// Singleton instance
export const eventManager = new EventManager()
