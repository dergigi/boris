import { RelayPool } from 'applesauce-relay'
import { lastValueFrom, take } from 'rxjs'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { RELAYS } from '../config/relays'
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
    console.log('[article-cache] Checking cache with key:', cacheKey)
    const cached = localStorage.getItem(cacheKey)
    if (!cached) {
      console.log('[article-cache] ❌ No cached entry found')
      return null
    }

    const { content, timestamp }: CachedArticle = JSON.parse(cached)
    const age = Date.now() - timestamp
    console.log('[article-cache] Found cached entry', {
      age: age,
      ageDays: Math.floor(age / (24 * 60 * 60 * 1000)),
      ttlDays: Math.floor(CACHE_TTL / (24 * 60 * 60 * 1000)),
      isExpired: age > CACHE_TTL
    })

    if (age > CACHE_TTL) {
      console.log('[article-cache] ⚠️ Cache expired, removing')
      localStorage.removeItem(cacheKey)
      return null
    }

    console.log('[article-cache] ✅ Cache valid, returning content', {
      title: content.title,
      hasMarkdown: !!content.markdown,
      markdownLength: content.markdown?.length
    })
    return content
  } catch (err) {
    console.warn('[article-cache] Error reading cache:', err)
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
    console.warn('[article-cache] Failed to cache article event:', err)
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
    console.log('[article-cache] 💾 Saving to cache', {
      key: cacheKey,
      title: content.title,
      hasMarkdown: !!content.markdown,
      markdownLength: content.markdown?.length
    })
    const cached: CachedArticle = {
      content,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cached))
    console.log('[article-cache] ✅ Successfully saved to cache')
  } catch (err) {
    // Handle quota exceeded errors specifically
    if (err instanceof DOMException && (err.code === 22 || err.code === 1014 || err.name === 'QuotaExceededError')) {
      console.warn('[article-cache] ⚠️ Storage quota exceeded - article not cached:', {
        title: content.title,
        error: err.message
      })
    } else {
      console.warn('[article-cache] Failed to cache article:', err)
    }
    // Silently fail - don't block the UI if caching fails
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

    // Define relays to query - use union of relay hints from naddr and configured relays
    // This avoids failures when naddr contains stale/unreachable relay hints
    const hintedRelays = (pointer.relays && pointer.relays.length > 0) ? pointer.relays : []
    const baseRelays = Array.from(new Set<string>([...hintedRelays, ...RELAYS]))
    const orderedRelays = prioritizeLocalRelays(baseRelays)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(orderedRelays)

    // Fetch the article event
    const filter = {
      kinds: [pointer.kind],
      authors: [pointer.pubkey],
      '#d': [pointer.identifier]
    }

    // Parallel local+remote, stream immediate, collect up to first from each
    const { local$, remote$ } = createParallelReqStreams(relayPool, localRelays, remoteRelays, filter, 1200, 6000)
    const collected = await lastValueFrom(merge(local$.pipe(take(1)), remote$.pipe(take(1))).pipe(rxToArray()))
    let events = collected as NostrEvent[]

    // Fallback: if nothing found, try a second round against a set of reliable public relays
    if (events.length === 0) {
      const reliableRelays = Array.from(new Set<string>([
        'wss://relay.nostr.band',
        'wss://relay.primal.net',
        'wss://relay.damus.io',
        'wss://nos.lol',
        ...remoteRelays // keep any configured remote relays
      ]))
      const { remote$: fallback$ } = createParallelReqStreams(
        relayPool,
        [], // no local
        reliableRelays,
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
