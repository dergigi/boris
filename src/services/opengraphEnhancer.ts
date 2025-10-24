import { fetch } from 'fetch-opengraph'
import { ReadItem } from './readsService'

// Cache for OpenGraph data to avoid repeated requests
const ogCache = new Map<string, any>()
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CachedOgData {
  data: any
  timestamp: number
}

function getCachedOgData(url: string): any | null {
  const cached = ogCache.get(url)
  if (!cached) return null
  
  const age = Date.now() - cached.timestamp
  if (age > CACHE_TTL) {
    ogCache.delete(url)
    return null
  }
  
  return cached.data
}

function setCachedOgData(url: string, data: any): void {
  ogCache.set(url, {
    data,
    timestamp: Date.now()
  })
}

/**
 * Enhances a ReadItem with OpenGraph data
 * Only fetches if the item doesn't already have good metadata
 */
export async function enhanceReadItemWithOpenGraph(item: ReadItem): Promise<ReadItem> {
  // Skip if we already have good metadata
  if (item.title && item.title !== fallbackTitleFromUrl(item.url || '') && item.image) {
    return item
  }
  
  if (!item.url) return item
  
  try {
    // Check cache first
    let ogData = getCachedOgData(item.url)
    
    if (!ogData) {
      // Fetch OpenGraph data
      ogData = await fetch(item.url)
      setCachedOgData(item.url, ogData)
    }
    
    if (!ogData) return item
    
    // Enhance the item with OpenGraph data
    const enhanced: ReadItem = { ...item }
    
    // Use OpenGraph title if we don't have a good title
    if (!enhanced.title || enhanced.title === fallbackTitleFromUrl(item.url)) {
      enhanced.title = ogData['og:title'] || ogData['twitter:title'] || ogData.title || enhanced.title
    }
    
    // Use OpenGraph description if we don't have a summary
    if (!enhanced.summary) {
      enhanced.summary = ogData['og:description'] || ogData['twitter:description'] || ogData.description
    }
    
    // Use OpenGraph image if we don't have an image
    if (!enhanced.image) {
      enhanced.image = ogData['og:image'] || ogData['twitter:image'] || ogData.image
    }
    
    return enhanced
  } catch (error) {
    console.warn('Failed to enhance ReadItem with OpenGraph data:', error)
    return item
  }
}

/**
 * Enhances multiple ReadItems with OpenGraph data in parallel
 * Uses batching to avoid overwhelming the service
 */
export async function enhanceReadItemsWithOpenGraph(items: ReadItem[]): Promise<ReadItem[]> {
  const BATCH_SIZE = 5
  const BATCH_DELAY = 1000 // 1 second between batches
  
  const enhancedItems: ReadItem[] = []
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    
    // Process batch in parallel
    const batchPromises = batch.map(item => enhanceReadItemWithOpenGraph(item))
    const batchResults = await Promise.all(batchPromises)
    enhancedItems.push(...batchResults)
    
    // Add delay between batches to be respectful to the service
    if (i + BATCH_SIZE < items.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
    }
  }
  
  return enhancedItems
}

// Helper function to generate fallback title from URL
function fallbackTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return url
  }
}
