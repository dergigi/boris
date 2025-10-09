import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { RELAYS } from '../config/relays'
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

function getFromCache(naddr: string): ArticleContent | null {
  try {
    const cacheKey = getCacheKey(naddr)
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const { content, timestamp }: CachedArticle = JSON.parse(cached)
    const age = Date.now() - timestamp

    if (age > CACHE_TTL) {
      localStorage.removeItem(cacheKey)
      return null
    }

    console.log('📦 Loaded article from cache:', naddr)
    return content
  } catch {
    return null
  }
}

function saveToCache(naddr: string, content: ArticleContent): void {
  try {
    const cacheKey = getCacheKey(naddr)
    const cached: CachedArticle = {
      content,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cached))
    console.log('💾 Saved article to cache:', naddr)
  } catch (err) {
    console.warn('Failed to cache article:', err)
    // Silently fail if storage is full or unavailable
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

    // Define relays to query - prefer relays from naddr, fallback to configured relays (including local)
    const relays = pointer.relays && pointer.relays.length > 0 
      ? pointer.relays 
      : RELAYS

    // Fetch the article event
    const filter = {
      kinds: [pointer.kind],
      authors: [pointer.pubkey],
      '#d': [pointer.identifier]
    }

    // Use applesauce relay pool pattern
    const events = await lastValueFrom(
      relayPool
        .req(relays, filter)
        .pipe(completeOnEose(), takeUntil(timer(10000)), toArray())
    )

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
    saveToCache(naddr, content)
    
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
