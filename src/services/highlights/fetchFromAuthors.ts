import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, tap, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../../types/highlights'
import { prioritizeLocalRelays, partitionRelays } from '../../utils/helpers'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'

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
    
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    const prioritized = prioritizeLocalRelays(relayUrls)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(prioritized)

    const seenIds = new Set<string>()
    
    const local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [9802], authors: pubkeys, limit: 200 })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => {
              if (!seenIds.has(event.id)) {
                seenIds.add(event.id)
                if (onHighlight) onHighlight(eventToHighlight(event))
              }
            }),
            completeOnEose(),
            takeUntil(timer(1200))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())
      
    const remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, { kinds: [9802], authors: pubkeys, limit: 200 })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => {
              if (!seenIds.has(event.id)) {
                seenIds.add(event.id)
                if (onHighlight) onHighlight(eventToHighlight(event))
              }
            }),
            completeOnEose(),
            takeUntil(timer(6000))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())
      
    const rawEvents: NostrEvent[] = await lastValueFrom(merge(local$, remote$).pipe(toArray()))

    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights = uniqueEvents.map(eventToHighlight)
    
    console.log('💡 Processed', highlights.length, 'unique highlights')
    
    return sortHighlights(highlights)
  } catch (error) {
    console.error('Failed to fetch highlights from authors:', error)
    return []
  }
}

