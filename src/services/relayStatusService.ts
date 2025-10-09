import { RelayPool } from 'applesauce-relay'

export interface RelayStatus {
  url: string
  isInPool: boolean
  lastSeen: number // timestamp
}

const RECENT_CONNECTION_WINDOW = 20 * 60 * 1000 // 20 minutes

// In-memory tracking of relay last seen times
const relayLastSeen = new Map<string, number>()

/**
 * Updates and gets the current status of all relays
 */
export function updateAndGetRelayStatuses(relayPool: RelayPool): RelayStatus[] {
  const statuses: RelayStatus[] = []
  const now = Date.now()
  const currentRelayUrls = new Set<string>()
  
  // Update relays currently in the pool
  for (const relay of relayPool.relays.values()) {
    currentRelayUrls.add(relay.url)
    relayLastSeen.set(relay.url, now)
    
    statuses.push({
      url: relay.url,
      isInPool: true,
      lastSeen: now
    })
  }
  
  // Add recently seen relays that are no longer in the pool
  const cutoffTime = now - RECENT_CONNECTION_WINDOW
  for (const [url, lastSeen] of relayLastSeen.entries()) {
    if (!currentRelayUrls.has(url) && lastSeen >= cutoffTime) {
      statuses.push({
        url,
        isInPool: false,
        lastSeen
      })
    }
  }
  
  // Clean up old entries
  for (const [url, lastSeen] of relayLastSeen.entries()) {
    if (lastSeen < cutoffTime) {
      relayLastSeen.delete(url)
    }
  }
  
  return statuses.sort((a, b) => {
    if (a.isInPool !== b.isInPool) return a.isInPool ? -1 : 1
    return b.lastSeen - a.lastSeen
  })
}

/**
 * Gets count of currently active relays
 */
export function getActiveCount(statuses: RelayStatus[]): number {
  return statuses.filter(r => r.isInPool).length
}

