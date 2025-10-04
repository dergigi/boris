import React from 'react'
import { Highlight } from '../types/highlights'

export interface HighlightMatch {
  highlight: Highlight
  startIndex: number
  endIndex: number
}

/**
 * Find all occurrences of highlight text in the content
 */
export function findHighlightMatches(
  content: string,
  highlights: Highlight[]
): HighlightMatch[] {
  const matches: HighlightMatch[] = []
  
  for (const highlight of highlights) {
    if (!highlight.content || highlight.content.trim().length === 0) {
      continue
    }
    
    const searchText = highlight.content.trim()
    let startIndex = 0
    
    // Find all occurrences of this highlight in the content
    while (true) {
      const index = content.indexOf(searchText, startIndex)
      if (index === -1) break
      
      matches.push({
        highlight,
        startIndex: index,
        endIndex: index + searchText.length
      })
      
      startIndex = index + searchText.length
    }
  }
  
  // Sort by start index
  return matches.sort((a, b) => a.startIndex - b.startIndex)
}

/**
 * Apply highlights to text content by wrapping matched text in span elements
 */
export function applyHighlightsToText(
  text: string,
  highlights: Highlight[]
): React.ReactNode {
  const matches = findHighlightMatches(text, highlights)
  
  if (matches.length === 0) {
    return text
  }
  
  const result: React.ReactNode[] = []
  let lastIndex = 0
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    
    // Skip overlapping highlights (keep the first one)
    if (match.startIndex < lastIndex) {
      continue
    }
    
    // Add text before the highlight
    if (match.startIndex > lastIndex) {
      result.push(text.substring(lastIndex, match.startIndex))
    }
    
    // Add the highlighted text
    const highlightedText = text.substring(match.startIndex, match.endIndex)
    result.push(
      <mark
        key={`highlight-${match.highlight.id}-${match.startIndex}`}
        className="content-highlight"
        data-highlight-id={match.highlight.id}
        title={`Highlighted ${new Date(match.highlight.created_at * 1000).toLocaleDateString()}`}
      >
        {highlightedText}
      </mark>
    )
    
    lastIndex = match.endIndex
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex))
  }
  
  return <>{result}</>
}

/**
 * Apply highlights to HTML content by injecting mark tags
 */
export function applyHighlightsToHTML(
  html: string,
  highlights: Highlight[]
): string {
  // Extract text content from HTML for matching
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  const textContent = tempDiv.textContent || ''
  
  const matches = findHighlightMatches(textContent, highlights)
  
  if (matches.length === 0) {
    return html
  }
  
  // For HTML, we'll wrap the highlight text with mark tags
  let modifiedHTML = html
  
  // Process matches in reverse order to maintain indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]
    const searchText = match.highlight.content.trim()
    
    // Simple approach: replace text occurrences with marked version
    // This is a basic implementation - a more robust solution would use DOM manipulation
    const markTag = `<mark class="content-highlight" data-highlight-id="${match.highlight.id}" title="Highlighted ${new Date(match.highlight.created_at * 1000).toLocaleDateString()}">${searchText}</mark>`
    
    // Only replace the first occurrence to avoid duplicates
    modifiedHTML = modifiedHTML.replace(searchText, markTag)
  }
  
  return modifiedHTML
}
