import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { queryEvents } from './dataFetch'
import { normalizeRelayUrl } from '../utils/helpers'

export interface UserRelayInfo {
  url: string
  mode?: 'read' | 'write' | 'both'
}

/**
 * Loads user's relay list from kind 10002 (NIP-65)
 */
export async function loadUserRelayList(
  relayPool: RelayPool,
  pubkey: string,
  options?: {
    onUpdate?: (relays: UserRelayInfo[]) => void
  }
): Promise<UserRelayInfo[]> {
  try {
    
    
    // Try querying with streaming callback for faster results
    const events: NostrEvent[] = []
    const eventsMap = new Map<string, NostrEvent>()
    
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

          // Stream immediate updates to caller using the newest event
          if (options?.onUpdate) {
            const tags = evt.tags || []
            const relays: UserRelayInfo[] = []
            for (const tag of tags) {
              if (tag[0] === 'r' && tag[1]) {
                const url = tag[1]
                const mode = (tag[2] as 'read' | 'write' | undefined) || 'both'
                relays.push({ url, mode })
              }
            }
            if (relays.length > 0) {
              options.onUpdate(relays)
            }
          }
        }
      }
    })
    
    // Use the streaming results if we got any, otherwise fall back to the full result
    const finalEvents = events.length > 0 ? events : result
    
    // Also try a broader query to see if we get any events at all
    await queryEvents(relayPool, {
      kinds: [10002],
      limit: 5
    })
    
    

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

  // Normalize all URLs for consistent comparison and deduplication
  const normalizedBlocked = new Set(blocked.map(normalizeRelayUrl))
  const normalizedLocal = new Set(alwaysIncludeLocal.map(normalizeRelayUrl))
  
  const relaySet = new Set<string>()
  const normalizedRelaySet = new Set<string>()

  // Helper to check if relay should be included (using normalized URLs)
  const shouldInclude = (normalizedUrl: string): boolean => {
    // Always include local relays
    if (normalizedLocal.has(normalizedUrl)) return true
    // Otherwise check if blocked
    return !normalizedBlocked.has(normalizedUrl)
  }

  // Add hardcoded relays (normalized)
  for (const url of hardcoded) {
    const normalized = normalizeRelayUrl(url)
    if (shouldInclude(normalized) && !normalizedRelaySet.has(normalized)) {
      normalizedRelaySet.add(normalized)
      relaySet.add(url) // Keep original URL for output
    }
  }

  // Add bunker relays (normalized)
  for (const url of bunker) {
    const normalized = normalizeRelayUrl(url)
    if (shouldInclude(normalized) && !normalizedRelaySet.has(normalized)) {
      normalizedRelaySet.add(normalized)
      relaySet.add(url) // Keep original URL for output
    }
  }

  // Add user relays (normalized)
  for (const relay of userList) {
    const normalized = normalizeRelayUrl(relay.url)
    if (shouldInclude(normalized) && !normalizedRelaySet.has(normalized)) {
      normalizedRelaySet.add(normalized)
      relaySet.add(relay.url) // Keep original URL for output
    }
  }

  // Always ensure local relays are present (normalized check)
  for (const url of alwaysIncludeLocal) {
    const normalized = normalizeRelayUrl(url)
    if (!normalizedRelaySet.has(normalized)) {
      normalizedRelaySet.add(normalized)
      relaySet.add(url) // Keep original URL for output
    }
  }

  return Array.from(relaySet)
}

