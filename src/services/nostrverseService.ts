import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { Helpers, IEventStore } from 'applesauce-core'
import { BlogPostPreview } from './exploreService'
import { Highlight } from '../types/highlights'
import { eventToHighlight, dedupeHighlights, sortHighlights } from './highlightEventProcessor'
import { queryEvents } from './dataFetch'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

/**
 * Fetches public blog posts (kind:30023) from the nostrverse (not filtered by author)
 * @param relayPool - The relay pool to query
 * @param relayUrls - Array of relay URLs to query
 * @param limit - Maximum number of posts to fetch (default: 50)
 * @param eventStore - Optional event store to persist fetched events
 * @returns Array of blog post previews
 */
export const fetchNostrverseBlogPosts = async (
  relayPool: RelayPool,
  relayUrls: string[],
  limit = 50,
  eventStore?: IEventStore,
  onPost?: (post: BlogPostPreview) => void
): Promise<BlogPostPreview[]> => {
  try {
    console.log('[NOSTRVERSE] 📚 Fetching blog posts (kind 30023), limit:', limit)

    // Deduplicate replaceable events by keeping the most recent version
    const uniqueEvents = new Map<string, NostrEvent>()

    await queryEvents(
      relayPool,
      { kinds: [30023], limit },
      {
        relayUrls,
        onEvent: (event: NostrEvent) => {
          // Store in event store if provided
          if (eventStore) {
            eventStore.add(event)
          }
          
          const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
          const key = `${event.pubkey}:${dTag}`
          const existing = uniqueEvents.get(key)
          if (!existing || event.created_at > existing.created_at) {
            uniqueEvents.set(key, event)

            // Stream post immediately if callback provided
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

    console.log('[NOSTRVERSE] 📊 Blog post events fetched (unique):', uniqueEvents.size)
    
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
    
    console.log('[NOSTRVERSE] 📰 Processed', blogPosts.length, 'unique blog posts')
    
    return blogPosts
  } catch (error) {
    console.error('Failed to fetch nostrverse blog posts:', error)
    return []
  }
}

/**
 * Fetches public highlights (kind:9802) from the nostrverse (not filtered by author)
 * @param relayPool - The relay pool to query
 * @param limit - Maximum number of highlights to fetch (default: 100)
 * @param eventStore - Optional event store to persist fetched events
 * @returns Array of highlights
 */
export const fetchNostrverseHighlights = async (
  relayPool: RelayPool,
  limit = 100,
  eventStore?: IEventStore
): Promise<Highlight[]> => {
  try {
    console.log('[NOSTRVERSE] 💡 Fetching highlights (kind 9802), limit:', limit)

    const seenIds = new Set<string>()
    const rawEvents = await queryEvents(
      relayPool,
      { kinds: [9802], limit },
      {
        onEvent: (event: NostrEvent) => {
          if (seenIds.has(event.id)) return
          seenIds.add(event.id)
          
          // Store in event store if provided
          if (eventStore) {
            eventStore.add(event)
          }
        }
      }
    )

    // Store all events in event store if provided (in case some were missed in streaming)
    if (eventStore) {
      rawEvents.forEach(evt => eventStore.add(evt))
    }

    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights = uniqueEvents.map(eventToHighlight)
    
    console.log('[NOSTRVERSE] 💡 Processed', highlights.length, 'unique highlights')
    
    return sortHighlights(highlights)
  } catch (error) {
    console.error('Failed to fetch nostrverse highlights:', error)
    return []
  }
}

