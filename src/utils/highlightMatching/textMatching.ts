import { Highlight } from '../../types/highlights'

export interface HighlightMatch {
  highlight: Highlight
  startIndex: number
  endIndex: number
}

/**
 * Normalize whitespace for flexible matching
 */
export const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim()

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
  
  return matches.sort((a, b) => a.startIndex - b.startIndex)
}

