import { Highlight } from '../../types/highlights'

interface CacheEntry {
  highlights: Highlight[]
  timestamp: number
}

/**
 * Simple in-memory session cache for highlight queries with TTL
 */
class HighlightCache {
  private cache = new Map<string, CacheEntry>()
  private ttlMs = 60000 // 60 seconds

  /**
   * Generate cache key for article coordinate
   */
  articleKey(coordinate: string): string {
    return `article:${coordinate}`
  }

  /**
   * Generate cache key for URL
   */
  urlKey(url: string): string {
    // Normalize URL for consistent caching
    try {
      const normalized = new URL(url)
      normalized.hash = '' // Remove hash
      return `url:${normalized.toString()}`
    } catch {
      return `url:${url}`
    }
  }

  /**
   * Generate cache key for author pubkey
   */
  authorKey(pubkey: string): string {
    return `author:${pubkey}`
  }

  /**
   * Get cached highlights if not expired
   */
  get(key: string): Highlight[] | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      return null
    }

    return entry.highlights
  }

  /**
   * Store highlights in cache
   */
  set(key: string, highlights: Highlight[]): void {
    this.cache.set(key, {
      highlights,
      timestamp: Date.now()
    })
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Singleton instance
export const highlightCache = new HighlightCache()

