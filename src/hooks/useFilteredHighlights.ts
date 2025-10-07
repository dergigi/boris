import { useMemo } from 'react'
import { Highlight } from '../types/highlights'
import { HighlightVisibility } from '../components/HighlightsPanel'

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    return `${urlObj.hostname.replace(/^www\./, '')}${urlObj.pathname}`.replace(/\/$/, '').toLowerCase()
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase()
  }
}

interface UseFilteredHighlightsParams {
  highlights: Highlight[]
  selectedUrl?: string
  highlightVisibility: HighlightVisibility
  currentUserPubkey?: string
  followedPubkeys: Set<string>
}

export const useFilteredHighlights = ({
  highlights,
  selectedUrl,
  highlightVisibility,
  currentUserPubkey,
  followedPubkeys
}: UseFilteredHighlightsParams) => {
  return useMemo(() => {
    if (!selectedUrl) return highlights
    
    let urlFiltered = highlights
    
    // For Nostr articles, we already fetched highlights specifically for this article
    if (!selectedUrl.startsWith('nostr:')) {
      const normalizedSelected = normalizeUrl(selectedUrl)
      
      urlFiltered = highlights.filter(h => {
        if (!h.urlReference) return false
        const normalizedRef = normalizeUrl(h.urlReference)
        return normalizedSelected === normalizedRef || 
               normalizedSelected.includes(normalizedRef) ||
               normalizedRef.includes(normalizedSelected)
      })
    }
    
    // Classify and filter by visibility levels
    return urlFiltered
      .map(h => {
        let level: 'mine' | 'friends' | 'nostrverse' = 'nostrverse'
        if (h.pubkey === currentUserPubkey) {
          level = 'mine'
        } else if (followedPubkeys.has(h.pubkey)) {
          level = 'friends'
        }
        return { ...h, level }
      })
      .filter(h => {
        if (h.level === 'mine') return highlightVisibility.mine
        if (h.level === 'friends') return highlightVisibility.friends
        return highlightVisibility.nostrverse
      })
  }, [highlights, selectedUrl, highlightVisibility, currentUserPubkey, followedPubkeys])
}

