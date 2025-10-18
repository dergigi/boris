import { useMemo } from 'react'
import { useObservableMemo } from 'applesauce-react/hooks'
import { startWith } from 'rxjs'
import type { IEventStore } from 'applesauce-core'
import type { Filter, NostrEvent } from 'nostr-tools'

/**
 * Subscribe to EventStore timeline and map events to app types
 * Provides instant cached results, then updates reactively
 * 
 * @param eventStore - The applesauce event store
 * @param filter - Nostr filter to query
 * @param mapEvent - Function to transform NostrEvent to app type
 * @param deps - Dependencies for memoization
 * @returns Array of mapped results
 */
export function useStoreTimeline<T>(
  eventStore: IEventStore | null,
  filter: Filter,
  mapEvent: (event: NostrEvent) => T,
  deps: unknown[] = []
): T[] {
  const events = useObservableMemo(
    () => eventStore ? eventStore.timeline(filter).pipe(startWith([])) : undefined,
    [eventStore, ...deps]
  )
  
  return useMemo(
    () => events?.map(mapEvent) ?? [],
    [events, mapEvent]
  )
}

