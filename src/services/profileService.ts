import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, toArray, tap } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { prioritizeLocalRelays, partitionRelays } from '../utils/helpers'
import { rebroadcastEvents } from './rebroadcastService'
import { UserSettings } from './settingsService'

/**
 * Fetches profile metadata (kind:0) for a list of pubkeys
 * Stores profiles in the event store and optionally to local relays
 */
export const fetchProfiles = async (
  relayPool: RelayPool,
  eventStore: IEventStore,
  pubkeys: string[],
  settings?: UserSettings
): Promise<NostrEvent[]> => {
  try {
    if (pubkeys.length === 0) {
      return []
    }

    const uniquePubkeys = Array.from(new Set(pubkeys))
    console.log('👤 Fetching profiles (kind:0) for', uniquePubkeys.length, 'authors')

    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    const prioritized = prioritizeLocalRelays(relayUrls)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(prioritized)

    // Keep only the most recent profile for each pubkey
    const profilesByPubkey = new Map<string, NostrEvent>()

    const processEvent = (event: NostrEvent) => {
      const existing = profilesByPubkey.get(event.pubkey)
      if (!existing || event.created_at > existing.created_at) {
        profilesByPubkey.set(event.pubkey, event)
        // Store in event store immediately
        eventStore.add(event)
      }
    }

    const local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [0], authors: uniquePubkeys })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => processEvent(event)),
            completeOnEose(),
            takeUntil(timer(1200))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, { kinds: [0], authors: uniquePubkeys })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => processEvent(event)),
            completeOnEose(),
            takeUntil(timer(6000))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    await lastValueFrom(merge(local$, remote$).pipe(toArray()))

    const profiles = Array.from(profilesByPubkey.values())
    console.log('✅ Fetched', profiles.length, 'unique profiles')

    // Rebroadcast profiles to local/all relays based on settings
    if (profiles.length > 0) {
      await rebroadcastEvents(profiles, relayPool, settings)
    }

    return profiles
  } catch (error) {
    console.error('Failed to fetch profiles:', error)
    return []
  }
}

