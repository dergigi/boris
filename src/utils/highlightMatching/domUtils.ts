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
  let endIndex = matchIndex + searchText.length
  
  if (useNormalized) {
    // This is a simplified mapping - for normalized matches we approximate
    const ratio = combinedText.length / searchIn.length
    startIndex = Math.floor(matchIndex * ratio)
    endIndex = Math.min(combinedText.length, startIndex + searchText.length)
  }
  
  // Find which nodes contain the match
  const affectedNodes: Array<{ node: Text; startOffset: number; endOffset: number }> = []
  
  for (const nodeInfo of nodeMap) {
    if (startIndex < nodeInfo.end && endIndex > nodeInfo.start) {
      const nodeStart = Math.max(0, startIndex - nodeInfo.start)
      const nodeEnd = Math.min(nodeInfo.originalText.length, endIndex - nodeInfo.start)
      affectedNodes.push({ node: nodeInfo.node, startOffset: nodeStart, endOffset: nodeEnd })
    }
  }
  
  if (affectedNodes.length === 0) return false
  
  // Create a Range to wrap the entire selection in a single mark element
  const range = document.createRange()
  const firstNode = affectedNodes[0]
  const lastNode = affectedNodes[affectedNodes.length - 1]
  
  range.setStart(firstNode.node, firstNode.startOffset)
  range.setEnd(lastNode.node, lastNode.endOffset)
  
  // Extract the content from the range
  const extractedContent = range.extractContents()
  
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
}

