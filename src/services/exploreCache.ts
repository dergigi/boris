import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../types/highlights'

export interface CachedBlogPostPreview {
  event: NostrEvent
  title: string
  summary?: string
  image?: string
  published?: number
  author: string
}

type CacheValue = {
  posts: CachedBlogPostPreview[]
  highlights: Highlight[]
  timestamp: number
}

const exploreCache = new Map<string, CacheValue>() // key: pubkey

export function getCachedPosts(pubkey: string): CachedBlogPostPreview[] | null {
  const entry = exploreCache.get(pubkey)
  if (!entry) return null
  return entry.posts
}

export function getCachedHighlights(pubkey: string): Highlight[] | null {
  const entry = exploreCache.get(pubkey)
  if (!entry) return null
  return entry.highlights
}

export function setCachedPosts(pubkey: string, posts: CachedBlogPostPreview[]): void {
  const current = exploreCache.get(pubkey)
  exploreCache.set(pubkey, { 
    posts, 
    highlights: current?.highlights || [],
    timestamp: Date.now() 
  })
}

export function setCachedHighlights(pubkey: string, highlights: Highlight[]): void {
  const current = exploreCache.get(pubkey)
  exploreCache.set(pubkey, { 
    posts: current?.posts || [],
    highlights,
    timestamp: Date.now() 
  })
}

export function upsertCachedPost(pubkey: string, post: CachedBlogPostPreview): CachedBlogPostPreview[] {
  const current = exploreCache.get(pubkey)?.posts || []
  const byId = new Map(current.map(p => [p.event.id, p]))
  byId.set(post.event.id, post)
  const merged = Array.from(byId.values()).sort((a, b) => {
    const ta = a.published || a.event.created_at
    const tb = b.published || b.event.created_at
    return tb - ta
  })
  setCachedPosts(pubkey, merged)
  return merged
}

export function upsertCachedHighlight(pubkey: string, highlight: Highlight): Highlight[] {
  const current = exploreCache.get(pubkey)?.highlights || []
  const byId = new Map(current.map(h => [h.id, h]))
  byId.set(highlight.id, highlight)
  const merged = Array.from(byId.values()).sort((a, b) => b.created_at - a.created_at)
  setCachedHighlights(pubkey, merged)
  return merged
}


