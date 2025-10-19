import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { queryEvents } from './dataFetch'
import { KINDS } from '../config/kinds'

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
 * @param onPost - Optional callback for streaming posts
 * @param limit - Limit for number of events to fetch (default: 100, pass null for no limit)
 * @returns Array of blog post previews
 */
export const fetchBlogPostsFromAuthors = async (
  relayPool: RelayPool,
  pubkeys: string[],
  relayUrls: string[],
  onPost?: (post: BlogPostPreview) => void,
  limit: number | null = 100
): Promise<BlogPostPreview[]> => {
  try {
    if (pubkeys.length === 0) {
      return []
    }


    // Deduplicate replaceable events by keeping the most recent version
    // Group by author + d-tag identifier
    const uniqueEvents = new Map<string, NostrEvent>()

    const filter = limit !== null
      ? { kinds: [KINDS.BlogPost], authors: pubkeys, limit }
      : { kinds: [KINDS.BlogPost], authors: pubkeys }

    await queryEvents(
      relayPool,
      filter,
      {
        relayUrls,
        onEvent: (event: NostrEvent) => {
          const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
          const key = `${event.pubkey}:${dTag}`
          const existing = uniqueEvents.get(key)
          if (!existing || event.created_at > existing.created_at) {
            uniqueEvents.set(key, event)
            // Emit as we incorporate
            if (onPost) {
              const post: BlogPostPreview = {
                event,
                title: getArticleTitle(event) || 'Untitled',
                summary: getArticleSummary(event),
                image: getArticleImage(event),
                published: getArticlePublished(event),
                author: event.pubkey
              }
              onPost(post)
            }
          }
        }
      }
    )

    
    // Convert to blog post previews and sort by published date (most recent first)
    const blogPosts: BlogPostPreview[] = Array.from(uniqueEvents.values())
      .map(event => {
        const post: BlogPostPreview = {
          event,
          title: getArticleTitle(event) || 'Untitled',
          summary: getArticleSummary(event),
          image: getArticleImage(event),
          published: getArticlePublished(event),
          author: event.pubkey
        }
        if (onPost) onPost(post)
        return post
      })
      .sort((a, b) => {
        const timeA = a.published || a.event.created_at
        const timeB = b.published || b.event.created_at
        return timeB - timeA // Most recent first
      })
    
    
    return blogPosts
  } catch (error) {
    console.error('Failed to fetch blog posts:', error)
    return []
  }
}

