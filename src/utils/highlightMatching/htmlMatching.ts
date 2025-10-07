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
    console.log('⚠️ applyHighlightsToHTML: No HTML or highlights', { 
      htmlLength: html?.length, 
      highlightsCount: highlights.length 
    })
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

