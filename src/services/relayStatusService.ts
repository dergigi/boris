import { RelayPool } from 'applesauce-relay'

export interface RelayStatus {
  url: string
  isInPool: boolean
  lastSeen: number // timestamp
}

// How long to show disconnected relays as "recently seen" before hiding them
const RECENT_CONNECTION_WINDOW = 10 * 1000 // 10 seconds

// In-memory tracking of relay last seen times
const relayLastSeen = new Map<string, number>()

/**
 * Updates and gets the current status of all relays
 */
export function updateAndGetRelayStatuses(relayPool: RelayPool): RelayStatus[] {
  const statuses: RelayStatus[] = []
  const now = Date.now()
  const currentlyConnectedUrls = new Set<string>()
  
  // Check all relays in the pool for their actual connection status
  for (const relay of relayPool.relays.values()) {
    const isConnected = relay.connected
    
    if (isConnected) {
      currentlyConnectedUrls.add(relay.url)
      relayLastSeen.set(relay.url, now)
    }
    
    statuses.push({
      url: relay.url,
      isInPool: isConnected,
      lastSeen: isConnected ? now : (relayLastSeen.get(relay.url) || now)
    })
  }
  
  // Debug logging
  const connectedCount = statuses.filter(s => s.isInPool).length
  const disconnectedCount = statuses.filter(s => !s.isInPool).length
  if (connectedCount === 0 || disconnectedCount > 0) {
    const connected = statuses.filter(s => s.isInPool).map(s => s.url.replace(/^wss?:\/\//, ''))
    const disconnected = statuses.filter(s => !s.isInPool).map(s => s.url.replace(/^wss?:\/\//, ''))
  }
  
  // Add recently seen relays that are no longer connected
  const cutoffTime = now - RECENT_CONNECTION_WINDOW
  for (const [url, lastSeen] of relayLastSeen.entries()) {
    if (!currentlyConnectedUrls.has(url) && lastSeen >= cutoffTime) {
      // Check if this relay is already in statuses (might be in pool but not connected)
      const existingStatus = statuses.find(s => s.url === url)
      if (!existingStatus) {
        statuses.push({
          url,
          isInPool: false,
          lastSeen
        })
      }
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

