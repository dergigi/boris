import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, tap, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import {
  getHighlightText,
  getHighlightContext,
  getHighlightComment,
  getHighlightSourceEventPointer,
  getHighlightSourceAddressPointer,
  getHighlightSourceUrl,
  getHighlightAttributions
} from 'applesauce-core/helpers'
import { Highlight } from '../types/highlights'
import { RELAYS } from '../config/relays'

/**
 * Deduplicate highlight events by ID
 * Since highlights can come from multiple relays, we need to ensure
 * we only show each unique highlight once
 */
function dedupeHighlights(events: NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>()
  
  for (const event of events) {
    if (event?.id && !byId.has(event.id)) {
      byId.set(event.id, event)
    }
  }
  
  return Array.from(byId.values())
}

/**
 * Fetches highlights for a specific article by its address coordinate and/or event ID
 * @param relayPool - The relay pool to query
 * @param articleCoordinate - The article's address in format "kind:pubkey:identifier" (e.g., "30023:abc...def:my-article")
 * @param eventId - Optional event ID to also query by 'e' tag
 */
export const fetchHighlightsForArticle = async (
  relayPool: RelayPool,
  articleCoordinate: string,
  eventId?: string,
  onHighlight?: (highlight: Highlight) => void
): Promise<Highlight[]> => {
  try {
    console.log('🔍 Fetching highlights (kind 9802) for article:', articleCoordinate)
    console.log('🔍 Event ID:', eventId || 'none')
    console.log('🔍 From relays (including local):', RELAYS)
    
    const seenIds = new Set<string>()
    const processEvent = (event: NostrEvent): Highlight | null => {
      if (seenIds.has(event.id)) return null
      seenIds.add(event.id)
      
      const highlightText = getHighlightText(event)
      const context = getHighlightContext(event)
      const comment = getHighlightComment(event)
      const sourceEventPointer = getHighlightSourceEventPointer(event)
      const sourceAddressPointer = getHighlightSourceAddressPointer(event)
      const sourceUrl = getHighlightSourceUrl(event)
      const attributions = getHighlightAttributions(event)
      
      const author = attributions.find(a => a.role === 'author')?.pubkey
      const eventReference = sourceEventPointer?.id || 
        (sourceAddressPointer ? `${sourceAddressPointer.kind}:${sourceAddressPointer.pubkey}:${sourceAddressPointer.identifier}` : undefined)
      
      return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        content: highlightText,
        tags: event.tags,
        eventReference,
        urlReference: sourceUrl,
        author,
        context,
        comment
      }
    }
    
    // Query for highlights that reference this article via the 'a' tag
    const aTagEvents = await lastValueFrom(
      relayPool
        .req(RELAYS, { kinds: [9802], '#a': [articleCoordinate] })
        .pipe(
          onlyEvents(),
          tap((event: NostrEvent) => {
            const highlight = processEvent(event)
            if (highlight && onHighlight) {
              onHighlight(highlight)
            }
          }),
          completeOnEose(),
          takeUntil(timer(10000)),
          toArray()
        )
    )
    
    console.log('📊 Highlights via a-tag:', aTagEvents.length)
    
    // If we have an event ID, also query for highlights that reference via the 'e' tag
    let eTagEvents: NostrEvent[] = []
    if (eventId) {
      eTagEvents = await lastValueFrom(
        relayPool
          .req(RELAYS, { kinds: [9802], '#e': [eventId] })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => {
              const highlight = processEvent(event)
              if (highlight && onHighlight) {
                onHighlight(highlight)
              }
            }),
            completeOnEose(),
            takeUntil(timer(10000)),
            toArray()
          )
      )
      console.log('📊 Highlights via e-tag:', eTagEvents.length)
    }
    
    // Combine results from both queries
    const rawEvents = [...aTagEvents, ...eTagEvents]
    console.log('📊 Total raw highlight events fetched:', rawEvents.length)
    
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
    
    const highlights: Highlight[] = uniqueEvents.map((event: NostrEvent) => {
      // Use applesauce helpers to extract highlight data
      const highlightText = getHighlightText(event)
      const context = getHighlightContext(event)
      const comment = getHighlightComment(event)
      const sourceEventPointer = getHighlightSourceEventPointer(event)
      const sourceAddressPointer = getHighlightSourceAddressPointer(event)
      const sourceUrl = getHighlightSourceUrl(event)
      const attributions = getHighlightAttributions(event)
      
      // Get author from attributions
      const author = attributions.find(a => a.role === 'author')?.pubkey
      
      // Get event reference (prefer event pointer, fallback to address pointer)
      const eventReference = sourceEventPointer?.id || 
        (sourceAddressPointer ? `${sourceAddressPointer.kind}:${sourceAddressPointer.pubkey}:${sourceAddressPointer.identifier}` : undefined)
      
      return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        content: highlightText,
        tags: event.tags,
        eventReference,
        urlReference: sourceUrl,
        author,
        context,
        comment
      }
    })
    
    // Sort by creation time (newest first)
    return highlights.sort((a, b) => b.created_at - a.created_at)
  } catch (error) {
    console.error('Failed to fetch highlights for article:', error)
    return []
  }
}

