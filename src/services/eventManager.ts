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
  
  // Safety timeout for event fetches (ms)
  private fetchTimeoutMs = 12000
  // Retry policy
  private maxAttempts = 4
  private baseBackoffMs = 700
  
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
      this.fetchFromRelayWithRetry(eventId, 1)
    })
  }
  
  private resolvePending(eventId: string, event: NostrEvent): void {
    const requests = this.pendingRequests.get(eventId) || []
    this.pendingRequests.delete(eventId)
    requests.forEach(req => req.resolve(event))
  }
  
  private rejectPending(eventId: string, error: Error): void {
    const requests = this.pendingRequests.get(eventId) || []
    this.pendingRequests.delete(eventId)
    requests.forEach(req => req.reject(error))
  }
  
  private fetchFromRelayWithRetry(eventId: string, attempt: number): void {
    // If no loader yet, schedule retry
    if (!this.relayPool || !this.eventLoader) {
      setTimeout(() => {
        if (this.pendingRequests.has(eventId)) {
          this.fetchFromRelayWithRetry(eventId, attempt)
        }
      }, this.baseBackoffMs)
      return
    }
    
    let delivered = false
    const subscription = this.eventLoader({ id: eventId }).subscribe({
      next: (event: NostrEvent) => {
        delivered = true
        clearTimeout(timeoutId)
        this.resolvePending(eventId, event)
        subscription.unsubscribe()
      },
      error: (err: unknown) => {
        clearTimeout(timeoutId)
        const error = err instanceof Error ? err : new Error(String(err))
        // Retry on error until attempts exhausted
        if (attempt < this.maxAttempts && this.pendingRequests.has(eventId)) {
          setTimeout(() => this.fetchFromRelayWithRetry(eventId, attempt + 1), this.baseBackoffMs * attempt)
        } else {
          this.rejectPending(eventId, error)
        }
        subscription.unsubscribe()
      },
      complete: () => {
        // Completed without next - consider not found, but retry a few times
        if (!delivered) {
          clearTimeout(timeoutId)
          if (attempt < this.maxAttempts && this.pendingRequests.has(eventId)) {
            setTimeout(() => this.fetchFromRelayWithRetry(eventId, attempt + 1), this.baseBackoffMs * attempt)
          } else {
            this.rejectPending(eventId, new Error('Event not found'))
          }
        }
        subscription.unsubscribe()
      }
    })
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      if (!delivered) {
        if (attempt < this.maxAttempts && this.pendingRequests.has(eventId)) {
          subscription.unsubscribe()
          this.fetchFromRelayWithRetry(eventId, attempt + 1)
        } else {
          subscription.unsubscribe()
          this.rejectPending(eventId, new Error('Timed out fetching event'))
        }
      }
    }, this.fetchTimeoutMs)
  }
  
  /**
   * Retry all pending requests after relay pool becomes available
   */
  private retryAllPending(): void {
    const pendingIds = Array.from(this.pendingRequests.keys())
    pendingIds.forEach(eventId => {
      this.fetchFromRelayWithRetry(eventId, 1)
    })
  }
}

// Singleton instance
export const eventManager = new EventManager()
