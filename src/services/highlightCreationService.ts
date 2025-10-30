import { EventFactory, Blueprints } from 'applesauce-factory'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
import { Helpers, IEventStore } from 'applesauce-core'
import { RELAYS } from '../config/relays'
import { Highlight } from '../types/highlights'
import { UserSettings } from './settingsService'
import { isLocalRelay } from '../utils/helpers'
import { setHighlightMetadata } from './highlightEventProcessor'

// Boris pubkey for zap splits
// npub19802see0gnk3vjlus0dnmfdagusqrtmsxpl5yfmkwn9uvnfnqylqduhr0x
export const BORIS_PUBKEY = '29dea8672f44ed164bfc83db3da5bd472001af70307f42277674cbc64d33013e'

// Extended event type with highlight metadata
interface HighlightEvent extends NostrEvent {
  __highlightProps?: {
    publishedRelays?: string[]
    isLocalOnly?: boolean
    isSyncing?: boolean
  }
}

const {
  getHighlightText,
  getHighlightContext,
  getHighlightComment,
  getHighlightSourceEventPointer,
  getHighlightSourceAddressPointer,
  getHighlightSourceUrl,
  getHighlightAttributions
} = Helpers

const { HighlightBlueprint } = Blueprints

/**
 * Creates and publishes a highlight event (NIP-84)
 * Supports both nostr-native articles and external URLs
 * Returns a Highlight object with relay tracking info for immediate UI updates
 */
