import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, tap, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../../types/highlights'
import { RELAYS } from '../../config/relays'
import { prioritizeLocalRelays, partitionRelays } from '../../utils/helpers'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'
import { UserSettings } from '../settingsService'
import { rebroadcastEvents } from '../rebroadcastService'

export const fetchHighlightsForUrl = async (
  relayPool: RelayPool,
  url: string,
  onHighlight?: (highlight: Highlight) => void,
  settings?: UserSettings
): Promise<Highlight[]> => {
  const seenIds = new Set<string>()
  const orderedRelaysUrl = prioritizeLocalRelays(RELAYS)
  const { local: localRelaysUrl, remote: remoteRelaysUrl } = partitionRelays(orderedRelaysUrl)
  
  try {
    const local$ = localRelaysUrl.length > 0
      ? relayPool
          .req(localRelaysUrl, { kinds: [9802], '#r': [url] })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => {
              seenIds.add(event.id)
              if (onHighlight) onHighlight(eventToHighlight(event))
            }),
            completeOnEose(),
            takeUntil(timer(1200))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())
    const remote$ = remoteRelaysUrl.length > 0
      ? relayPool
          .req(remoteRelaysUrl, { kinds: [9802], '#r': [url] })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => {
              seenIds.add(event.id)
              if (onHighlight) onHighlight(eventToHighlight(event))
            }),
            completeOnEose(),
            takeUntil(timer(6000))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())
    const rawEvents: NostrEvent[] = await lastValueFrom(merge(local$, remote$).pipe(toArray()))
    
    console.log(`📌 Fetched ${rawEvents.length} highlight events for URL:`, url)
    
    // Rebroadcast events - but don't let errors here break the highlight display
    try {
      await rebroadcastEvents(rawEvents, relayPool, settings)
    } catch (err) {
      console.warn('Failed to rebroadcast highlight events:', err)
    }
    
    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights: Highlight[] = uniqueEvents.map(eventToHighlight)
    return sortHighlights(highlights)
  } catch (err) {
    console.error('Error fetching highlights for URL:', err)
    // Return highlights that were already streamed via callback
    // Don't return empty array as that would clear already-displayed highlights
    return []
  }
}


