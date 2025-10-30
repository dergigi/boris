import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { Highlight } from '../types/highlights'

const {
  getHighlightText,
  getHighlightContext,
  getHighlightComment,
  getHighlightSourceEventPointer,
  getHighlightSourceAddressPointer,
  getHighlightSourceUrl,
  getHighlightAttributions
} = Helpers

/**
 * Cache for highlight metadata that persists across EventStore serialization
 * Key: event ID, Value: { publishedRelays, isLocalOnly, isSyncing }
 */
const highlightMetadataCache = new Map<string, {
  publishedRelays?: string[]
  isLocalOnly?: boolean
  isSyncing?: boolean
}>()

/**
 * Store highlight metadata for an event ID
 */
export function setHighlightMetadata(
  eventId: string,
  metadata: {
    publishedRelays?: string[]
    isLocalOnly?: boolean
    isSyncing?: boolean
  }
): void {
  highlightMetadataCache.set(eventId, metadata)
}

/**
 * Get highlight metadata for an event ID
 */
export function getHighlightMetadata(eventId: string): {
  publishedRelays?: string[]
  isLocalOnly?: boolean
  isSyncing?: boolean
} | undefined {
  return highlightMetadataCache.get(eventId)
}

/**
 * Convert a NostrEvent to a Highlight object
 */
export function eventToHighlight(event: NostrEvent): Highlight {
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
  
  // Check cache first (persists across EventStore serialization)
  const cachedMetadata = getHighlightMetadata(event.id)
  
  // Fall back to __highlightProps if cache doesn't have it (for backwards compatibility)
  const customProps = cachedMetadata || (event as any).__highlightProps || {}
  
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
    comment,
    // Preserve custom properties if they exist
    publishedRelays: customProps.publishedRelays,
    isLocalOnly: customProps.isLocalOnly,
    isSyncing: customProps.isSyncing
  }
}

/**
 * Deduplicate highlight events by ID
 */
export function dedupeHighlights(events: NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>()
  
  for (const event of events) {
    if (event?.id && !byId.has(event.id)) {
      byId.set(event.id, event)
    }
  }
  
  return Array.from(byId.values())
}

/**
 * Sort highlights by creation time (newest first)
 */
export function sortHighlights(highlights: Highlight[]): Highlight[] {
  return highlights.sort((a, b) => b.created_at - a.created_at)
}

