import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../../types/highlights'
import { KINDS } from '../../config/kinds'
import { eventToHighlight, dedupeHighlights, sortHighlights } from '../highlightEventProcessor'
import { UserSettings } from '../settingsService'
import { rebroadcastEvents } from '../rebroadcastService'
import { queryEvents } from '../dataFetch'

export const fetchHighlightsForUrl = async (
  relayPool: RelayPool,
  url: string,
  onHighlight?: (highlight: Highlight) => void,
  settings?: UserSettings
): Promise<Highlight[]> => {
  try {
    const seenIds = new Set<string>()
    const rawEvents: NostrEvent[] = await queryEvents(
      relayPool,
      { kinds: [KINDS.Highlights], '#r': [url] },
      {
        onEvent: (event: NostrEvent) => {
          if (seenIds.has(event.id)) return
          seenIds.add(event.id)
          if (onHighlight) onHighlight(eventToHighlight(event))
        }
      }
    )

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
    return []
  }
}


