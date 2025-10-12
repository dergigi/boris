import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { prioritizeLocalRelays } from '../utils/helpers'

/**
 * Fetches the contact list (follows) for a specific user
 * @param relayPool - The relay pool to query
 * @param pubkey - The user's public key
 * @returns Set of pubkeys that the user follows
 */
export const fetchContacts = async (
  relayPool: RelayPool,
  pubkey: string
): Promise<Set<string>> => {
  try {
    const relayUrls = prioritizeLocalRelays(Array.from(relayPool.relays.values()).map(relay => relay.url))
    
    console.log('🔍 Fetching contacts (kind 3) for user:', pubkey)
    
    // Local-first quick attempt
    const localRelays = relayUrls.filter(url => url.includes('localhost') || url.includes('127.0.0.1'))
    let events = [] as any[]
    if (localRelays.length > 0) {
      try {
        events = await lastValueFrom(
          relayPool
            .req(localRelays, { kinds: [3], authors: [pubkey] })
            .pipe(completeOnEose(), takeUntil(timer(1200)), toArray())
        )
      } catch {
        events = []
      }
    }
    if (events.length === 0) {
      events = await lastValueFrom(
        relayPool
          .req(relayUrls, { kinds: [3], authors: [pubkey] })
          .pipe(completeOnEose(), takeUntil(timer(6000)), toArray())
      )
    }
    
    console.log('📊 Contact events fetched:', events.length)
    
    if (events.length === 0) {
      return new Set()
    }
    
    // Get the most recent contact list
    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
    const contactList = sortedEvents[0]
    
    // Extract pubkeys from 'p' tags
    const followedPubkeys = new Set<string>()
    for (const tag of contactList.tags) {
      if (tag[0] === 'p' && tag[1]) {
        followedPubkeys.add(tag[1])
      }
    }
    
    console.log('👥 Followed contacts:', followedPubkeys.size)
    
    return followedPubkeys
  } catch (error) {
    console.error('Failed to fetch contacts:', error)
    return new Set()
  }
}
