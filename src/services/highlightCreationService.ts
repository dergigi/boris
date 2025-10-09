import { EventFactory, Blueprints } from 'applesauce-factory'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
import { Helpers, IEventStore } from 'applesauce-core'
import { RELAYS } from '../config/relays'
import { Highlight } from '../types/highlights'
import { UserSettings } from './settingsService'
import { areAllRelaysLocal } from '../utils/helpers'
import { markEventAsOfflineCreated } from './offlineSyncService'

// Boris pubkey for zap splits
// npub19802see0gnk3vjlus0dnmfdagusqrtmsxpl5yfmkwn9uvnfnqylqduhr0x
const BORIS_PUBKEY = '29dea8672f44ed164bfc83db3da5bd472001af70307f42277674cbc64d33013e'

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
  const factory = new EventFactory({ signer: account })

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

  // Publish to all configured relays - let the relay pool handle connection state
  const targetRelays = RELAYS
  
  // Store the event in the local EventStore FIRST for immediate UI display
  eventStore.add(signedEvent)
  console.log('💾 Stored highlight in EventStore:', signedEvent.id.slice(0, 8))
  
  // Check current connection status - are we online or in flight mode?
  const connectedRelays = Array.from(relayPool.relays.values())
    .filter(relay => relay.connected)
    .map(relay => relay.url)
  
  const hasRemoteConnection = connectedRelays.some(url => 
    !url.includes('localhost') && !url.includes('127.0.0.1')
  )
  
  // Determine which relays we expect to succeed
  const expectedSuccessRelays = hasRemoteConnection 
    ? RELAYS 
    : RELAYS.filter(r => r.includes('localhost') || r.includes('127.0.0.1'))
  
  const isLocalOnly = areAllRelaysLocal(expectedSuccessRelays)
  
  console.log('📍 Highlight relay status:', {
    targetRelays: targetRelays.length,
    expectedSuccessRelays,
    isLocalOnly,
    hasRemoteConnection,
    eventId: signedEvent.id
  })
  
  // If we're in local-only mode, mark this event for later sync
  if (isLocalOnly) {
    markEventAsOfflineCreated(signedEvent.id)
  }
  
  // Convert to Highlight with relay tracking info and return IMMEDIATELY
  const highlight = eventToHighlight(signedEvent)
  highlight.publishedRelays = expectedSuccessRelays // Show only relays we expect to succeed
  highlight.isLocalOnly = isLocalOnly
  highlight.isOfflineCreated = isLocalOnly // Mark as created offline if local-only
  
  // Publish to relays in the background (non-blocking)
  // This allows instant UI updates while publishing happens asynchronously
  relayPool.publish(targetRelays, signedEvent)
    .then(() => {
      console.log('✅ Highlight published to', targetRelays.length, 'relay(s):', targetRelays)
    })
    .catch((error) => {
      console.warn('⚠️ Failed to publish highlight to relays (event still saved locally):', error)
    })
  
  // Return the highlight immediately for instant UI updates
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

