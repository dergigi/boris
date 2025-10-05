import { RelayPool, completeOnEose } from 'applesauce-relay'
import { lastValueFrom, takeUntil, timer, toArray } from 'rxjs'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { NostrEvent } from 'nostr-tools'
import { 
  getArticleTitle, 
  getArticleImage, 
  getArticlePublished, 
  getArticleSummary 
} from 'applesauce-core/helpers'

export interface ArticleContent {
  title: string
  markdown: string
  image?: string
  published?: number
  summary?: string
  author: string
  event: NostrEvent
}

/**
 * Fetches a Nostr long-form article (NIP-23) by naddr
 */
export async function fetchArticleByNaddr(
  relayPool: RelayPool,
  naddr: string
): Promise<ArticleContent> {
  try {
    // Decode the naddr
    const decoded = nip19.decode(naddr)
    
    if (decoded.type !== 'naddr') {
      throw new Error('Invalid naddr format')
    }

    const pointer = decoded.data as AddressPointer

    // Define relays to query
    const relays = pointer.relays && pointer.relays.length > 0 
      ? pointer.relays 
      : [
          'wss://relay.damus.io',
          'wss://nos.lol',
          'wss://relay.nostr.band',
          'wss://relay.primal.net'
        ]

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

    const title = getArticleTitle(article) || 'Untitled Article'
    const image = getArticleImage(article)
    const published = getArticlePublished(article)
    const summary = getArticleSummary(article)

    return {
      title,
      markdown: article.content,
      image,
      published,
      summary,
      author: article.pubkey,
      event: article
    }
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