export async function createHighlight(
  selectedText: string,
  source: NostrEvent | string,
  account: IAccount,
  relayPool: RelayPool,
  eventStore: IEventStore,
  contentForContext?: string,
  comment?: string,
  settings?: UserSettings
): Promise<Highlight> {
  if (!selectedText || !source) {
    throw new Error('Missing required data to create highlight')
  }

  // Create EventFactory with the account as signer
  const factory = new EventFactory({ signer: account.signer })

  let blueprintSource: NostrEvent | AddressPointer | string
  let context: string | undefined

  // Handle NostrEvent (article) source
  if (typeof source === 'object' && 'kind' in source) {
    blueprintSource = parseArticleCoordinate(source)
    context = extractContext(selectedText, source.content)
  } 
  // Handle URL string source
  else {
    blueprintSource = source
    // Try to extract context from provided content if available
    if (contentForContext) {
      context = extractContext(selectedText, contentForContext)
    }
  }

  // Create highlight event using the blueprint
  const highlightEvent = await factory.create(
    HighlightBlueprint,
    selectedText,
    blueprintSource,
    context ? { comment, context } : comment ? { comment } : undefined
  )

  // Update the alt tag to identify Boris as the creator
  const altTagIndex = highlightEvent.tags.findIndex(tag => tag[0] === 'alt')
  if (altTagIndex !== -1) {
    highlightEvent.tags[altTagIndex] = ['alt', 'Highlight created by Boris. read.withboris.com']
  } else {
    highlightEvent.tags.push(['alt', 'Highlight created by Boris. read.withboris.com'])
  }

  // Add p tag (author tag) for nostr-native content
  // This tags the original author so they can see highlights of their work
  if (typeof source === 'object' && 'kind' in source) {
    // Only add p tag if it doesn't already exist
    const hasPTag = highlightEvent.tags.some(tag => tag[0] === 'p' && tag[1] === source.pubkey)
    if (!hasPTag) {
      highlightEvent.tags.push(['p', source.pubkey])
    }
  }

  // Add zap tags for nostr-native content (NIP-57 Appendix G)
  if (typeof source === 'object' && 'kind' in source) {
    // Migrate old settings format to new weight-based format if needed
    let highlighterWeight = settings?.zapSplitHighlighterWeight
    let borisWeight = settings?.zapSplitBorisWeight
    let authorWeight = settings?.zapSplitAuthorWeight
    
    const anySettings = settings as Record<string, unknown> | undefined
    if (!highlighterWeight && anySettings && 'zapSplitPercentage' in anySettings) {
      highlighterWeight = anySettings.zapSplitPercentage as number
      authorWeight = 100 - (anySettings.zapSplitPercentage as number)
    }
    if (!borisWeight && anySettings && 'borisSupportPercentage' in anySettings) {
      borisWeight = anySettings.borisSupportPercentage as number
    }
    
    // Use defaults if still undefined
    highlighterWeight = highlighterWeight ?? 50
    borisWeight = borisWeight ?? 2.1
    authorWeight = authorWeight ?? 50
    
    addZapTags(highlightEvent, account.pubkey, source, highlighterWeight, borisWeight, authorWeight)
  }

  // Sign the event
  const signedEvent = await factory.sign(highlightEvent)

  // Initialize custom properties on the event (will be updated after publishing)
  ;(signedEvent as HighlightEvent).__highlightProps = {
    publishedRelays: [],
    isLocalOnly: false,
    isSyncing: false
  }

  // Get only connected relays to avoid long timeouts
  const connectedRelays = Array.from(relayPool.relays.values())
    .filter(relay => relay.connected)
    .map(relay => relay.url)
  
  let publishResponses: { ok: boolean; message?: string; from: string }[] = []
  let isLocalOnly = false

  console.log('🚀 [HIGHLIGHT-PUBLISH] Starting highlight publication process', {
    eventId: signedEvent.id,
    connectedRelays,
    connectedRelayCount: connectedRelays.length
  })

  try {
    // Publish only to connected relays to avoid long timeouts
    if (connectedRelays.length === 0) {
      console.log('⚠️ [HIGHLIGHT-PUBLISH] No connected relays, marking as local-only')
      isLocalOnly = true
    } else {
      console.log('📡 [HIGHLIGHT-PUBLISH] Publishing to connected relays...')
      publishResponses = await relayPool.publish(connectedRelays, signedEvent)
    }
    
    console.log('📨 [HIGHLIGHT-PUBLISH] Received responses from relays:', publishResponses)
    
    // Determine which relays successfully accepted the event
    const successfulRelays = publishResponses
      .filter(response => response.ok)
      .map(response => response.from)
    
    const failedRelays = publishResponses
      .filter(response => !response.ok)
      .map(response => ({ from: response.from, message: response.message }))
    
    const successfulLocalRelays = successfulRelays.filter(url => isLocalRelay(url))
    const successfulRemoteRelays = successfulRelays.filter(url => !isLocalRelay(url))
    
    // isLocalOnly is true if only local relays accepted the event
    isLocalOnly = successfulLocalRelays.length > 0 && successfulRemoteRelays.length === 0

    console.log('✅ [HIGHLIGHT-PUBLISH] Publishing analysis:', {
      connectedRelays: connectedRelays.length,
      successfulRelays: successfulRelays.length,
      failedRelays: failedRelays.length,
      failedRelayDetails: failedRelays,
      successfulLocalRelays,
      successfulRemoteRelays,
      isLocalOnly,
      flightModeReason: isLocalOnly 
        ? 'Only local relays accepted the event' 
        : successfulRemoteRelays.length > 0 
          ? 'Remote relays also accepted the event'
          : 'No relays accepted the event'
    })

    // Handle case when no relays were connected
    const successfulRelaysList = publishResponses.length > 0
      ? publishResponses
          .filter(response => response.ok)
          .map(response => response.from)
      : []

    // Store metadata in cache (persists across EventStore serialization)
    setHighlightMetadata(signedEvent.id, {
      publishedRelays: successfulRelaysList,
      isLocalOnly,
      isSyncing: false
    })

    // Also update the event with the actual properties (for backwards compatibility)
    ;(signedEvent as HighlightEvent).__highlightProps = {
      publishedRelays: successfulRelaysList,
      isLocalOnly,
      isSyncing: false
    }

    // Store the event in EventStore AFTER updating with final properties
    eventStore.add(signedEvent)

    // Mark for offline sync if we're in local-only mode
    if (isLocalOnly) {
      console.log('✈️ [HIGHLIGHT-PUBLISH] Marking event for offline sync (flight mode)')
      const { markEventAsOfflineCreated } = await import('./offlineSyncService')
      markEventAsOfflineCreated(signedEvent.id)
    } else {
      console.log('🌐 [HIGHLIGHT-PUBLISH] Event published to remote relays, no offline sync needed')
    }

  } catch (error) {
    console.error('❌ [HIGHLIGHT-PUBLISH] Failed to publish highlight to relays:', error)
    // If publishing fails completely, assume local-only mode
    isLocalOnly = true
    
    // Store metadata in cache (persists across EventStore serialization)
    setHighlightMetadata(signedEvent.id, {
      publishedRelays: [],
      isLocalOnly: true,
      isSyncing: false
    })
    
    // Also update the event with the error state (for backwards compatibility)
    ;(signedEvent as HighlightEvent).__highlightProps = {
      publishedRelays: [],
      isLocalOnly: true,
      isSyncing: false
    }
    
    // Store the event in EventStore AFTER updating with final properties
    eventStore.add(signedEvent)
    
    console.log('✈️ [HIGHLIGHT-PUBLISH] Publishing failed, marking for offline sync (flight mode)')
    const { markEventAsOfflineCreated } = await import('./offlineSyncService')
    markEventAsOfflineCreated(signedEvent.id)
  }

  // Convert to Highlight with relay tracking info
  const highlight = eventToHighlight(signedEvent)
  
  // Manually set the properties since __highlightProps might not be working
  const finalPublishedRelays = publishResponses.length > 0
    ? publishResponses
        .filter(response => response.ok)
        .map(response => response.from)
    : []
  
  highlight.publishedRelays = finalPublishedRelays
  highlight.isLocalOnly = isLocalOnly
  highlight.isSyncing = false
  
  console.log('🔄 [HIGHLIGHT-CREATION] Final highlight properties set:', {
    eventId: signedEvent.id,
    publishedRelays: highlight.publishedRelays,
    isLocalOnly: highlight.isLocalOnly,
    isSyncing: highlight.isSyncing,
    relayCount: highlight.publishedRelays.length
  })

  return highlight
}

