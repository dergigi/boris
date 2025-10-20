import { RelayPool } from 'applesauce-relay'
import { queryEvents } from './dataFetch'

export interface UserRelayInfo {
  url: string
  mode?: 'read' | 'write' | 'both'
}

/**
 * Loads user's relay list from kind 10002 (NIP-65)
 */
export async function loadUserRelayList(
  relayPool: RelayPool,
  pubkey: string
): Promise<UserRelayInfo[]> {
  try {
    console.log('[relayListService] Loading user relay list for pubkey:', pubkey.slice(0, 16) + '...')
    console.log('[relayListService] Available relays:', Array.from(relayPool.relays.keys()))
    
    console.log('[relayListService] Starting query for kind 10002...')
    const startTime = Date.now()
    
    // Try querying with streaming callback for faster results
    const events: any[] = []
    const eventsMap = new Map<string, any>()
    
    const result = await queryEvents(relayPool, {
      kinds: [10002],
      authors: [pubkey],
      limit: 10
    }, {
      onEvent: (evt) => {
        // Deduplicate by id and keep most recent
        const existing = eventsMap.get(evt.id)
        if (!existing || evt.created_at > existing.created_at) {
          eventsMap.set(evt.id, evt)
          // Update events array with deduplicated events
          events.length = 0
          events.push(...Array.from(eventsMap.values()))
        }
      }
    })
    
    // Use the streaming results if we got any, otherwise fall back to the full result
    const finalEvents = events.length > 0 ? events : result
    
    const queryTime = Date.now() - startTime
    console.log('[relayListService] Query completed in', queryTime, 'ms')
    
    // Also try a broader query to see if we get any events at all
    console.log('[relayListService] Trying broader query for any kind 10002 events...')
    const allEvents = await queryEvents(relayPool, {
      kinds: [10002],
      limit: 5
    })
    console.log('[relayListService] Found', allEvents.length, 'total kind 10002 events from any author')
    

    console.log('[relayListService] Found', finalEvents.length, 'kind 10002 events')
    if (finalEvents.length > 0) {
      console.log('[relayListService] Event details:', finalEvents.map(e => ({ id: e.id, created_at: e.created_at, tags: e.tags.length })))
    }

    if (finalEvents.length === 0) return []

    // Get most recent event
    const sortedEvents = finalEvents.sort((a, b) => b.created_at - a.created_at)
    const relayListEvent = sortedEvents[0]

    const relays: UserRelayInfo[] = []
    for (const tag of relayListEvent.tags) {
      if (tag[0] === 'r' && tag[1]) {
        const url = tag[1]
        const mode = tag[2] as 'read' | 'write' | undefined
        relays.push({
          url,
          mode: mode || 'both'
        })
      }
    }

    console.log('[relayListService] Parsed', relays.length, 'relays from event')
    return relays
  } catch (error) {
    console.error('Failed to load user relay list:', error)
    return []
  }
}

/**
 * Loads blocked relays from kind 10006 (NIP-51 mute list)
 */
export async function loadBlockedRelays(
  relayPool: RelayPool,
  pubkey: string
): Promise<string[]> {
  try {
    const events = await queryEvents(relayPool, {
      kinds: [10006],
      authors: [pubkey]
    })

    if (events.length === 0) return []

    // Get most recent event
    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
    const muteListEvent = sortedEvents[0]

    const blocked: string[] = []
    for (const tag of muteListEvent.tags) {
      if (tag[0] === 'r' && tag[1]) {
        blocked.push(tag[1])
      }
    }

    return blocked
  } catch (error) {
    console.error('Failed to load blocked relays:', error)
    return []
  }
}

/**
 * Computes final relay set by merging inputs and removing blocked relays
 */
export function computeRelaySet(params: {
  hardcoded: string[]
  bunker?: string[]
  userList?: UserRelayInfo[]
  blocked?: string[]
  alwaysIncludeLocal: string[]
}): string[] {
  const {
    hardcoded,
    bunker = [],
    userList = [],
    blocked = [],
    alwaysIncludeLocal
  } = params

  const relaySet = new Set<string>()
  const blockedSet = new Set(blocked)

  // Helper to check if relay should be included
  const shouldInclude = (url: string): boolean => {
    // Always include local relays
    if (alwaysIncludeLocal.includes(url)) return true
    // Otherwise check if blocked
    return !blockedSet.has(url)
  }

  // Add hardcoded relays
  for (const url of hardcoded) {
    if (shouldInclude(url)) relaySet.add(url)
  }

  // Add bunker relays
  for (const url of bunker) {
    if (shouldInclude(url)) relaySet.add(url)
  }

  // Add user relays (treating 'both' and 'read' as applicable for queries)
  for (const relay of userList) {
    if (shouldInclude(relay.url)) relaySet.add(relay.url)
  }

  // Always ensure local relays are present
  for (const url of alwaysIncludeLocal) {
    relaySet.add(url)
  }

  return Array.from(relaySet)
}

