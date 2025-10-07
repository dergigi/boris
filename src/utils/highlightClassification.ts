import { Highlight } from '../types/highlights'

export type HighlightLevel = 'mine' | 'friends' | 'nostrverse'

/**
 * Classify a highlight based on the current user and their followed pubkeys
 */
export function classifyHighlight(
  highlight: Highlight,
  currentUserPubkey?: string,
  followedPubkeys: Set<string> = new Set()
): Highlight & { level: HighlightLevel } {
  let level: HighlightLevel = 'nostrverse'
  
  if (highlight.pubkey === currentUserPubkey) {
    level = 'mine'
  } else if (followedPubkeys.has(highlight.pubkey)) {
    level = 'friends'
  }
  
  return { ...highlight, level }
}

/**
 * Classify an array of highlights
 */
export function classifyHighlights(
  highlights: Highlight[],
  currentUserPubkey?: string,
  followedPubkeys: Set<string> = new Set()
): Array<Highlight & { level: HighlightLevel }> {
  return highlights.map(h => classifyHighlight(h, currentUserPubkey, followedPubkeys))
}

