import { RelayPool } from 'applesauce-relay'
import { lastValueFrom, take } from 'rxjs'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { getContentRelays, getFallbackContentRelays, isContentRelay } from '../config/relays'
import { prioritizeLocalRelays, partitionRelays, createParallelReqStreams } from '../utils/helpers'
import { merge, toArray as rxToArray } from 'rxjs'
import { UserSettings } from './settingsService'
import { rebroadcastEvents } from './rebroadcastService'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

export interface ArticleContent {
  title: string
  markdown: string
  image?: string
  published?: number
  summary?: string
  author: string
  event: NostrEvent
}

interface CachedArticle {
  content: ArticleContent
  timestamp: number
}

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
const CACHE_PREFIX = 'article_cache_'

function getCacheKey(naddr: string): string {
  return `${CACHE_PREFIX}${naddr}`
}

export function getFromCache(naddr: string): ArticleContent | null {
  try {
    const cacheKey = getCacheKey(naddr)
    const cached = localStorage.getItem(cacheKey)
    if (!cached) {
      return null
    }

    const { content, timestamp }: CachedArticle = JSON.parse(cached)
    const age = Date.now() - timestamp

    if (age > CACHE_TTL) {
      localStorage.removeItem(cacheKey)
      return null
    }

    return content
  } catch (err) {
    // Silently handle cache read errors
    return null
  }
}

/**
 * Caches an article event to localStorage for offline access
 * @param event - The Nostr event to cache
 * @param settings - Optional user settings
 */
export function cacheArticleEvent(event: NostrEvent, settings?: UserSettings): void {
  try {
    const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
    if (!dTag || event.kind !== 30023) return

    const naddr = nip19.naddrEncode({
      kind: 30023,
      pubkey: event.pubkey,
      identifier: dTag
    })
    
    const articleContent: ArticleContent = {
      title: getArticleTitle(event) || 'Untitled Article',
      markdown: event.content,
      image: getArticleImage(event),
      published: getArticlePublished(event),
      summary: getArticleSummary(event),
      author: event.pubkey,
      event
    }
    
    saveToCache(naddr, articleContent, settings)
  } catch (err) {
    // Silently fail cache saves - quota exceeded, invalid data, etc.
  }
}

export function saveToCache(naddr: string, content: ArticleContent, settings?: UserSettings): void {
  // Respect user settings: if image caching is disabled, we could skip article caching too
  // However, for offline-first design, we default to caching unless explicitly disabled
  // Future: could add explicit enableArticleCache setting
  // For now, we cache aggressively but handle errors gracefully
  // Note: settings parameter reserved for future use
  void settings // Mark as intentionally unused for now
  try {
    const cacheKey = getCacheKey(naddr)
    const cached: CachedArticle = {
      content,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cached))
  } catch (err) {
    // Silently fail - don't block the UI if caching fails
    // Handles quota exceeded, invalid data, and other errors gracefully
  }
}

/**
 * Fetches a Nostr long-form article (NIP-23) by naddr
 * @param relayPool - The relay pool to query
 * @param naddr - The article's naddr
 * @param bypassCache - If true, skip cache and fetch fresh from relays
 * @param settings - User settings for rebroadcast options
 */
export async function fetchArticleByNaddr(
  relayPool: RelayPool,
  naddr: string,
  bypassCache = false,
  settings?: UserSettings
): Promise<ArticleContent> {
  try {
    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = getFromCache(naddr)
      if (cached) return cached
    }

    // Decode the naddr
    const decoded = nip19.decode(naddr)
    
    if (decoded.type !== 'naddr') {
      throw new Error('Invalid naddr format')
    }

    const pointer = decoded.data as AddressPointer

    // Fetch the article event
    const filter = {
      kinds: [pointer.kind],
      authors: [pointer.pubkey],
      '#d': [pointer.identifier]
    }

    let events: NostrEvent[] = []

    // First, try relay hints from naddr (primary source)
    // Filter to only content relays to avoid using auth/signer relays
    const hintedRelays = (pointer.relays && pointer.relays.length > 0)
      ? pointer.relays.filter(isContentRelay)
      : []
    
    if (hintedRelays.length > 0) {
      const orderedHintedRelays = prioritizeLocalRelays(hintedRelays)
      const { local: localHinted, remote: remoteHinted } = partitionRelays(orderedHintedRelays)
      
      const { local$, remote$ } = createParallelReqStreams(
        relayPool,
        localHinted,
        remoteHinted,
        filter,
        1200,
        6000
      )
      const collected = await lastValueFrom(
        merge(local$.pipe(take(1)), remote$.pipe(take(1))).pipe(rxToArray())
      )
      events = collected as NostrEvent[]
    }

    // Fallback: if no hints or nothing found from hints, try default content relays
    if (events.length === 0) {
      const defaultContentRelays = getContentRelays()
      const orderedDefault = prioritizeLocalRelays(defaultContentRelays)
      const { local: localDefault, remote: remoteDefault } = partitionRelays(orderedDefault)
      
      const { local$, remote$ } = createParallelReqStreams(
        relayPool,
        localDefault,
        remoteDefault,
        filter,
        1200,
        6000
      )
      const collected = await lastValueFrom(
        merge(local$.pipe(take(1)), remote$.pipe(take(1))).pipe(rxToArray())
      )
      events = collected as NostrEvent[]
    }

    // Last resort: try fallback content relays (most reliable public relays)
    if (events.length === 0) {
      const fallbackRelays = getFallbackContentRelays()
      const { remote$: fallback$ } = createParallelReqStreams(
        relayPool,
        [], // no local for fallback
        fallbackRelays,
        filter,
        1500,
        12000
      )
      const fallbackCollected = await lastValueFrom(fallback$.pipe(take(1), rxToArray()))
      events = fallbackCollected as NostrEvent[]
    }

    if (events.length === 0) {
      throw new Error('Article not found')
    }

    // Sort by created_at and take the most recent
    events.sort((a, b) => b.created_at - a.created_at)
    const article = events[0]

    // Rebroadcast article to local/all relays based on settings
    await rebroadcastEvents([article], relayPool, settings)

    const title = getArticleTitle(article) || 'Untitled Article'
    const image = getArticleImage(article)
    const published = getArticlePublished(article)
    const summary = getArticleSummary(article)

    const content: ArticleContent = {
      title,
      markdown: article.content,
      image,
      published,
      summary,
      author: article.pubkey,
      event: article
    }

    // Save to cache before returning
    saveToCache(naddr, content, settings)
    
    // Image caching is handled automatically by Service Worker
    
    return content
  } catch (err) {
    console.error('Failed to fetch article:', err)
    throw err
  }
}

/**
 * Checks if a string is a valid naddr
 */
export function isNaddr(str: string): boolean {
  try {
    const decoded = nip19.decode(str)
    return decoded.type === 'naddr'
  } catch {
    return false
  }
}
