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

