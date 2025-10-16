import { ReadItem } from '../services/readsService'

/**
 * Merges a ReadItem into a state map, returning whether the state changed.
 * Uses most recent reading activity to determine precedence.
 */
export function mergeReadItem(
  stateMap: Map<string, ReadItem>,
  incoming: ReadItem
): boolean {
  const existing = stateMap.get(incoming.id)
  
  if (!existing) {
    stateMap.set(incoming.id, incoming)
    return true
  }
  
  // Merge by taking the most recent reading activity
  const existingTime = existing.readingTimestamp || existing.markedAt || 0
  const incomingTime = incoming.readingTimestamp || incoming.markedAt || 0
  
  if (incomingTime > existingTime) {
    // Keep existing data, but update with newer reading metadata
    stateMap.set(incoming.id, {
      ...existing,
      ...incoming,
      // Preserve event data if incoming doesn't have it
      event: incoming.event || existing.event,
      title: incoming.title || existing.title,
      summary: incoming.summary || existing.summary,
      image: incoming.image || existing.image,
      published: incoming.published || existing.published,
      author: incoming.author || existing.author
    })
    return true
  }
  
  // If timestamps are equal but incoming has additional data, merge it
  if (incomingTime === existingTime && (!existing.event && incoming.event || !existing.title && incoming.title)) {
    stateMap.set(incoming.id, {
      ...existing,
      ...incoming,
      event: incoming.event || existing.event,
      title: incoming.title || existing.title,
      summary: incoming.summary || existing.summary,
      image: incoming.image || existing.image,
      published: incoming.published || existing.published,
      author: incoming.author || existing.author
    })
    return true
  }
  
  return false
}

/**
 * Extracts a readable title from a URL when no title is available.
 * Removes protocol, www, and shows domain + path.
 */
export function fallbackTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    let title = parsed.hostname.replace(/^www\./, '')
    if (parsed.pathname && parsed.pathname !== '/') {
      const path = parsed.pathname.slice(0, 40)
      title += path.length < parsed.pathname.length ? path + '...' : path
    }
    return title
  } catch {
    // If URL parsing fails, just return the URL truncated
    return url.length > 50 ? url.slice(0, 47) + '...' : url
  }
}