/**
 * Parse article coordinate to create address pointer
 */
function parseArticleCoordinate(article: NostrEvent): AddressPointer {
  // Try to get identifier from article tags
  const identifier = article.tags.find(tag => tag[0] === 'd')?.[1] || ''

  return {
    kind: article.kind,
    pubkey: article.pubkey,
    identifier,
    relays: [] // Optional relays hint
  }
}

/**
 * Extracts context for a highlight by finding the previous and next sentences
 * in the same paragraph as the selected text
 */
function extractContext(selectedText: string, articleContent: string): string | undefined {
  if (!selectedText || !articleContent) return undefined

  // Find the position of the selected text in the article
  const selectedIndex = articleContent.indexOf(selectedText)
  if (selectedIndex === -1) return undefined

  // Split content into paragraphs (by double newlines or single newlines)
  const paragraphs = articleContent.split(/\n\n+/)
  
  // Find which paragraph contains the selected text
  let currentPos = 0
  let containingParagraph: string | undefined
  
  for (const paragraph of paragraphs) {
    const paragraphEnd = currentPos + paragraph.length
    if (selectedIndex >= currentPos && selectedIndex < paragraphEnd) {
      containingParagraph = paragraph
      break
    }
    currentPos = paragraphEnd + 2 // Account for the double newline
  }

  if (!containingParagraph) return undefined

  // Split paragraph into sentences (basic sentence splitting)
  // This regex splits on periods, exclamation marks, or question marks followed by space or end of string
  const sentences = containingParagraph.split(/([.!?]+\s+)/).filter(s => s.trim().length > 0)
  
  // Reconstruct sentences properly by joining sentence text with punctuation
  const reconstructedSentences: string[] = []
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].match(/^[.!?]+\s*$/)) {
      // This is punctuation, attach it to previous sentence
      if (reconstructedSentences.length > 0) {
        reconstructedSentences[reconstructedSentences.length - 1] += sentences[i]
      }
    } else {
      reconstructedSentences.push(sentences[i])
    }
  }

  // Find which sentence contains the selected text
  let selectedSentenceIndex = -1
  for (let i = 0; i < reconstructedSentences.length; i++) {
    if (reconstructedSentences[i].includes(selectedText)) {
      selectedSentenceIndex = i
      break
    }
  }

  if (selectedSentenceIndex === -1) return undefined

  // Build context from previous and next sentences
  const contextParts: string[] = []
  
  // Add previous sentence if it exists
  if (selectedSentenceIndex > 0) {
    contextParts.push(reconstructedSentences[selectedSentenceIndex - 1].trim())
  }
  
  // Add the selected sentence itself
  contextParts.push(reconstructedSentences[selectedSentenceIndex].trim())
  
  // Add next sentence if it exists
  if (selectedSentenceIndex < reconstructedSentences.length - 1) {
    contextParts.push(reconstructedSentences[selectedSentenceIndex + 1].trim())
  }

  // Only return context if we have more than just the selected sentence
  return contextParts.length > 1 ? contextParts.join(' ') : undefined
}

