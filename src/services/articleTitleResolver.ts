import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, take, takeUntil, timer, toArray } from 'rxjs'
import { nip19 } from 'nostr-tools'
import { AddressPointer } from 'nostr-tools/nip19'
import { Helpers } from 'applesauce-core'
import { RELAYS } from '../config/relays'
import { prioritizeLocalRelays, partitionRelays } from '../utils/helpers'

const { getArticleTitle } = Helpers

/**
 * Fetch article title for a single naddr
 * Returns the title or null if not found/error
 */
export async function fetchArticleTitle(
  relayPool: RelayPool,
  naddr: string
): Promise<string | null> {
  try {
    const decoded = nip19.decode(naddr)
    
    if (decoded.type !== 'naddr') {
      return null
    }

    const pointer = decoded.data as AddressPointer

    // Define relays to query
    const baseRelays = pointer.relays && pointer.relays.length > 0 
      ? pointer.relays 
      : RELAYS
    const orderedRelays = prioritizeLocalRelays(baseRelays)
    const { local: localRelays } = partitionRelays(orderedRelays)

    // Fetch the article event
    const filter = {
      kinds: [pointer.kind],
      authors: [pointer.pubkey],
      '#d': [pointer.identifier]
    }

    // Try to get the first event quickly from local relays
    let events = [] as any[]
    if (localRelays.length > 0) {
      try {
        events = await lastValueFrom(
          relayPool
            .req(localRelays, filter)
            .pipe(onlyEvents(), take(1), takeUntil(timer(1200)), toArray())
        )
      } catch {
        events = []
      }
    }
    // Fallback to all relays if nothing from local quickly
    if (events.length === 0) {
      events = await lastValueFrom(
        relayPool
          .req(orderedRelays, filter)
          .pipe(onlyEvents(), take(1), takeUntil(timer(5000)), toArray())
      )
    }

    if (events.length === 0) {
      return null
    }

    // Sort by created_at and take the most recent
    events.sort((a, b) => b.created_at - a.created_at)
    const article = events[0]

    return getArticleTitle(article) || null
  } catch (err) {
    console.warn('Failed to fetch article title for', naddr, err)
    return null
  }
}

/**
 * Fetch titles for multiple naddrs in parallel
 * Returns a map of naddr -> title
 */
export async function fetchArticleTitles(
  relayPool: RelayPool,
  naddrs: string[]
): Promise<Map<string, string>> {
  const titleMap = new Map<string, string>()
  
  // Fetch all titles in parallel
  const results = await Promise.allSettled(
    naddrs.map(async (naddr) => {
      const title = await fetchArticleTitle(relayPool, naddr)
      return { naddr, title }
    })
  )

  // Process results
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.title) {
      titleMap.set(result.value.naddr, result.value.title)
    }
  })

  return titleMap
}

