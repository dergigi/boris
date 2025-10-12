import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, tap, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../../types/highlights'
import { prioritizeLocalRelays, partitionRelays } from '../../utils/helpers'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'
import { UserSettings } from '../settingsService'
import { rebroadcastEvents } from '../rebroadcastService'

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
    let rawEvents: NostrEvent[] = []
    if (localRelays.length > 0) {
      try {
        rawEvents = await lastValueFrom(
          relayPool
            .req(localRelays, { kinds: [9802], authors: [pubkey] })
            .pipe(
              onlyEvents(),
              tap((event: NostrEvent) => {
                if (!seenIds.has(event.id)) {
                  seenIds.add(event.id)
                  if (onHighlight) onHighlight(eventToHighlight(event))
                }
              }),
              completeOnEose(),
              takeUntil(timer(1200)),
              toArray()
            )
        )
      } catch {
        rawEvents = []
      }
    }
    if (remoteRelays.length > 0) {
      try {
        const remoteEvents = await lastValueFrom(
          relayPool
            .req(remoteRelays, { kinds: [9802], authors: [pubkey] })
            .pipe(
              onlyEvents(),
              tap((event: NostrEvent) => {
                if (!seenIds.has(event.id)) {
                  seenIds.add(event.id)
                  if (onHighlight) onHighlight(eventToHighlight(event))
                }
              }),
              completeOnEose(),
              takeUntil(timer(6000)),
              toArray()
            )
        )
        rawEvents = rawEvents.concat(remoteEvents)
      } catch {
        // ignore
      }
    }

    await rebroadcastEvents(rawEvents, relayPool, settings)
    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights = uniqueEvents.map(eventToHighlight)
    return sortHighlights(highlights)
  } catch {
    return []
  }
}


