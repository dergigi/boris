import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
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
    const events = await queryEvents(relayPool, {
      kinds: [10002],
      authors: [pubkey]
    })

    if (events.length === 0) return []

    // Get most recent event
    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
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

