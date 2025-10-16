import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, tap, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../../types/highlights'
import { prioritizeLocalRelays, partitionRelays } from '../../utils/helpers'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'
import { UserSettings } from '../settingsService'
import { rebroadcastEvents } from '../rebroadcastService'
import { KINDS } from '../../config/kinds'

export const fetchHighlights = async (
  relayPool: RelayPool,
  pubkey: string,
  onHighlight?: (highlight: Highlight) => void,
  settings?: UserSettings
): Promise<Highlight[]> => {
  try {
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    const ordered = prioritizeLocalRelays(relayUrls)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(ordered)

    const seenIds = new Set<string>()
    const local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [KINDS.Highlights], authors: [pubkey] })
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
          .req(remoteRelays, { kinds: [KINDS.Highlights], authors: [pubkey] })
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

    await rebroadcastEvents(rawEvents, relayPool, settings)
    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights = uniqueEvents.map(eventToHighlight)
    return sortHighlights(highlights)
  } catch {
    return []
  }
}


