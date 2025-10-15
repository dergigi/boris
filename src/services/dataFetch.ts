import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { Observable, merge, takeUntil, timer, toArray, tap, lastValueFrom } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { Filter } from 'nostr-tools/filter'
import { prioritizeLocalRelays, partitionRelays } from '../utils/helpers'
import { LOCAL_TIMEOUT_MS, REMOTE_TIMEOUT_MS } from '../config/network'

export interface QueryOptions {
  relayUrls?: string[]
  localTimeoutMs?: number
  remoteTimeoutMs?: number
  onEvent?: (event: NostrEvent) => void
}

/**
 * Unified local-first query helper with optional streaming callback.
 * Returns all collected events (deduped by id) after both streams complete or time out.
 */
export async function queryEvents(
  relayPool: RelayPool,
  filter: Filter,
  options: QueryOptions = {}
): Promise<NostrEvent[]> {
  const {
    relayUrls,
    localTimeoutMs = LOCAL_TIMEOUT_MS,
    remoteTimeoutMs = REMOTE_TIMEOUT_MS,
    onEvent
  } = options

  const urls = relayUrls && relayUrls.length > 0
    ? relayUrls
    : Array.from(relayPool.relays.values()).map(r => r.url)

  const ordered = prioritizeLocalRelays(urls)
  const { local: localRelays, remote: remoteRelays } = partitionRelays(ordered)

  const local$: Observable<NostrEvent> = localRelays.length > 0
    ? relayPool
        .req(localRelays, filter)
        .pipe(
          onlyEvents(),
          onEvent ? tap((e: NostrEvent) => onEvent(e)) : tap(() => {}),
          completeOnEose(),
          takeUntil(timer(localTimeoutMs))
        ) as unknown as Observable<NostrEvent>
    : new Observable<NostrEvent>((sub) => sub.complete())

  const remote$: Observable<NostrEvent> = remoteRelays.length > 0
    ? relayPool
        .req(remoteRelays, filter)
        .pipe(
          onlyEvents(),
          onEvent ? tap((e: NostrEvent) => onEvent(e)) : tap(() => {}),
          completeOnEose(),
          takeUntil(timer(remoteTimeoutMs))
        ) as unknown as Observable<NostrEvent>
    : new Observable<NostrEvent>((sub) => sub.complete())

  const events = await lastValueFrom(merge(local$, remote$).pipe(toArray()))

  // Deduplicate by id (callers can perform higher-level replaceable grouping if needed)
  const byId = new Map<string, NostrEvent>()
  for (const ev of events) {
    if (!byId.has(ev.id)) byId.set(ev.id, ev)
  }
  return Array.from(byId.values())
}


