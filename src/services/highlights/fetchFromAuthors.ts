import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../../types/highlights'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'
import { queryEvents } from '../dataFetch'

/**
 * Fetches highlights (kind:9802) from a list of pubkeys (friends)
 * @param relayPool - The relay pool to query
 * @param pubkeys - Array of pubkeys to fetch highlights from
 * @param onHighlight - Optional callback for streaming highlights as they arrive
 * @returns Array of highlights
 */
export const fetchHighlightsFromAuthors = async (
  relayPool: RelayPool,
  pubkeys: string[],
  onHighlight?: (highlight: Highlight) => void
): Promise<Highlight[]> => {
  try {
    if (pubkeys.length === 0) {
      console.log('⚠️ No pubkeys to fetch highlights from')
      return []
    }

    console.log('💡 Fetching highlights (kind 9802) from', pubkeys.length, 'authors')

    const seenIds = new Set<string>()
    const rawEvents = await queryEvents(
      relayPool,
      { kinds: [9802], authors: pubkeys, limit: 200 },
      {
        onEvent: (event: NostrEvent) => {
          if (!seenIds.has(event.id)) {
            seenIds.add(event.id)
            if (onHighlight) onHighlight(eventToHighlight(event))
          }
        }
      }
    )

    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights = uniqueEvents.map(eventToHighlight)
    
    console.log('💡 Processed', highlights.length, 'unique highlights')
    
    return sortHighlights(highlights)
  } catch (error) {
    console.error('Failed to fetch highlights from authors:', error)
    return []
  }
}

