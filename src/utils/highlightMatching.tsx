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
 * Apply highlights to HTML content by injecting mark tags using DOM manipulation
 */
export function applyHighlightsToHTML(
  html: string,
  highlights: Highlight[]
): string {
  if (!html || highlights.length === 0) return html
  
  // Create a temporary DOM element to work with
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  console.log('🔍 applyHighlightsToHTML:', {
    htmlLength: html.length,
    highlightsCount: highlights.length,
    highlightTexts: highlights.map(h => h.content.slice(0, 50))
  })
  
  // Process each highlight
  for (const highlight of highlights) {
    const searchText = highlight.content.trim()
    if (!searchText) continue
    
    console.log('🔍 Processing highlight:', searchText.slice(0, 50))
    
    // Normalize whitespace for more flexible matching
    const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim()
    const normalizedSearch = normalizeWhitespace(searchText)
    
    // Walk through all text nodes and replace matches
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    const textNodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text)
    }
    
    // Try exact match first, then normalized match
    let found = false
    
    // First pass: exact match
    for (const textNode of textNodes) {
      const text = textNode.textContent || ''
      const index = text.indexOf(searchText)
      
      if (index !== -1) {
        console.log('✅ Found exact match in text node:', text.slice(Math.max(0, index - 20), index + 50))
        
        // Split the text node and insert the mark element
        const before = text.substring(0, index)
        const match = text.substring(index, index + searchText.length)
        const after = text.substring(index + searchText.length)
        
        const mark = document.createElement('mark')
        mark.className = 'content-highlight'
        mark.setAttribute('data-highlight-id', highlight.id)
        mark.setAttribute('title', `Highlighted ${new Date(highlight.created_at * 1000).toLocaleDateString()}`)
        mark.textContent = match
        
        const parent = textNode.parentNode
        if (parent) {
          if (before) {
            parent.insertBefore(document.createTextNode(before), textNode)
          }
          parent.insertBefore(mark, textNode)
          if (after) {
            textNode.textContent = after
          } else {
            parent.removeChild(textNode)
          }
        }
        
        found = true
        break
      }
    }
    
    // Second pass: normalized whitespace match
    if (!found) {
      for (const textNode of textNodes) {
        const text = textNode.textContent || ''
        const normalizedText = normalizeWhitespace(text)
        const index = normalizedText.indexOf(normalizedSearch)
        
        if (index !== -1) {
          console.log('✅ Found normalized match in text node:', text.slice(0, 50))
          
          // Find the actual position in the original text
          let actualIndex = 0
          let normalizedIndex = 0
          
          for (let i = 0; i < text.length && normalizedIndex < index; i++) {
            if (!/\s/.test(text[i]) || (i > 0 && !/\s/.test(text[i-1]))) {
              normalizedIndex++
            }
            actualIndex = i + 1
          }
          
          // Approximate the length in the original text
          const actualLength = searchText.length
          const match = text.substring(actualIndex, actualIndex + actualLength)
          const before = text.substring(0, actualIndex)
          const after = text.substring(actualIndex + actualLength)
          
          const mark = document.createElement('mark')
          mark.className = 'content-highlight'
          mark.setAttribute('data-highlight-id', highlight.id)
          mark.setAttribute('title', `Highlighted ${new Date(highlight.created_at * 1000).toLocaleDateString()}`)
          mark.textContent = match
          
          const parent = textNode.parentNode
          if (parent) {
            if (before) {
              parent.insertBefore(document.createTextNode(before), textNode)
            }
            parent.insertBefore(mark, textNode)
            if (after) {
              textNode.textContent = after
            } else {
              parent.removeChild(textNode)
            }
          }
          
          break
        }
      }
    }
  }
  
  const result = tempDiv.innerHTML
  console.log('🔍 HTML highlighting complete:', {
    originalLength: html.length,
    modifiedLength: result.length,
    changed: html !== result
  })
  
  return result
}
