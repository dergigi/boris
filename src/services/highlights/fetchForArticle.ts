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
    const { local: localRelays, remote: remoteRelays } = partitionRelays(orderedRelays)

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

    // Always query remote relays to merge additional highlights
    if (remoteRelays.length > 0) {
      try {
        const aRemote = await lastValueFrom(
          relayPool
            .req(remoteRelays, { kinds: [9802], '#a': [articleCoordinate] })
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
        aTagEvents = aTagEvents.concat(aRemote)
      } catch {
        // ignore
      }
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

      // Always query remote for e-tag too
      if (remoteRelays.length > 0) {
        try {
          const eRemote = await lastValueFrom(
            relayPool
              .req(remoteRelays, { kinds: [9802], '#e': [eventId] })
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
          eTagEvents = eTagEvents.concat(eRemote)
        } catch {
          // ignore
        }
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


