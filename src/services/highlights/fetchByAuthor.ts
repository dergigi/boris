import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { Highlight } from '../../types/highlights'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'
import { UserSettings } from '../settingsService'
import { rebroadcastEvents } from '../rebroadcastService'
import { KINDS } from '../../config/kinds'
import { queryEvents } from '../dataFetch'
import { highlightCache } from './cache'

export const fetchHighlights = async (
  relayPool: RelayPool,
  pubkey: string,
  onHighlight?: (highlight: Highlight) => void,
  settings?: UserSettings,
  force = false,
  eventStore?: IEventStore
): Promise<Highlight[]> => {
  // Check cache first unless force refresh
  if (!force) {
    const cacheKey = highlightCache.authorKey(pubkey)
    const cached = highlightCache.get(cacheKey)
    if (cached) {
      console.log(`📌 Using cached highlights for author (${cached.length} items)`)
      // Stream cached highlights if callback provided
      if (onHighlight) {
        cached.forEach(h => onHighlight(h))
      }
      return cached
    }
  }
  try {
    const seenIds = new Set<string>()
    const rawEvents: NostrEvent[] = await queryEvents(
      relayPool,
      { kinds: [KINDS.Highlights], authors: [pubkey] },
      {
        onEvent: (event: NostrEvent) => {
          if (seenIds.has(event.id)) return
          seenIds.add(event.id)
          
          // Store in event store if provided
          if (eventStore) {
            eventStore.add(event)
          }
          
          if (onHighlight) onHighlight(eventToHighlight(event))
        }
      }
    )

    console.log(`📌 Fetched ${rawEvents.length} highlight events for author:`, pubkey.slice(0, 8))

    // Store all events in event store if provided
    if (eventStore) {
      rawEvents.forEach(evt => eventStore.add(evt))
    }

    try {
      await rebroadcastEvents(rawEvents, relayPool, settings)
    } catch (err) {
      console.warn('Failed to rebroadcast highlight events:', err)
    }

    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights = uniqueEvents.map(eventToHighlight)
    const sorted = sortHighlights(highlights)
    
    // Cache the results
    const cacheKey = highlightCache.authorKey(pubkey)
    highlightCache.set(cacheKey, sorted)
    
    return sorted
  } catch {
    return []
  }
}


