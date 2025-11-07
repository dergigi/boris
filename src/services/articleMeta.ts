import WebSocket from 'ws'
;(globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket ??= WebSocket
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent, Filter } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { extractProfileDisplayName } from '../../lib/profile'
import { RELAYS } from '../config/relays'
import type { ArticleMetadata } from './ogStore'

const { getArticleTitle, getArticleImage, getArticleSummary } = Helpers

async function fetchEventsFromRelays(
  relayPool: RelayPool,
  relayUrls: string[],
  filter: Filter,
  timeoutMs: number
): Promise<NostrEvent[]> {
  const events: NostrEvent[] = []

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => resolve(), timeoutMs)

    relayPool.request(relayUrls, filter).subscribe({
      next: (event) => {
        events.push(event)
      },
      error: () => resolve(),
      complete: () => {
        clearTimeout(timeout)
        resolve()
      }
    })
  })

  return events.sort((a, b) => b.created_at - a.created_at)
}

export async function fetchArticleMetadataViaRelays(naddr: string): Promise<ArticleMetadata | null> {
  const relayPool = new RelayPool()
  
  try {
    const decoded = nip19.decode(naddr)
    if (decoded.type !== 'naddr') {
      return null
    }

    const pointer = decoded.data as AddressPointer
    const relayUrls = pointer.relays && pointer.relays.length > 0 ? pointer.relays : RELAYS

    const [articleEvents, profileEvents] = await Promise.all([
      fetchEventsFromRelays(relayPool, relayUrls, {
        kinds: [pointer.kind],
        authors: [pointer.pubkey],
        '#d': [pointer.identifier || '']
      }, 7000),
      fetchEventsFromRelays(relayPool, relayUrls, {
        kinds: [0],
        authors: [pointer.pubkey]
      }, 5000)
    ])

    if (articleEvents.length === 0) {
      return null
    }

    const article = articleEvents[0]
    const title = getArticleTitle(article) || 'Untitled Article'
    const summary = getArticleSummary(article) || 'Read this article on Boris'
    const image = getArticleImage(article) || '/boris-social-1200.png'

    let authorName = pointer.pubkey.slice(0, 8) + '...'
    if (profileEvents.length > 0) {
      const displayName = extractProfileDisplayName(profileEvents[0])
      if (displayName && !displayName.startsWith('@')) {
        authorName = displayName
      } else if (displayName) {
        authorName = displayName.substring(1)
      }
    }

    return {
      title,
      summary,
      image,
      author: authorName,
      published: article.created_at
    }
  } catch (err) {
    console.error('Failed to fetch article metadata via relays:', err)
    return null
  }
}

export async function fetchArticleMetadataViaGateway(naddr: string): Promise<ArticleMetadata | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    
    const resp = await fetch(`https://njump.to/${naddr}`, { 
      redirect: 'follow',
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    if (!resp.ok) {
      return null
    }
    
    const html = await resp.text()
    
    const pick = (re: RegExp) => (html.match(re)?.[1] ?? '').trim()
    const title = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || 
                      pick(/<title[^>]*>([^<]+)<\/title>/i)
    const summary = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    const image = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    
    if (!title && !summary && !image) {
      return null
    }
    
    return {
      title: title || 'Read on Boris',
      summary: summary || 'Read this article on Boris',
      image: image || '/boris-social-1200.png',
      author: 'Boris'
    }
  } catch (err) {
    console.error('Failed to fetch article metadata via gateway:', err)
    return null
  }
}

