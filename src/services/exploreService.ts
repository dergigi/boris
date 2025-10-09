import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

export interface BlogPostPreview {
  event: NostrEvent
  title: string
  summary?: string
  image?: string
  published?: number
  author: string
}

/**
 * Fetches blog posts (kind:30023) from a list of pubkeys (friends)
 * @param relayPool - The relay pool to query
 * @param pubkeys - Array of pubkeys to fetch posts from
 * @param relayUrls - Array of relay URLs to query
 * @returns Array of blog post previews
 */
export const fetchBlogPostsFromAuthors = async (
  relayPool: RelayPool,
  pubkeys: string[],
  relayUrls: string[]
): Promise<BlogPostPreview[]> => {
  try {
    if (pubkeys.length === 0) {
      console.log('⚠️ No pubkeys to fetch blog posts from')
      return []
    }

    console.log('📚 Fetching blog posts (kind 30023) from', pubkeys.length, 'authors')
    
    const events = await lastValueFrom(
      relayPool
        .req(relayUrls, { 
          kinds: [30023], 
          authors: pubkeys,
          limit: 100 // Fetch up to 100 recent posts
        })
        .pipe(completeOnEose(), takeUntil(timer(15000)), toArray())
    )
    
    console.log('📊 Blog post events fetched:', events.length)
    
    // Deduplicate replaceable events by keeping the most recent version
    // Group by author + d-tag identifier
    const uniqueEvents = new Map<string, NostrEvent>()
    
    for (const event of events) {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
      const key = `${event.pubkey}:${dTag}`
      
      const existing = uniqueEvents.get(key)
      if (!existing || event.created_at > existing.created_at) {
        uniqueEvents.set(key, event)
      }
    }
    
    // Convert to blog post previews and sort by published date (most recent first)
    const blogPosts: BlogPostPreview[] = Array.from(uniqueEvents.values())
      .map(event => ({
        event,
        title: getArticleTitle(event) || 'Untitled',
        summary: getArticleSummary(event),
        image: getArticleImage(event),
        published: getArticlePublished(event),
        author: event.pubkey
      }))
      .sort((a, b) => {
        const timeA = a.published || a.event.created_at
        const timeB = b.published || b.event.created_at
        return timeB - timeA // Most recent first
      })
    
    console.log('📰 Processed', blogPosts.length, 'unique blog posts')
    
    return blogPosts
  } catch (error) {
    console.error('Failed to fetch blog posts:', error)
    return []
  }
}

