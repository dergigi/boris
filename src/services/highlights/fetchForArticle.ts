import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, tap, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../../types/highlights'
import { RELAYS } from '../../config/relays'
import { prioritizeLocalRelays, partitionRelays } from '../../utils/helpers'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'
import { UserSettings } from '../settingsService'
import { rebroadcastEvents } from '../rebroadcastService'

export const fetchHighlightsForArticle = async (
  relayPool: RelayPool,
  articleCoordinate: string,
  eventId?: string,
  onHighlight?: (highlight: Highlight) => void,
  settings?: UserSettings
): Promise<Highlight[]> => {
  try {
    const seenIds = new Set<string>()
    const processEvent = (event: NostrEvent): Highlight | null => {
      if (seenIds.has(event.id)) return null
      seenIds.add(event.id)
      return eventToHighlight(event)
    }

    const orderedRelays = prioritizeLocalRelays(RELAYS)
    const { local: localRelays } = partitionRelays(orderedRelays)

    let aTagEvents: NostrEvent[] = []
    if (localRelays.length > 0) {
      try {
        aTagEvents = await lastValueFrom(
          relayPool
            .req(localRelays, { kinds: [9802], '#a': [articleCoordinate] })
            .pipe(
              onlyEvents(),
              tap((event: NostrEvent) => {
                const highlight = processEvent(event)
                if (highlight && onHighlight) onHighlight(highlight)
              }),
              completeOnEose(),
              takeUntil(timer(1200)),
              toArray()
            )
        )
      } catch {
        aTagEvents = []
      }
    }

    if (aTagEvents.length === 0) {
      aTagEvents = await lastValueFrom(
        relayPool
          .req(orderedRelays, { kinds: [9802], '#a': [articleCoordinate] })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => {
              const highlight = processEvent(event)
              if (highlight && onHighlight) onHighlight(highlight)
            }),
            completeOnEose(),
            takeUntil(timer(6000)),
            toArray()
          )
      )
    }

    let eTagEvents: NostrEvent[] = []
    if (eventId) {
      if (localRelays.length > 0) {
        try {
          eTagEvents = await lastValueFrom(
            relayPool
              .req(localRelays, { kinds: [9802], '#e': [eventId] })
              .pipe(
                onlyEvents(),
                tap((event: NostrEvent) => {
                  const highlight = processEvent(event)
                  if (highlight && onHighlight) onHighlight(highlight)
                }),
                completeOnEose(),
                takeUntil(timer(1200)),
                toArray()
              )
          )
        } catch {
          eTagEvents = []
        }
      }

      if (eTagEvents.length === 0) {
        eTagEvents = await lastValueFrom(
          relayPool
            .req(orderedRelays, { kinds: [9802], '#e': [eventId] })
            .pipe(
              onlyEvents(),
              tap((event: NostrEvent) => {
                const highlight = processEvent(event)
                if (highlight && onHighlight) onHighlight(highlight)
              }),
              completeOnEose(),
              takeUntil(timer(6000)),
              toArray()
            )
        )
      }
    }

    const rawEvents = [...aTagEvents, ...eTagEvents]
    await rebroadcastEvents(rawEvents, relayPool, settings)
    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights: Highlight[] = uniqueEvents.map(eventToHighlight)
    return sortHighlights(highlights)
  } catch {
    return []
  }
}


