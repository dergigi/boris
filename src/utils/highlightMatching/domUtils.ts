import { Highlight } from '../../types/highlights'
import { normalizeWhitespace } from './textMatching'

/**
 * Create a mark element for a highlight
 */
export function createMarkElement(
  highlight: Highlight, 
  matchText: string, 
  highlightStyle: 'marker' | 'underline' = 'marker'
): HTMLElement {
  const mark = document.createElement('mark')
  const levelClass = highlight.level ? ` level-${highlight.level}` : ''
  mark.className = `content-highlight-${highlightStyle}${levelClass}`
  mark.setAttribute('data-highlight-id', highlight.id)
  mark.setAttribute('data-highlight-level', highlight.level || 'nostrverse')
  mark.setAttribute('title', `Highlighted ${new Date(highlight.created_at * 1000).toLocaleDateString()}`)
  mark.textContent = matchText
  return mark
}

/**
 * Replace text node with mark element
 */
export function replaceTextWithMark(
  textNode: Text, 
  before: string, 
  after: string, 
  mark: HTMLElement
): void {
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

/**
 * Try to find and mark text in text nodes
 */
export function tryMarkInTextNodes(
  textNodes: Text[],
  searchText: string,
  highlight: Highlight,
  useNormalized: boolean,
  highlightStyle: 'marker' | 'underline' = 'marker'
): boolean {
  const normalizedSearch = normalizeWhitespace(searchText)
  
  // First try: Single text node match
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
    
    // Validate the match makes sense (not just whitespace or empty)
    if (!match || match.trim().length === 0) {
      console.warn('Invalid match (empty or whitespace only)')
      continue
    }
    
    const mark = createMarkElement(highlight, match, highlightStyle)
    
    replaceTextWithMark(textNode, before, after, mark)
    return true
  }
  
  // Second try: Multi-node match (for text spanning multiple elements)
  return tryMultiNodeMatch(textNodes, searchText, highlight, useNormalized, highlightStyle)
}

/**
 * Try to find and mark text that spans multiple text nodes
 */
