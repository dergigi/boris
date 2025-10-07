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

