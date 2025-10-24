import { useMemo } from 'react'
import { Highlight } from '../types/highlights'
import { HighlightVisibility } from '../components/HighlightsPanel'
import { normalizeUrl } from '../utils/urlHelpers'
import { classifyHighlights } from '../utils/highlightClassification'
import { nip19 } from 'nostr-tools'

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
    
    // Filter highlights based on URL type
    if (selectedUrl.startsWith('nostr:')) {
      // For Nostr articles, extract the article coordinate and filter by eventReference
      try {
        const decoded = nip19.decode(selectedUrl.replace('nostr:', ''))
        if (decoded.type === 'naddr') {
          const ptr = decoded.data as { kind: number; pubkey: string; identifier: string }
          const articleCoordinate = `${ptr.kind}:${ptr.pubkey}:${ptr.identifier}`
          
          urlFiltered = highlights.filter(h => {
            // Keep highlights that match this article coordinate
            return h.eventReference === articleCoordinate
          })
        } else {
          // Not a valid naddr, clear all highlights
          urlFiltered = []
        }
      } catch {
        // Invalid naddr, clear all highlights
        urlFiltered = []
      }
    } else {
      // For web URLs, filter by URL matching
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
    const classified = classifyHighlights(urlFiltered, currentUserPubkey, followedPubkeys)
    return classified.filter(h => {
      if (h.level === 'mine') return highlightVisibility.mine
      if (h.level === 'friends') return highlightVisibility.friends
      return highlightVisibility.nostrverse
    })
  }, [highlights, selectedUrl, highlightVisibility, currentUserPubkey, followedPubkeys])
}

