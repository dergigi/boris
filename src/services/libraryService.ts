import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, toArray } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { RELAYS } from '../config/relays'
import { prioritizeLocalRelays, partitionRelays } from '../utils/helpers'
import { MARK_AS_READ_EMOJI } from './reactionService'
import { BlogPostPreview } from './exploreService'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

export interface ReadArticle {
  id: string
  url?: string
  eventId?: string
  eventAuthor?: string
  eventKind?: number
  markedAt: number
  reactionId: string
}

/**
 * Fetches all articles that the user has marked as read
 * Returns both nostr-native articles (kind:7) and external URLs (kind:17)
 */
export async function fetchReadArticles(
  relayPool: RelayPool,
  userPubkey: string
): Promise<ReadArticle[]> {
  try {
    const orderedRelays = prioritizeLocalRelays(RELAYS)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(orderedRelays)

    // Fetch kind:7 reactions (nostr-native articles)
    const kind7Local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [7], authors: [userPubkey] })
          .pipe(
            onlyEvents(),
            completeOnEose(),
            takeUntil(timer(1200))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const kind7Remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, { kinds: [7], authors: [userPubkey] })
          .pipe(
            onlyEvents(),
            completeOnEose(),
            takeUntil(timer(6000))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const kind7Events: NostrEvent[] = await lastValueFrom(
      merge(kind7Local$, kind7Remote$).pipe(toArray())
    )

    // Fetch kind:17 reactions (external URLs)
    const kind17Local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [17], authors: [userPubkey] })
          .pipe(
            onlyEvents(),
            completeOnEose(),
            takeUntil(timer(1200))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const kind17Remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, { kinds: [17], authors: [userPubkey] })
          .pipe(
            onlyEvents(),
            completeOnEose(),
            takeUntil(timer(6000))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const kind17Events: NostrEvent[] = await lastValueFrom(
      merge(kind17Local$, kind17Remote$).pipe(toArray())
    )

    const readArticles: ReadArticle[] = []

    // Process kind:7 reactions (nostr-native articles)
    for (const event of kind7Events) {
      if (event.content === MARK_AS_READ_EMOJI) {
        const eTag = event.tags.find((t) => t[0] === 'e')
        const pTag = event.tags.find((t) => t[0] === 'p')
        const kTag = event.tags.find((t) => t[0] === 'k')

        if (eTag && eTag[1]) {
          readArticles.push({
            id: eTag[1],
            eventId: eTag[1],
            eventAuthor: pTag?.[1],
            eventKind: kTag?.[1] ? parseInt(kTag[1]) : undefined,
            markedAt: event.created_at,
            reactionId: event.id
          })
        }
      }
    }

    // Process kind:17 reactions (external URLs)
    for (const event of kind17Events) {
      if (event.content === MARK_AS_READ_EMOJI) {
        const rTag = event.tags.find((t) => t[0] === 'r')

        if (rTag && rTag[1]) {
          readArticles.push({
            id: rTag[1],
            url: rTag[1],
            markedAt: event.created_at,
            reactionId: event.id
          })
        }
      }
    }

    // Sort by markedAt (most recent first) and dedupe
    const deduped = new Map<string, ReadArticle>()
    readArticles
      .sort((a, b) => b.markedAt - a.markedAt)
      .forEach((article) => {
        if (!deduped.has(article.id)) {
          deduped.set(article.id, article)
        }
      })

    return Array.from(deduped.values())
  } catch (error) {
    console.error('Failed to fetch read articles:', error)
    return []
  }
}

/**
 * Fetches full article data for read nostr-native articles
 * and converts them to BlogPostPreview format for rendering
 */
export async function fetchReadArticlesWithData(
  relayPool: RelayPool,
  userPubkey: string
): Promise<BlogPostPreview[]> {
  try {
    // First get all read articles
    const readArticles = await fetchReadArticles(relayPool, userPubkey)
    
    // Filter to only nostr-native articles (kind 30023)
    const nostrArticles = readArticles.filter(
      article => article.eventKind === 30023 && article.eventId
    )

    if (nostrArticles.length === 0) {
      return []
    }

    const orderedRelays = prioritizeLocalRelays(RELAYS)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(orderedRelays)

    // Fetch the actual article events
    const eventIds = nostrArticles.map(a => a.eventId!).filter(Boolean)
    
    const local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [30023], ids: eventIds })
          .pipe(
            onlyEvents(),
            completeOnEose(),
            takeUntil(timer(1200))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, { kinds: [30023], ids: eventIds })
          .pipe(
            onlyEvents(),
            completeOnEose(),
            takeUntil(timer(6000))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const articleEvents: NostrEvent[] = await lastValueFrom(
      merge(local$, remote$).pipe(toArray())
    )

    // Deduplicate article events by ID
    const uniqueArticleEvents = new Map<string, NostrEvent>()
    articleEvents.forEach(event => {
      if (!uniqueArticleEvents.has(event.id)) {
        uniqueArticleEvents.set(event.id, event)
      }
    })

    // Convert to BlogPostPreview format
    const blogPosts: BlogPostPreview[] = Array.from(uniqueArticleEvents.values()).map(event => ({
      event,
      title: getArticleTitle(event) || 'Untitled Article',
      summary: getArticleSummary(event),
      image: getArticleImage(event),
      published: getArticlePublished(event),
      author: event.pubkey
    }))

    // Sort by when they were marked as read (most recent first)
    const articlesMap = new Map(nostrArticles.map(a => [a.eventId, a]))
    blogPosts.sort((a, b) => {
      const markedAtA = articlesMap.get(a.event.id)?.markedAt || 0
      const markedAtB = articlesMap.get(b.event.id)?.markedAt || 0
      return markedAtB - markedAtA
    })

    return blogPosts
  } catch (error) {
    console.error('Failed to fetch read articles with data:', error)
    return []
  }
}

