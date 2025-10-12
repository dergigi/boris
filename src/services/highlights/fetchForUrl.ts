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
  try {
    const seenIds = new Set<string>()
    const orderedRelaysUrl = prioritizeLocalRelays(RELAYS)
    const { local: localRelaysUrl, remote: remoteRelaysUrl } = partitionRelays(orderedRelaysUrl)
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
    await rebroadcastEvents(rawEvents, relayPool, settings)
    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights: Highlight[] = uniqueEvents.map(eventToHighlight)
    return sortHighlights(highlights)
  } catch {
    return []
  }
}


