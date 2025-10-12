import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, toArray } from 'rxjs'
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
    const remoteRelays = relayUrls.filter(url => !url.includes('localhost') && !url.includes('127.0.0.1'))
    const local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [3], authors: [pubkey] })
          .pipe(completeOnEose(), takeUntil(timer(1200)))
      : new Observable<{ created_at: number; tags: string[][] }>((sub) => sub.complete())
    const remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, { kinds: [3], authors: [pubkey] })
          .pipe(completeOnEose(), takeUntil(timer(6000)))
      : new Observable<{ created_at: number; tags: string[][] }>((sub) => sub.complete())
    const events = await lastValueFrom(
      merge(local$, remote$).pipe(toArray())
    )
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
    // merged already via streams
    
    console.log('📊 Contact events fetched:', events.length)
    
    console.log('👥 Followed contacts:', followed.size)
    return followed
  } catch (error) {
    console.error('Failed to fetch contacts:', error)
    return new Set()
  }
}
