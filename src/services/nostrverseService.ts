import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { prioritizeLocalRelays, partitionRelays } from '../utils/helpers'
import { Helpers } from 'applesauce-core'
import { BlogPostPreview } from './exploreService'
import { Highlight } from '../types/highlights'
import { eventToHighlight, dedupeHighlights, sortHighlights } from './highlightEventProcessor'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

/**
 * Fetches public blog posts (kind:30023) from the nostrverse (not filtered by author)
 * @param relayPool - The relay pool to query
 * @param relayUrls - Array of relay URLs to query
 * @param limit - Maximum number of posts to fetch (default: 50)
 * @returns Array of blog post previews
 */
export const fetchNostrverseBlogPosts = async (
  relayPool: RelayPool,
  relayUrls: string[],
  limit = 50
): Promise<BlogPostPreview[]> => {
  try {
    console.log('📚 Fetching nostrverse blog posts (kind 30023), limit:', limit)
    
    const prioritized = prioritizeLocalRelays(relayUrls)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(prioritized)

    // Deduplicate replaceable events by keeping the most recent version
    const uniqueEvents = new Map<string, NostrEvent>()

    const processEvents = (incoming: NostrEvent[]) => {
      for (const event of incoming) {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
        const key = `${event.pubkey}:${dTag}`
        const existing = uniqueEvents.get(key)
        if (!existing || event.created_at > existing.created_at) {
          uniqueEvents.set(key, event)
        }
      }
    }

    const local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [30023], limit })
          .pipe(completeOnEose(), takeUntil(timer(1200)), onlyEvents())
      : new Observable<NostrEvent>((sub) => sub.complete())
    const remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, { kinds: [30023], limit })
          .pipe(completeOnEose(), takeUntil(timer(6000)), onlyEvents())
      : new Observable<NostrEvent>((sub) => sub.complete())
    const events = await lastValueFrom(merge(local$, remote$).pipe(toArray()))
    processEvents(events)

    console.log('📊 Nostrverse blog post events fetched (unique):', uniqueEvents.size)
    
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
    
    console.log('📰 Processed', blogPosts.length, 'unique nostrverse blog posts')
    
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
 * @returns Array of highlights
 */
export const fetchNostrverseHighlights = async (
  relayPool: RelayPool,
  limit = 100
): Promise<Highlight[]> => {
  try {
    console.log('💡 Fetching nostrverse highlights (kind 9802), limit:', limit)
    
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    const prioritized = prioritizeLocalRelays(relayUrls)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(prioritized)

    const local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [9802], limit })
          .pipe(completeOnEose(), takeUntil(timer(1200)), onlyEvents())
      : new Observable<NostrEvent>((sub) => sub.complete())
      
    const remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, { kinds: [9802], limit })
          .pipe(completeOnEose(), takeUntil(timer(6000)), onlyEvents())
      : new Observable<NostrEvent>((sub) => sub.complete())
      
    const rawEvents: NostrEvent[] = await lastValueFrom(merge(local$, remote$).pipe(toArray()))

    const uniqueEvents = dedupeHighlights(rawEvents)
    const highlights = uniqueEvents.map(eventToHighlight)
    
    console.log('💡 Processed', highlights.length, 'unique nostrverse highlights')
    
    return sortHighlights(highlights)
  } catch (error) {
    console.error('Failed to fetch nostrverse highlights:', error)
    return []
  }
}

