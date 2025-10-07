import React from 'react'
import { Highlight } from '../types/highlights'

export type { HighlightMatch } from './highlightMatching/textMatching'
export { findHighlightMatches } from './highlightMatching/textMatching'
export { applyHighlightsToHTML } from './highlightMatching/htmlMatching'

import { findHighlightMatches as _findHighlightMatches } from './highlightMatching/textMatching'

/**
 * Apply highlights to text content by wrapping matched text in span elements
 */
export function applyHighlightsToText(
  text: string,
  highlights: Highlight[]
): React.ReactNode {
  const matches = _findHighlightMatches(text, highlights)
  
  if (matches.length === 0) {
    return text
  }
  
  const result: React.ReactNode[] = []
  let lastIndex = 0
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    
    if (match.startIndex < lastIndex) {
      continue
    }
    
    if (match.startIndex > lastIndex) {
      result.push(text.substring(lastIndex, match.startIndex))
    }
    
    const highlightedText = text.substring(match.startIndex, match.endIndex)
    const levelClass = match.highlight.level ? ` level-${match.highlight.level}` : ''
    result.push(
      <mark
        key={`highlight-${match.highlight.id}-${match.startIndex}`}
        className={`content-highlight${levelClass}`}
        data-highlight-id={match.highlight.id}
        data-highlight-level={match.highlight.level || 'nostrverse'}
        title={`Highlighted ${new Date(match.highlight.created_at * 1000).toLocaleDateString()}`}
      >
        {highlightedText}
      </mark>
    )
    
    lastIndex = match.endIndex
  }
  
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex))
  }
  
  return <>{result}</>
}
