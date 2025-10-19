import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { Highlight } from '../../types/highlights'
import { KINDS } from '../../config/kinds'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'
import { UserSettings } from '../settingsService'
import { rebroadcastEvents } from '../rebroadcastService'
import { queryEvents } from '../dataFetch'
import { highlightCache } from './cache'

export const fetchHighlightsForArticle = async (
  relayPool: RelayPool,
  articleCoordinate: string,
  eventId?: string,
  onHighlight?: (highlight: Highlight) => void,
  settings?: UserSettings,
  force = false,
  eventStore?: IEventStore
): Promise<Highlight[]> => {
  // Check cache first unless force refresh
  if (!force) {
    const cacheKey = highlightCache.articleKey(articleCoordinate)
    const cached = highlightCache.get(cacheKey)
    if (cached) {
      // Stream cached highlights if callback provided
      if (onHighlight) {
        cached.forEach(h => onHighlight(h))
      }
      return cached
    }
  }
  try {
    const seenIds = new Set<string>()
    const onEvent = (event: NostrEvent) => {
      if (seenIds.has(event.id)) return
      seenIds.add(event.id)
      
      // Store in event store if provided
      if (eventStore) {
        eventStore.add(event)
      }
      
      if (onHighlight) onHighlight(eventToHighlight(event))
    }

    // Query for both #a and #e tags in parallel
    const [aTagEvents, eTagEvents] = await Promise.all([
      queryEvents(relayPool, { kinds: [KINDS.Highlights], '#a': [articleCoordinate] }, { onEvent }),
      eventId
        ? queryEvents(relayPool, { kinds: [KINDS.Highlights], '#e': [eventId] }, { onEvent })
        : Promise.resolve([] as NostrEvent[])
    ])

    const rawEvents = [...aTagEvents, ...eTagEvents]

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
    const highlights: Highlight[] = uniqueEvents.map(eventToHighlight)
    const sorted = sortHighlights(highlights)
    
    // Cache the results
    const cacheKey = highlightCache.articleKey(articleCoordinate)
    highlightCache.set(cacheKey, sorted)
    
    return sorted
  } catch {
    return []
  }
}


