import { EventFactory, Blueprints } from 'applesauce-factory'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { RELAYS } from '../config/relays'
import { Highlight } from '../types/highlights'
import { UserSettings } from './settingsService'

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
 * Returns the signed event for immediate UI updates
 */
export async function createHighlight(
  selectedText: string,
  source: NostrEvent | string,
  account: IAccount,
  relayPool: RelayPool,
  contentForContext?: string,
  comment?: string,
  settings?: UserSettings
): Promise<NostrEvent> {
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
    highlightEvent.tags[altTagIndex] = ['alt', 'Highlight created by Boris. readwithboris.com']
  } else {
    highlightEvent.tags.push(['alt', 'Highlight created by Boris. readwithboris.com'])
  }

  // Add zap tags for nostr-native content (NIP-57 Appendix G)
  if (typeof source === 'object' && 'kind' in source) {
    const zapSplitPercentage = settings?.zapSplitPercentage ?? 50
    addZapTags(highlightEvent, account.pubkey, source.pubkey, zapSplitPercentage)
  }

  // Sign the event
  const signedEvent = await factory.sign(highlightEvent)

  // Publish to relays (including local relay)
  await relayPool.publish(RELAYS, signedEvent)
  
  console.log('✅ Highlight published to', RELAYS.length, 'relays (including local):', signedEvent)
  
  // Return the signed event for immediate UI updates
  return signedEvent
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
 * @param event The highlight event to add zap tags to
 * @param highlighterPubkey The pubkey of the user creating the highlight
 * @param authorPubkey The pubkey of the original article author
 * @param highlighterPercentage Percentage (0-100) to give to the highlighter (default 50)
 */
function addZapTags(
  event: NostrEvent,
  highlighterPubkey: string,
  authorPubkey: string,
  highlighterPercentage: number = 50
): void {
  // Calculate weights based on percentage
  // Using simple integer weights where highlighterPercentage:authorPercentage ratio is maintained
  const highlighterWeight = Math.round(highlighterPercentage)
  const authorWeight = Math.round(100 - highlighterPercentage)
  
  // Use a reliable relay for zap metadata lookup (first non-local relay)
  const zapRelay = RELAYS.find(r => !r.includes('localhost')) || RELAYS[0]
  
  // Add zap tag for the highlighter
  event.tags.push(['zap', highlighterPubkey, zapRelay, highlighterWeight.toString()])
  
  // Add zap tag for the original author (only if different from highlighter)
  if (authorPubkey !== highlighterPubkey) {
    event.tags.push(['zap', authorPubkey, zapRelay, authorWeight.toString()])
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

