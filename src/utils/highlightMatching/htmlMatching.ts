import { Highlight } from '../../types/highlights'
import { tryMarkInTextNodes } from './domUtils'

interface CacheEntry {
  html: string
  timestamp: number
}

// Simple in-memory cache for highlighted HTML results
const highlightCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 50 // FIFO eviction after this many entries

/**
 * Generate cache key from content and highlights
 */
function getCacheKey(html: string, highlights: Highlight[], highlightStyle: string): string {
  // Create a stable key from content hash (first 200 chars) and highlight IDs
  const contentHash = html.slice(0, 200).replace(/\s+/g, ' ').trim()
  const highlightIds = highlights
    .map(h => h.id)
    .sort()
    .join(',')
  return `${contentHash.length}:${highlightIds}:${highlightStyle}`
}

/**
 * Clean up old cache entries and enforce size limit
 */
function cleanupCache(): void {
  const now = Date.now()
  const entries = Array.from(highlightCache.entries())
  
  // Remove expired entries
  for (const [key, entry] of entries) {
    if (now - entry.timestamp > CACHE_TTL) {
      highlightCache.delete(key)
    }
  }
  
  // Enforce size limit with FIFO eviction (oldest first)
  if (highlightCache.size > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(highlightCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = sortedEntries.slice(0, highlightCache.size - MAX_CACHE_SIZE)
    for (const [key] of toRemove) {
      highlightCache.delete(key)
    }
  }
}

/**
 * Apply highlights to HTML content by injecting mark tags using DOM manipulation
 */
export function applyHighlightsToHTML(
  html: string, 
  highlights: Highlight[], 
  highlightStyle: 'marker' | 'underline' = 'marker'
): string {
  if (!html || highlights.length === 0) {
    return html
  }
  
  // Check cache
  const cacheKey = getCacheKey(html, highlights, highlightStyle)
  const cached = highlightCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.html
  }
  
  // Clean up cache periodically
  cleanupCache()
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Collect all text nodes once before processing highlights (performance optimization)
  const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) textNodes.push(node as Text)
  
  for (const highlight of highlights) {
    const searchText = highlight.content.trim()
    if (!searchText) {
      console.warn('⚠️ Empty highlight content:', highlight.id)
      continue
    }
    
    // Try exact match first, then normalized match
    const found = tryMarkInTextNodes(textNodes, searchText, highlight, false, highlightStyle) ||
                  tryMarkInTextNodes(textNodes, searchText, highlight, true, highlightStyle)
    
    if (!found) {
      console.warn('❌ Could not find match for highlight:', searchText.substring(0, 50))
    }
  }
  
  const result = tempDiv.innerHTML
  
  // Store in cache
  highlightCache.set(cacheKey, {
    html: result,
    timestamp: Date.now()
  })
  
  return result
}

