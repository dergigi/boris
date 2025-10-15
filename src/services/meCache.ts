import { Highlight } from '../types/highlights'
import { Bookmark } from '../types/bookmarks'
import { ReadItem } from './readsService'

export interface MeCache {
  highlights: Highlight[]
  bookmarks: Bookmark[]
  reads: ReadItem[]
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
  reads: ReadItem[]
): void {
  meCache.set(pubkey, {
    highlights,
    bookmarks,
    reads,
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

export function updateCachedReads(pubkey: string, reads: ReadItem[]): void {
  const existing = meCache.get(pubkey)
  if (existing) {
    meCache.set(pubkey, { ...existing, reads, timestamp: Date.now() })
  }
}

