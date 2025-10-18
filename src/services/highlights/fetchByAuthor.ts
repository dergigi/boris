import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../../types/highlights'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'
import { UserSettings } from '../settingsService'
import { rebroadcastEvents } from '../rebroadcastService'
import { KINDS } from '../../config/kinds'
import { queryEvents } from '../dataFetch'

export const fetchHighlights = async (
  relayPool: RelayPool,
  pubkey: string,
  onHighlight?: (highlight: Highlight) => void,
  settings?: UserSettings
): Promise<Highlight[]> => {
  try {
    const seenIds = new Set<string>()
    const rawEvents: NostrEvent[] = await queryEvents(
      relayPool,
      { kinds: [KINDS.Highlights], authors: [pubkey] },
      {
        onEvent: (event: NostrEvent) => {
          if (seenIds.has(event.id)) return
          seenIds.add(event.id)
          if (onHighlight) onHighlight(eventToHighlight(event))
        }
      }
    )

    console.log(`📌 Fetched ${rawEvents.length} highlight events for author:`, pubkey.slice(0, 8))

    try {
      await rebroadcastEvents(rawEvents, relayPool, settings)
    } catch (err) {
      console.warn('Failed to rebroadcast highlight events:', err)
    }

    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights = uniqueEvents.map(eventToHighlight)
    return sortHighlights(highlights)
  } catch {
    return []
  }
}


