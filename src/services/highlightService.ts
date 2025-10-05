import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
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
 * Fetches highlights for a specific article by its address coordinate
 * @param relayPool - The relay pool to query
 * @param articleCoordinate - The article's address in format "kind:pubkey:identifier" (e.g., "30023:abc...def:my-article")
 */
export const fetchHighlightsForArticle = async (
  relayPool: RelayPool,
  articleCoordinate: string
): Promise<Highlight[]> => {
  try {
    // Use well-known relays for highlights even if user isn't logged in
    const highlightRelays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://relay.snort.social',
      'wss://purplepag.es'
    ]
    
    console.log('🔍 Fetching highlights (kind 9802) for article:', articleCoordinate)
    console.log('🔍 From relays:', highlightRelays)
    console.log('🔍 Filter:', JSON.stringify({ kinds: [9802], '#a': [articleCoordinate] }, null, 2))
    
    // Query for highlights that reference this article via the 'a' tag
    const rawEvents = await lastValueFrom(
      relayPool
        .req(highlightRelays, { kinds: [9802], '#a': [articleCoordinate] })
        .pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
    )
    
    console.log('📊 Raw highlight events fetched:', rawEvents.length)
    if (rawEvents.length > 0) {
      console.log('📄 Sample highlight tags:', JSON.stringify(rawEvents[0].tags, null, 2))
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
 */
export const fetchHighlights = async (
  relayPool: RelayPool,
  pubkey: string
): Promise<Highlight[]> => {
  try {
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    
    console.log('🔍 Fetching highlights (kind 9802) by author:', pubkey)
    
    const rawEvents = await lastValueFrom(
      relayPool
        .req(relayUrls, { kinds: [9802], authors: [pubkey] })
        .pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
    )
    
    console.log('📊 Raw highlight events fetched:', rawEvents.length)
    
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
    console.error('Failed to fetch highlights by author:', error)
    return []
  }
}

