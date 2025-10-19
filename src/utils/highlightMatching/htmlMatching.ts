import { Highlight } from '../../types/highlights'
import { tryMarkInTextNodes } from './domUtils'

/**
 * Apply highlights to HTML content by injecting mark tags using DOM manipulation
 */
export function applyHighlightsToHTML(
  html: string, 
  highlights: Highlight[], 
  highlightStyle: 'marker' | 'underline' = 'marker'
): string {
  if (!html || highlights.length === 0) {
      htmlLength: html?.length, 
      highlightsCount: highlights.length 
    })
    return html
  }
  
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // CRITICAL: Remove any existing highlight marks to start with clean HTML
  // This prevents old broken highlights from corrupting the new rendering
  const existingMarks = tempDiv.querySelectorAll('mark[data-highlight-id]')
  existingMarks.forEach(mark => {
    // Replace the mark with its text content
    const textNode = document.createTextNode(mark.textContent || '')
    mark.parentNode?.replaceChild(textNode, mark)
  })
  
  
  let appliedCount = 0
  
  for (const highlight of highlights) {
    const searchText = highlight.content.trim()
    if (!searchText) {
      console.warn('⚠️ Empty highlight content:', highlight.id)
      continue
    }
    
    
    // Collect all text nodes
    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null)
    const textNodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) textNodes.push(node as Text)
    
    
    // Try exact match first, then normalized match
    const found = tryMarkInTextNodes(textNodes, searchText, highlight, false, highlightStyle) ||
                  tryMarkInTextNodes(textNodes, searchText, highlight, true, highlightStyle)
    
    if (found) {
      appliedCount++
    } else {
      console.warn('❌ Could not find match for highlight:', searchText.substring(0, 50))
    }
  }
  
  
  return tempDiv.innerHTML
}

