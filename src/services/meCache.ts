import { Highlight } from '../types/highlights'
import { Bookmark } from '../types/bookmarks'
import { BlogPostPreview } from './exploreService'
import { ReadItem } from './readsService'

export interface MeCache {
  highlights: Highlight[]
  bookmarks: Bookmark[]
  readArticles: BlogPostPreview[]
  reads?: ReadItem[]
  links?: ReadItem[]
  timestamp: number
}

const meCache = new Map<string, MeCache>() // key: pubkey

export function getCachedMeData(pubkey: string): MeCache | null {
  const entry = meCache.get(pubkey)
  if (!entry) return null
  return entry
}

export function setCachedMeData(
  pubkey: string,
  highlights: Highlight[],
  bookmarks: Bookmark[],
  readArticles: BlogPostPreview[]
): void {
  meCache.set(pubkey, {
    highlights,
    bookmarks,
    readArticles,
    timestamp: Date.now()
  })
}

export function updateCachedHighlights(pubkey: string, highlights: Highlight[]): void {
  const existing = meCache.get(pubkey)
  if (existing) {
    meCache.set(pubkey, { ...existing, highlights, timestamp: Date.now() })
  }
}

export function updateCachedBookmarks(pubkey: string, bookmarks: Bookmark[]): void {
  const existing = meCache.get(pubkey)
  if (existing) {
    meCache.set(pubkey, { ...existing, bookmarks, timestamp: Date.now() })
  }
}

export function updateCachedReadArticles(pubkey: string, readArticles: BlogPostPreview[]): void {
  const existing = meCache.get(pubkey)
  if (existing) {
    meCache.set(pubkey, { ...existing, readArticles, timestamp: Date.now() })
  }
}

