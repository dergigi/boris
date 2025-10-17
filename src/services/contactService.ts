import { RelayPool } from 'applesauce-relay'
import { prioritizeLocalRelays } from '../utils/helpers'
import { queryEvents } from './dataFetch'

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

    const partialFollowed = new Set<string>()
    const events = await queryEvents(
      relayPool,
      { kinds: [3], authors: [pubkey] },
      {
        relayUrls,
        onEvent: (event: { created_at: number; tags: string[][] }) => {
          // Stream partials as we see any contact list
          for (const tag of event.tags) {
            if (tag[0] === 'p' && tag[1]) {
              partialFollowed.add(tag[1])
            }
          }
          if (onPartial && partialFollowed.size > 0) {
            onPartial(new Set(partialFollowed))
          }
        }
      }
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
