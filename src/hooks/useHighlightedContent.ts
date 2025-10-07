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
    console.log('🔍 ContentPanel: Processing highlights', {
      totalHighlights: highlights.length,
      selectedUrl,
      showHighlights
    })
    
    const urlFiltered = filterHighlightsByUrl(highlights, selectedUrl)
    console.log('📌 URL filtered highlights:', urlFiltered.length)
    
    // Apply visibility filtering
    const classified = classifyHighlights(urlFiltered, currentUserPubkey, followedPubkeys)
    const filtered = classified.filter(h => {
      if (h.level === 'mine') return highlightVisibility.mine
      if (h.level === 'friends') return highlightVisibility.friends
      return highlightVisibility.nostrverse
    })
      
    console.log('✅ Relevant highlights after filtering:', filtered.length, filtered.map(h => h.content.substring(0, 30)))
    return filtered
  }, [selectedUrl, highlights, highlightVisibility, currentUserPubkey, followedPubkeys, showHighlights])

  // Prepare the final HTML with highlights applied
  const finalHtml = useMemo(() => {
    const sourceHtml = markdown ? renderedMarkdownHtml : html
    
    console.log('🎨 Preparing final HTML:', {
      hasMarkdown: !!markdown,
      hasHtml: !!html,
      renderedHtmlLength: renderedMarkdownHtml.length,
      sourceHtmlLength: sourceHtml?.length || 0,
      showHighlights,
      relevantHighlightsCount: relevantHighlights.length
    })
    
    if (!sourceHtml) {
      console.warn('⚠️ No source HTML available')
      return ''
    }
    
    if (showHighlights && relevantHighlights.length > 0) {
      console.log('✨ Applying', relevantHighlights.length, 'highlights to HTML')
      const highlightedHtml = applyHighlightsToHTML(sourceHtml, relevantHighlights, highlightStyle)
      console.log('✅ Highlights applied, result length:', highlightedHtml.length)
      return highlightedHtml
    }
    
    console.log('📄 Returning source HTML without highlights')
    return sourceHtml
  }, [html, renderedMarkdownHtml, markdown, relevantHighlights, showHighlights, highlightStyle])

  return { finalHtml, relevantHighlights }
}