function tryMultiNodeMatch(
  textNodes: Text[],
  searchText: string,
  highlight: Highlight,
  useNormalized: boolean,
  highlightStyle: 'marker' | 'underline' = 'marker'
): boolean {
  const normalizedSearch = normalizeWhitespace(searchText)
  
  // Build a combined text from all nodes
  let combinedText = ''
  const nodeMap: Array<{ node: Text; start: number; end: number; originalText: string }> = []
  
  for (const node of textNodes) {
    const text = node.textContent || ''
    const start = combinedText.length
    const end = start + text.length
    nodeMap.push({ node, start, end, originalText: text })
    combinedText += text
  }
  
  // Search in combined text
  const searchIn = useNormalized ? normalizeWhitespace(combinedText) : combinedText
  const searchFor = useNormalized ? normalizedSearch : searchText
  const matchIndex = searchIn.indexOf(searchFor)
  
  if (matchIndex === -1) return false
  
  // Map normalized index back to original if needed
  let startIndex = matchIndex
  let endIndex = matchIndex + searchFor.length
  
  if (useNormalized) {
    // Build proper mapping from normalized to original positions
    let normPos = 0
    const posMap: number[] = [] // Maps normalized position to original position
    
    let i = 0
    while (i < combinedText.length) {
      const char = combinedText[i]
      const isWhitespace = /\s/.test(char)
      
      if (isWhitespace) {
        // In normalized text, consecutive whitespace becomes one space
        // Map this normalized position to the start of whitespace sequence
        posMap[normPos] = i
        
        // Skip remaining consecutive whitespace
        while (i + 1 < combinedText.length && /\s/.test(combinedText[i + 1])) {
          i++
        }
        // Move past the last whitespace character
        i++
        normPos++
      } else {
        // Non-whitespace character maps directly
        posMap[normPos] = i
        i++
        normPos++
      }
    }
    
    // Add final position for end-of-text
    posMap[normPos] = combinedText.length
    
    // Map the match indices
    if (matchIndex < 0 || matchIndex >= posMap.length) {
      console.warn('Start index out of bounds:', { matchIndex, posMapLength: posMap.length })
      return false
    }
    startIndex = posMap[matchIndex]
    
    const endPos = matchIndex + searchFor.length
    if (endPos < 0 || endPos >= posMap.length) {
      console.warn('End index out of bounds:', { endPos, posMapLength: posMap.length })
      return false
    }
    endIndex = posMap[endPos]
    
    // Validate we got valid positions
    if (startIndex < 0 || endIndex <= startIndex || endIndex > combinedText.length) {
      console.warn('Could not map normalized positions:', { 
        matchIndex, 
        searchForLength: searchFor.length,
        startIndex,
        endIndex,
        combinedTextLength: combinedText.length 
      })
      return false
    }
  }
  
  // Validate indices
  if (startIndex < 0 || endIndex > combinedText.length || startIndex >= endIndex) {
    console.warn('Invalid highlight range:', { startIndex, endIndex, combinedTextLength: combinedText.length })
    return false
  }
  
  // Find which nodes contain the match
  const affectedNodes: Array<{ node: Text; startOffset: number; endOffset: number }> = []
  
  for (const nodeInfo of nodeMap) {
    if (startIndex < nodeInfo.end && endIndex > nodeInfo.start) {
      const nodeStart = Math.max(0, startIndex - nodeInfo.start)
      const nodeEnd = Math.min(nodeInfo.originalText.length, endIndex - nodeInfo.start)
      
      // Validate node offsets
      if (nodeStart < 0 || nodeEnd > nodeInfo.originalText.length || nodeStart > nodeEnd) {
        console.warn('Invalid node offsets:', { nodeStart, nodeEnd, nodeLength: nodeInfo.originalText.length })
        continue
      }
      
      affectedNodes.push({ node: nodeInfo.node, startOffset: nodeStart, endOffset: nodeEnd })
    }
  }
  
  if (affectedNodes.length === 0) {
    console.warn('No affected nodes found for highlight')
    return false
  }
  
  try {
    // Create a Range to wrap the entire selection in a single mark element
    const range = document.createRange()
    const firstNode = affectedNodes[0]
    const lastNode = affectedNodes[affectedNodes.length - 1]
    
    range.setStart(firstNode.node, firstNode.startOffset)
    range.setEnd(lastNode.node, lastNode.endOffset)
    
    // Verify the range isn't collapsed or invalid
    if (range.collapsed) {
      console.warn('Range is collapsed, skipping highlight')
      return false
    }
    
    // Get the text content before extraction to verify it matches
    const rangeText = range.toString()
    const normalizedRangeText = normalizeWhitespace(rangeText)
    const normalizedSearchText = normalizeWhitespace(searchText)
    
    // Validate that the extracted text matches what we're searching for
    if (!rangeText.includes(searchText) && 
        !normalizedRangeText.includes(normalizedSearchText) &&
        normalizedRangeText !== normalizedSearchText) {
      console.warn('Range text does not match search text:', {
        rangeText: rangeText.substring(0, 100),
        searchText: searchText.substring(0, 100),
        rangeLength: rangeText.length,
        searchLength: searchText.length
      })
      return false
    }
    
    // Extract the content from the range
    const extractedContent = range.extractContents()
    
    // Verify we actually extracted something
    if (!extractedContent || extractedContent.childNodes.length === 0) {
      console.warn('No content extracted from range')
      return false
    }
    
    // Create a single mark element
    const mark = document.createElement('mark')
    const levelClass = highlight.level ? ` level-${highlight.level}` : ''
    mark.className = `content-highlight-${highlightStyle}${levelClass}`
    mark.setAttribute('data-highlight-id', highlight.id)
    mark.setAttribute('data-highlight-level', highlight.level || 'nostrverse')
    mark.setAttribute('title', `Highlighted ${new Date(highlight.created_at * 1000).toLocaleDateString()}`)
    
    // Append the extracted content to the mark
    mark.appendChild(extractedContent)
    
    // Insert the mark at the range position
    range.insertNode(mark)
    
    return true
  } catch (error) {
    console.error('Error applying multi-node highlight:', error)
    return false
  }
}