/**
 * Fetches highlights created by a specific user
 * @param relayPool - The relay pool to query
 * @param pubkey - The user's public key
 * @param onHighlight - Optional callback to receive highlights as they arrive
 */
export const fetchHighlights = async (
  relayPool: RelayPool,
  pubkey: string,
  onHighlight?: (highlight: Highlight) => void
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
              
              const highlightText = getHighlightText(event)
              const context = getHighlightContext(event)
              const comment = getHighlightComment(event)
              const sourceEventPointer = getHighlightSourceEventPointer(event)
              const sourceAddressPointer = getHighlightSourceAddressPointer(event)
              const sourceUrl = getHighlightSourceUrl(event)
              const attributions = getHighlightAttributions(event)
              
              const author = attributions.find(a => a.role === 'author')?.pubkey
              const eventReference = sourceEventPointer?.id || 
                (sourceAddressPointer ? `${sourceAddressPointer.kind}:${sourceAddressPointer.pubkey}:${sourceAddressPointer.identifier}` : undefined)
              
              const highlight: Highlight = {
                id: event.id,
                pubkey: event.pubkey,
                created_at: event.created_at,
                content: highlightText,
                tags: event.tags,
                eventReference,
                urlReference: sourceUrl,
                author,
                context,
                comment
              }
              
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
    
    // Deduplicate and process events
    const uniqueEvents = dedupeHighlights(rawEvents)
    console.log('📊 Unique highlight events after deduplication:', uniqueEvents.length)
    
    const highlights: Highlight[] = uniqueEvents.map((event: NostrEvent) => {
      const highlightText = getHighlightText(event)
      const context = getHighlightContext(event)
      const comment = getHighlightComment(event)
      const sourceEventPointer = getHighlightSourceEventPointer(event)
      const sourceAddressPointer = getHighlightSourceAddressPointer(event)
      const sourceUrl = getHighlightSourceUrl(event)
      const attributions = getHighlightAttributions(event)
      
      const author = attributions.find(a => a.role === 'author')?.pubkey
      const eventReference = sourceEventPointer?.id || 
        (sourceAddressPointer ? `${sourceAddressPointer.kind}:${sourceAddressPointer.pubkey}:${sourceAddressPointer.identifier}` : undefined)
      
      return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        content: highlightText,
        tags: event.tags,
        eventReference,
        urlReference: sourceUrl,
        author,
        context,
        comment
      }
    })
    
    // Sort by creation time (newest first)
    return highlights.sort((a, b) => b.created_at - a.created_at)
  } catch (error) {
    console.error('Failed to fetch highlights by author:', error)
    return []
  }
}

