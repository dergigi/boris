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
  pubkey: string,
  onPartial?: (contacts: Set<string>) => void
): Promise<Set<string>> => {
  try {
    const relayUrls = prioritizeLocalRelays(Array.from(relayPool.relays.values()).map(relay => relay.url))
    
    console.log('🔍 Fetching contacts (kind 3) for user:', pubkey)
    
    // Local-first quick attempt
    const localRelays = relayUrls.filter(url => url.includes('localhost') || url.includes('127.0.0.1'))
    let events: Array<{ created_at: number; tags: string[][] }> = []
    if (localRelays.length > 0) {
      try {
        const localEvents = await lastValueFrom(
          relayPool
            .req(localRelays, { kinds: [3], authors: [pubkey] })
            .pipe(completeOnEose(), takeUntil(timer(1200)), toArray())
        )
        events = localEvents as Array<{ created_at: number; tags: string[][] }>
      } catch {
        events = []
      }
    }
    const followed = new Set<string>()
    if (events.length > 0) {
      // Get the most recent contact list
      const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
      const contactList = sortedEvents[0]
      // Extract pubkeys from 'p' tags
      for (const tag of contactList.tags) {
        if (tag[0] === 'p' && tag[1]) {
          followed.add(tag[1])
        }
      }
      if (onPartial) onPartial(new Set(followed))
    }
    // Always fetch remote to merge more contacts
    const remoteRelays = relayUrls.filter(url => !url.includes('localhost') && !url.includes('127.0.0.1'))
    if (remoteRelays.length > 0) {
      try {
        const remoteEvents = await lastValueFrom(
          relayPool
            .req(remoteRelays, { kinds: [3], authors: [pubkey] })
            .pipe(completeOnEose(), takeUntil(timer(6000)), toArray())
        )
        if (remoteEvents.length > 0) {
          const sortedRemote = (remoteEvents as Array<{ created_at: number; tags: string[][] }>).
            sort((a, b) => b.created_at - a.created_at)
          const contactList = sortedRemote[0]
          for (const tag of contactList.tags) {
            if (tag[0] === 'p' && tag[1]) {
              followed.add(tag[1])
            }
          }
        }
      } catch {
        // ignore
      }
    }
    
    console.log('📊 Contact events fetched:', events.length)
    
    console.log('👥 Followed contacts:', followed.size)
    return followed
  } catch (error) {
    console.error('Failed to fetch contacts:', error)
    return new Set()
  }
}
