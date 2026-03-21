import WebSocket from 'ws'
;(globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket ??= WebSocket
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent, Filter } from 'nostr-tools'
import { Helpers } from 'applesauce-core'
import { extractProfileDisplayName } from '../../lib/profile.js'
import { RELAYS } from '../../src/config/relays.js'
import type { ArticleMetadata } from './ogStore.js'

const { getArticleTitle, getArticleImage, getArticleSummary } = Helpers

const isNotLocalhostRelay = (url: string): boolean =>
  !url.includes('localhost') && !url.includes('127.0.0.1')

const SERVERLESS_RELAYS = RELAYS.filter(isNotLocalhostRelay)

async function fetchEventsFromRelays(
  relayPool: RelayPool,
  relayUrls: string[],
  filter: Filter,
  timeoutMs: number
): Promise<NostrEvent[]> {
  const events: NostrEvent[] = []

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => resolve(), timeoutMs)

    const subscription = relayPool.request(relayUrls, filter).subscribe({
      next: (event) => {
        events.push(event)
      },
      error: () => {
        clearTimeout(timeout)
        subscription?.unsubscribe()
        resolve()
      },
      complete: () => {
        clearTimeout(timeout)
        resolve()
      }
    })
  })

  return events.sort((a, b) => b.created_at - a.created_at)
}

async function fetchFirstEvent(
  relayPool: RelayPool,
  relayUrls: string[],
  filter: Filter,
  timeoutMs: number
): Promise<NostrEvent | null> {
  return new Promise<NostrEvent | null>((resolve) => {
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(null)
      }
    }, timeoutMs)

    const subscription = relayPool.request(relayUrls, filter).subscribe({
      next: (event) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          subscription.unsubscribe()
          resolve(event)
        }
      },
      error: () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve(null)
        }
      },
      complete: () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve(null)
        }
      }
    })
  })
}

async function fetchAuthorProfile(
  relayPool: RelayPool,
  relayUrls: string[],
  pubkey: string,
  timeoutMs: number
): Promise<string | null> {
  const profileEvents = await fetchEventsFromRelays(relayPool, relayUrls, {
    kinds: [0],
    authors: [pubkey]
  }, timeoutMs)

  if (profileEvents.length === 0) {
    return null
  }

  const displayName = extractProfileDisplayName(profileEvents[0])
  if (displayName && !displayName.startsWith('@')) {
    return displayName
  } else if (displayName) {
    return displayName.substring(1)
  }

  return null
}

export async function fetchArticleMetadataViaRelays(naddr: string): Promise<ArticleMetadata | null> {
  const relayPool = new RelayPool()

  try {
    const decoded = nip19.decode(naddr)
    if (decoded.type !== 'naddr') {
      return null
    }

    const pointer = decoded.data as AddressPointer
    const pointerRelays = pointer.relays?.filter(isNotLocalhostRelay)
    const relayUrls = pointerRelays && pointerRelays.length > 0 ? pointerRelays : SERVERLESS_RELAYS

    const article = await fetchFirstEvent(relayPool, relayUrls, {
      kinds: [pointer.kind],
      authors: [pointer.pubkey],
      '#d': [pointer.identifier || '']
    }, 7000)

    if (!article) {
      return null
    }

    const title = getArticleTitle(article) || 'Untitled Article'
    const summary = getArticleSummary(article) || 'Read this article on Boris'
    const image = getArticleImage(article) || '/boris-social-1200.png'

    const tags = article.tags
      ?.filter((tag) => tag[0] === 't' && tag[1])
      .map((tag) => tag[1])
      .filter((tag) => tag.length > 0) || []

    const imageAlt = title || 'Article cover image'

    let authorName = await fetchAuthorProfile(relayPool, relayUrls, pointer.pubkey, 400)

    if (!authorName) {
      authorName = await fetchAuthorProfile(relayPool, relayUrls, pointer.pubkey, 600)
    }

    if (!authorName) {
      authorName = pointer.pubkey.slice(0, 8) + '...'
    }

    return {
      title,
      summary,
      image,
      author: authorName,
      published: article.created_at,
      tags: tags.length > 0 ? tags : undefined,
      imageAlt
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
    
    const url = `https://njump.to/${naddr}`
    console.log(`Fetching from gateway: ${url}`)
    
    const resp = await fetch(url, { 
      redirect: 'follow',
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    if (!resp.ok) {
      console.error(`Gateway fetch failed: ${resp.status} ${resp.statusText} for ${url}`)
      return null
    }
    
    const html = await resp.text()
    console.log(`Gateway response length: ${html.length} chars`)
    
    const pick = (re: RegExp) => {
      const match = html.match(re)
      return match?.[1] ? match[1].trim() : ''
    }
    
    const title = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || 
                      pick(/<title[^>]*>([^<]+)<\/title>/i)
    const summary = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    const image = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    
    console.log(`Parsed from gateway - title: ${title ? 'found' : 'missing'}, summary: ${summary ? 'found' : 'missing'}, image: ${image ? 'found' : 'missing'}`)
    
    if (!title && !summary && !image) {
      console.log('No OG metadata found in gateway response')
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
    if (err instanceof Error) {
      console.error('Error details:', err.message, err.stack)
    }
    return null
  }
}

