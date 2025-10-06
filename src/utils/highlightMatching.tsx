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
    let index = content.indexOf(searchText, startIndex)
    while (index !== -1) {
      matches.push({
        highlight,
        startIndex: index,
        endIndex: index + searchText.length
      })
      
      startIndex = index + searchText.length
      index = content.indexOf(searchText, startIndex)
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
  
  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex))
  }
  
  return <>{result}</>
}

// Helper to normalize whitespace for flexible matching
const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim()

// Helper to create a mark element for a highlight
function createMarkElement(highlight: Highlight, matchText: string, highlightStyle: 'marker' | 'underline' = 'marker'): HTMLElement {
  const mark = document.createElement('mark')
  const levelClass = highlight.level ? ` level-${highlight.level}` : ''
  mark.className = `content-highlight-${highlightStyle}${levelClass}`
  mark.setAttribute('data-highlight-id', highlight.id)
  mark.setAttribute('data-highlight-level', highlight.level || 'nostrverse')
  mark.setAttribute('title', `Highlighted ${new Date(highlight.created_at * 1000).toLocaleDateString()}`)
  mark.textContent = matchText
  return mark
}

// Helper to replace text node with mark element
function replaceTextWithMark(textNode: Text, before: string, after: string, mark: HTMLElement) {
  const parent = textNode.parentNode
  if (!parent) return
  
  if (before) parent.insertBefore(document.createTextNode(before), textNode)
  parent.insertBefore(mark, textNode)
  if (after) {
    textNode.textContent = after
  } else {
    parent.removeChild(textNode)
  }
}

// Helper to find and mark text in nodes
function tryMarkInTextNodes(
  textNodes: Text[],
  searchText: string,
  highlight: Highlight,
  useNormalized: boolean,
  highlightStyle: 'marker' | 'underline' = 'marker'
): boolean {
  const normalizedSearch = normalizeWhitespace(searchText)
  
  for (const textNode of textNodes) {
    const text = textNode.textContent || ''
    const searchIn = useNormalized ? normalizeWhitespace(text) : text
    const searchFor = useNormalized ? normalizedSearch : searchText
    const index = searchIn.indexOf(searchFor)
    
    if (index === -1) continue
    
    let actualIndex = index
    if (useNormalized) {
      // Map normalized index back to original text
      let normalizedIdx = 0
      for (let i = 0; i < text.length && normalizedIdx < index; i++) {
        if (!/\s/.test(text[i]) || (i > 0 && !/\s/.test(text[i-1]))) normalizedIdx++
        actualIndex = i + 1
      }
    }
    
    const before = text.substring(0, actualIndex)
    const match = text.substring(actualIndex, actualIndex + searchText.length)
    const after = text.substring(actualIndex + searchText.length)
    const mark = createMarkElement(highlight, match, highlightStyle)
    
    replaceTextWithMark(textNode, before, after, mark)
    return true
  }
  
  return false
}

/**
 * Apply highlights to HTML content by injecting mark tags using DOM manipulation
 */
export function applyHighlightsToHTML(html: string, highlights: Highlight[], highlightStyle: 'marker' | 'underline' = 'marker'): string {
  if (!html || highlights.length === 0) {
    console.log('⚠️ applyHighlightsToHTML: No HTML or highlights', { htmlLength: html?.length, highlightsCount: highlights.length })
    return html
  }
  
  console.log('🔨 applyHighlightsToHTML: Processing', highlights.length, 'highlights')
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  let appliedCount = 0
  
  for (const highlight of highlights) {
    const searchText = highlight.content.trim()
    if (!searchText) {
      console.warn('⚠️ Empty highlight content:', highlight.id)
      continue
    }
    
    console.log('🔍 Searching for highlight:', searchText.substring(0, 50) + '...')
    
    // Collect all text nodes
    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null)
    const textNodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) textNodes.push(node as Text)
    
    console.log('📄 Found', textNodes.length, 'text nodes to search')
    
    // Try exact match first, then normalized match
    const found = tryMarkInTextNodes(textNodes, searchText, highlight, false, highlightStyle) ||
                  tryMarkInTextNodes(textNodes, searchText, highlight, true, highlightStyle)
    
    if (found) {
      appliedCount++
      console.log('✅ Highlight applied successfully')
    } else {
      console.warn('❌ Could not find match for highlight:', searchText.substring(0, 50))
    }
  }
  
  console.log('🎉 Applied', appliedCount, '/', highlights.length, 'highlights')
  
  return tempDiv.innerHTML
}
