import { NostrEvent } from 'nostr-tools'

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
  timestamp: number
}

const exploreCache = new Map<string, CacheValue>() // key: pubkey

export function getCachedPosts(pubkey: string): CachedBlogPostPreview[] | null {
  const entry = exploreCache.get(pubkey)
  if (!entry) return null
  return entry.posts
}

export function setCachedPosts(pubkey: string, posts: CachedBlogPostPreview[]): void {
  exploreCache.set(pubkey, { posts, timestamp: Date.now() })
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


