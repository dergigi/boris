import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, tap, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../types/highlights'
import { RELAYS } from '../config/relays'
import { prioritizeLocalRelays, partitionRelays } from '../utils/helpers'
import { eventToHighlight, dedupeHighlights, sortHighlights } from './highlightEventProcessor'
import { UserSettings } from './settingsService'
import { rebroadcastEvents } from './rebroadcastService'

/**
 * Fetches highlights for a specific article by its address coordinate and/or event ID
 * @param relayPool - The relay pool to query
 * @param articleCoordinate - The article's address in format "kind:pubkey:identifier" (e.g., "30023:abc...def:my-article")
 * @param eventId - Optional event ID to also query by 'e' tag
 * @param onHighlight - Optional callback to receive highlights as they arrive
 * @param settings - User settings for rebroadcast options
 */
export const fetchHighlightsForArticle = async (
  relayPool: RelayPool,
  articleCoordinate: string,
  eventId?: string,
  onHighlight?: (highlight: Highlight) => void,
  settings?: UserSettings
): Promise<Highlight[]> => {
  try {
    console.log('🔍 Fetching highlights (kind 9802) for article:', articleCoordinate)
    console.log('🔍 Event ID:', eventId || 'none')
    console.log('🔍 From relays (including local):', RELAYS)
    
    const seenIds = new Set<string>()
    const processEvent = (event: NostrEvent): Highlight | null => {
      if (seenIds.has(event.id)) return null
      seenIds.add(event.id)
      return eventToHighlight(event)
    }
    
    // Local-first relay ordering
    const orderedRelays = prioritizeLocalRelays(RELAYS)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(orderedRelays)

    // Query for highlights that reference this article via the 'a' tag
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
                if (highlight && onHighlight) {
                  onHighlight(highlight)
                }
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
              if (highlight && onHighlight) {
                onHighlight(highlight)
              }
            }),
            completeOnEose(),
            takeUntil(timer(6000)),
            toArray()
          )
      )
    }
    
    console.log('📊 Highlights via a-tag:', aTagEvents.length)
    
    // If we have an event ID, also query for highlights that reference via the 'e' tag
    let eTagEvents: NostrEvent[] = []
    if (eventId) {
      // e-tag query local-first as well
      if (localRelays.length > 0) {
        try {
          eTagEvents = await lastValueFrom(
            relayPool
              .req(localRelays, { kinds: [9802], '#e': [eventId] })
              .pipe(
                onlyEvents(),
                tap((event: NostrEvent) => {
                  const highlight = processEvent(event)
                  if (highlight && onHighlight) {
                    onHighlight(highlight)
                  }
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
                if (highlight && onHighlight) {
                  onHighlight(highlight)
                }
              }),
              completeOnEose(),
              takeUntil(timer(6000)),
              toArray()
            )
        )
      }
      console.log('📊 Highlights via e-tag:', eTagEvents.length)
    }
    
    // Combine results from both queries
    const rawEvents = [...aTagEvents, ...eTagEvents]
    console.log('📊 Total raw highlight events fetched:', rawEvents.length)
    
    // Rebroadcast highlight events to local/all relays based on settings
    await rebroadcastEvents(rawEvents, relayPool, settings)
    
    if (rawEvents.length > 0) {
      console.log('📄 Sample highlight tags:', JSON.stringify(rawEvents[0].tags, null, 2))
    } else {
      console.log('❌ No highlights found. Article coordinate:', articleCoordinate)
      console.log('❌ Event ID:', eventId || 'none')
      console.log('💡 Try checking if there are any highlights on this article at https://highlighter.com')
    }
    
    // Deduplicate events by ID
    const uniqueEvents = dedupeHighlights(rawEvents)
    console.log('📊 Unique highlight events after deduplication:', uniqueEvents.length)
    
    const highlights: Highlight[] = uniqueEvents.map(eventToHighlight)
    return sortHighlights(highlights)
  } catch (error) {
    console.error('Failed to fetch highlights for article:', error)
    return []
  }
}

/**
 * Fetches highlights for a specific URL
 * @param relayPool - The relay pool to query
 * @param url - The external URL to find highlights for
 * @param settings - User settings for rebroadcast options
 */
export const fetchHighlightsForUrl = async (
  relayPool: RelayPool,
  url: string,
  settings?: UserSettings
): Promise<Highlight[]> => {
  try {
    console.log('🔍 Fetching highlights (kind 9802) for URL:', url)
    
    const seenIds = new Set<string>()
    const orderedRelaysUrl = prioritizeLocalRelays(RELAYS)
    const { local: localRelaysUrl } = partitionRelays(orderedRelaysUrl)
    let rawEvents: NostrEvent[] = []
    if (localRelaysUrl.length > 0) {
      try {
        rawEvents = await lastValueFrom(
          relayPool
            .req(localRelaysUrl, { kinds: [9802], '#r': [url] })
            .pipe(
              onlyEvents(),
              tap((event: NostrEvent) => {
                seenIds.add(event.id)
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
    if (rawEvents.length === 0) {
      rawEvents = await lastValueFrom(
        relayPool
          .req(orderedRelaysUrl, { kinds: [9802], '#r': [url] })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => {
              seenIds.add(event.id)
            }),
            completeOnEose(),
            takeUntil(timer(6000)),
            toArray()
          )
      )
    }
    
    console.log('📊 Highlights for URL:', rawEvents.length)
    
    // Rebroadcast highlight events to local/all relays based on settings
    await rebroadcastEvents(rawEvents, relayPool, settings)
    
    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights: Highlight[] = uniqueEvents.map(eventToHighlight)
    return sortHighlights(highlights)
  } catch (error) {
    console.error('Failed to fetch highlights for URL:', error)
    return []
  }
}

/**
 * Fetches highlights created by a specific user
 * @param relayPool - The relay pool to query
 * @param pubkey - The user's public key
 * @param onHighlight - Optional callback to receive highlights as they arrive
 * @param settings - User settings for rebroadcast options
 */
export const fetchHighlights = async (
  relayPool: RelayPool,
  pubkey: string,
  onHighlight?: (highlight: Highlight) => void,
  settings?: UserSettings
): Promise<Highlight[]> => {
  try {
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    
    console.log('🔍 Fetching highlights (kind 9802) by author:', pubkey)
    
    const seenIds = new Set<string>()
    const rawEvents = await lastValueFrom(
      relayPool
        .req(relayUrls, { kinds: [9802], authors: [pubkey] })
        .pipe(
          onlyEvents(),
          tap((event: NostrEvent) => {
            if (!seenIds.has(event.id)) {
              seenIds.add(event.id)
              const highlight = eventToHighlight(event)
              if (onHighlight) {
                onHighlight(highlight)
              }
            }
          }),
          completeOnEose(),
          takeUntil(timer(10000)),
          toArray()
        )
    )
    
    console.log('📊 Raw highlight events fetched:', rawEvents.length)
    
    // Rebroadcast highlight events to local/all relays based on settings
    await rebroadcastEvents(rawEvents, relayPool, settings)
    
    // Deduplicate and process events
    const uniqueEvents = dedupeHighlights(rawEvents)
    console.log('📊 Unique highlight events after deduplication:', uniqueEvents.length)
    
    const highlights: Highlight[] = uniqueEvents.map(eventToHighlight)
    return sortHighlights(highlights)
  } catch (error) {
    console.error('Failed to fetch highlights by author:', error)
    return []
  }
}

