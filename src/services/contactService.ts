import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'

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
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    
    console.log('🔍 Fetching contacts (kind 3) for user:', pubkey)
    
    const events = await lastValueFrom(
      relayPool
        .req(relayUrls, { kinds: [3], authors: [pubkey] })
        .pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
    )
    
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
