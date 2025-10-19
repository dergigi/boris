import { useMemo } from 'react'
import { Highlight } from '../types/highlights'
import { applyHighlightsToHTML } from '../utils/highlightMatching'
import { filterHighlightsByUrl } from '../utils/urlHelpers'
import { HighlightVisibility } from '../components/HighlightsPanel'
import { classifyHighlights } from '../utils/highlightClassification'

interface UseHighlightedContentParams {
  html?: string
  markdown?: string
  renderedMarkdownHtml: string
  highlights: Highlight[]
  showHighlights: boolean
  highlightStyle: 'marker' | 'underline'
  selectedUrl?: string
  highlightVisibility: HighlightVisibility
  currentUserPubkey?: string
  followedPubkeys: Set<string>
}

export const useHighlightedContent = ({
  html,
  markdown,
  renderedMarkdownHtml,
  highlights,
  showHighlights,
  highlightStyle,
  selectedUrl,
  highlightVisibility,
  currentUserPubkey,
  followedPubkeys
}: UseHighlightedContentParams) => {
  // Filter highlights by URL and visibility settings
  const relevantHighlights = useMemo(() => {
    const urlFiltered = filterHighlightsByUrl(highlights, selectedUrl)
    
    // Apply visibility filtering
    const classified = classifyHighlights(urlFiltered, currentUserPubkey, followedPubkeys)
    const filtered = classified.filter(h => {
      if (h.level === 'mine') return highlightVisibility.mine
      if (h.level === 'friends') return highlightVisibility.friends
      return highlightVisibility.nostrverse
    })
      
    return filtered
  }, [selectedUrl, highlights, highlightVisibility, currentUserPubkey, followedPubkeys])

  // Prepare the final HTML with highlights applied
  const finalHtml = useMemo(() => {
    const sourceHtml = markdown ? renderedMarkdownHtml : html
    
    // Prepare final HTML
    if (!sourceHtml) {
      return ''
    }
    
    if (showHighlights && relevantHighlights.length > 0) {
      const highlightedHtml = applyHighlightsToHTML(sourceHtml, relevantHighlights, highlightStyle)
      return highlightedHtml
    }
    
    return sourceHtml

  }, [html, renderedMarkdownHtml, markdown, relevantHighlights, showHighlights, highlightStyle])

  return { finalHtml, relevantHighlights }
}

