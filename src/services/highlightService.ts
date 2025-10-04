import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { Highlight } from '../types/highlights'

interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

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

export const fetchHighlights = async (
  relayPool: RelayPool,
  pubkey: string
): Promise<Highlight[]> => {
  try {
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    
    console.log('🔍 Fetching highlights (kind 9802) from relays:', relayUrls)
    
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
      // Extract relevant tags
      const eventRef = event.tags.find(t => t[0] === 'e' || t[0] === 'a')?.[1]
      const urlRef = event.tags.find(t => t[0] === 'r')?.[1]
      const authorTag = event.tags.find(t => t[0] === 'p' && t[3] === 'author')
      const contextTag = event.tags.find(t => t[0] === 'context')
      
      return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        content: event.content,
        tags: event.tags,
        eventReference: eventRef,
        urlReference: urlRef,
        author: authorTag?.[1],
        context: contextTag?.[1]
      }
    })
    
    // Sort by creation time (newest first)
    return highlights.sort((a, b) => b.created_at - a.created_at)
  } catch (error) {
    console.error('Failed to fetch highlights:', error)
    return []
  }
}

