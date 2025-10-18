import { Highlight } from '../types/highlights'
import { BlogPostPreview } from '../services/exploreService'

/**
 * Deduplicate highlights by ID
 */
export function dedupeHighlightsById(highlights: Highlight[]): Highlight[] {
  const byId = new Map<string, Highlight>()
  for (const highlight of highlights) {
    byId.set(highlight.id, highlight)
  }
  return Array.from(byId.values())
}

/**
 * Deduplicate blog posts by replaceable event key (author:d-tag)
 * Keeps the newest version when duplicates exist
 */
export function dedupeWritingsByReplaceable(posts: BlogPostPreview[]): BlogPostPreview[] {
  const byKey = new Map<string, BlogPostPreview>()
  
  for (const post of posts) {
    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
    const key = `${post.author}:${dTag}`
    const existing = byKey.get(key)
    
    // Keep the newer version
    if (!existing || post.event.created_at > existing.event.created_at) {
      byKey.set(key, post)
    }
  }
  
  return Array.from(byKey.values())
}