/**
 * Adds zap tags to a highlight event for split payments (NIP-57 Appendix G)
 * Respects existing zap tags in the source event (author group)
 * @param event The highlight event to add zap tags to (can be EventTemplate or NostrEvent)
 * @param highlighterPubkey The pubkey of the user creating the highlight
 * @param sourceEvent The source event (may contain existing zap tags)
 * @param highlighterWeight Weight to give to the highlighter (default 50)
 * @param borisWeight Weight to give to Boris (default 2.1)
 * @param authorWeight Weight to give to author(s) (default 50)
 */
function addZapTags(
  event: { tags: string[][] },
  highlighterPubkey: string,
  sourceEvent: NostrEvent,
  highlighterWeight: number = 50,
  borisWeight: number = 2.1,
  authorWeight: number = 50
): void {
  // Use a reliable relay for zap metadata lookup (first non-local relay)
  const zapRelay = RELAYS.find(r => !r.includes('localhost')) || RELAYS[0]
  
  // Extract existing zap tags from source event (the "author group")
  const existingZapTags = sourceEvent.tags.filter(tag => tag[0] === 'zap')
  
  // Add zap tag for the highlighter
  if (highlighterWeight > 0) {
    event.tags.push(['zap', highlighterPubkey, zapRelay, highlighterWeight.toString()])
  }
  
  // Add zap tag for Boris (if weight > 0 and Boris is not the highlighter)
  if (borisWeight > 0 && BORIS_PUBKEY !== highlighterPubkey) {
    event.tags.push(['zap', BORIS_PUBKEY, zapRelay, borisWeight.toFixed(1)])
  }
  
  if (existingZapTags.length > 0 && authorWeight > 0) {
    // Calculate total weight from existing zap tags
    const totalExistingWeight = existingZapTags.reduce((sum, tag) => {
      const weight = parseFloat(tag[3] || '1')
      return sum + weight
    }, 0)
    
    // Add proportionally adjusted zap tags for each existing author
    // Don't add the highlighter or Boris again if they're already in the author group
    for (const zapTag of existingZapTags) {
      const authorPubkey = zapTag[1]
      
      // Skip if this is the highlighter or Boris (they already have their shares)
      if (authorPubkey === highlighterPubkey || authorPubkey === BORIS_PUBKEY) continue
      
      const originalWeight = parseFloat(zapTag[3] || '1')
      const originalRelay = zapTag[2] || zapRelay
      
      // Calculate proportional weight: (original weight / total weight) * author group weight
      const adjustedWeight = (originalWeight / totalExistingWeight) * authorWeight
      
      // Only add if weight is greater than 0
      if (adjustedWeight > 0) {
        event.tags.push(['zap', authorPubkey, originalRelay, adjustedWeight.toFixed(1)])
      }
    }
  } else if (authorWeight > 0) {
    // No existing zap tags, give full author weight to source author
    
    // Add zap tag for the original author (only if different from highlighter and Boris)
    if (sourceEvent.pubkey !== highlighterPubkey && sourceEvent.pubkey !== BORIS_PUBKEY) {
      event.tags.push(['zap', sourceEvent.pubkey, zapRelay, authorWeight.toFixed(1)])
    }
  }
}

/**
 * Converts a NostrEvent to a Highlight object for immediate UI display
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

