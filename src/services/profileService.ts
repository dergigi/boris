import { RelayPool, completeOnEose, onlyEvents } from 'applesauce-relay'
import { lastValueFrom, merge, Observable, takeUntil, timer, toArray, tap } from 'rxjs'
import { NostrEvent } from 'nostr-tools'
import { IEventStore } from 'applesauce-core'
import { prioritizeLocalRelays, partitionRelays } from '../utils/helpers'
import { rebroadcastEvents } from './rebroadcastService'
import { UserSettings } from './settingsService'

interface CachedProfile {
  event: NostrEvent
  timestamp: number
}

const PROFILE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds (profiles change less frequently than articles)
const PROFILE_CACHE_PREFIX = 'profile_cache_'

function getProfileCacheKey(pubkey: string): string {
  return `${PROFILE_CACHE_PREFIX}${pubkey}`
}

/**
 * Get a cached profile from localStorage
 * Returns null if not found, expired, or on error
 */
export function getCachedProfile(pubkey: string): NostrEvent | null {
  try {
    const cacheKey = getProfileCacheKey(pubkey)
    const cached = localStorage.getItem(cacheKey)
    if (!cached) {
      return null
    }

    const { event, timestamp }: CachedProfile = JSON.parse(cached)
    const age = Date.now() - timestamp

    if (age > PROFILE_CACHE_TTL) {
      localStorage.removeItem(cacheKey)
      return null
    }

    return event
  } catch (err) {
    // Log cache read errors for debugging
    console.error(`[profile-cache] Error reading cached profile for ${pubkey.slice(0, 16)}...:`, err)
    return null
  }
}

/**
 * Cache a profile to localStorage
 * Handles errors gracefully (quota exceeded, invalid data, etc.)
 */
export function cacheProfile(profile: NostrEvent): void {
  try {
    if (profile.kind !== 0) {
      console.warn(`[profile-cache] Attempted to cache non-profile event (kind ${profile.kind})`)
      return // Only cache kind:0 (profile) events
    }

    const cacheKey = getProfileCacheKey(profile.pubkey)
    const cached: CachedProfile = {
      event: profile,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cached))
    console.log(`[profile-cache] Cached profile:`, profile.pubkey.slice(0, 16) + '...')
  } catch (err) {
    // Log caching errors for debugging
    console.error(`[profile-cache] Failed to cache profile ${profile.pubkey.slice(0, 16)}...:`, err)
    // Don't block the UI if caching fails
    // Handles quota exceeded, invalid data, and other errors gracefully
  }
}

/**
 * Batch load multiple profiles from localStorage cache
 * Returns a Map of pubkey -> NostrEvent for all found profiles
 */
export function loadCachedProfiles(pubkeys: string[]): Map<string, NostrEvent> {
  const cached = new Map<string, NostrEvent>()
  
  for (const pubkey of pubkeys) {
    const profile = getCachedProfile(pubkey)
    if (profile) {
      cached.set(pubkey, profile)
    }
  }
  
  return cached
}

/**
 * Fetches profile metadata (kind:0) for a list of pubkeys
 * Checks localStorage cache first, then fetches from relays for missing/expired profiles
 * Stores profiles in the event store and caches to localStorage
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
    
    // First, check localStorage cache for all requested profiles
    const cachedProfiles = loadCachedProfiles(uniquePubkeys)
    const profilesByPubkey = new Map<string, NostrEvent>()
    
    // Add cached profiles to the map and EventStore
    for (const [pubkey, profile] of cachedProfiles.entries()) {
      profilesByPubkey.set(pubkey, profile)
      // Ensure cached profiles are also in EventStore for consistency
      eventStore.add(profile)
    }
    
    // Determine which pubkeys need to be fetched from relays
    const pubkeysToFetch = uniquePubkeys.filter(pubkey => !cachedProfiles.has(pubkey))
    
    // If all profiles are cached, return early
    if (pubkeysToFetch.length === 0) {
      return Array.from(profilesByPubkey.values())
    }

    // Fetch missing profiles from relays
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    const prioritized = prioritizeLocalRelays(relayUrls)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(prioritized)

    const processEvent = (event: NostrEvent) => {
      const existing = profilesByPubkey.get(event.pubkey)
      if (!existing || event.created_at > existing.created_at) {
        profilesByPubkey.set(event.pubkey, event)
        // Store in event store immediately
        eventStore.add(event)
        // Cache to localStorage for future use
        cacheProfile(event)
      }
    }

    const local$ = localRelays.length > 0
      ? relayPool
          .req(localRelays, { kinds: [0], authors: pubkeysToFetch })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => processEvent(event)),
            completeOnEose(),
            takeUntil(timer(1200))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    const remote$ = remoteRelays.length > 0
      ? relayPool
          .req(remoteRelays, { kinds: [0], authors: pubkeysToFetch })
          .pipe(
            onlyEvents(),
            tap((event: NostrEvent) => processEvent(event)),
            completeOnEose(),
            takeUntil(timer(6000))
          )
      : new Observable<NostrEvent>((sub) => sub.complete())

    await lastValueFrom(merge(local$, remote$).pipe(toArray()))

    const profiles = Array.from(profilesByPubkey.values())

    // Note: We don't preload all profile images here to avoid ERR_INSUFFICIENT_RESOURCES
    // Profile images will be cached by Service Worker when they're actually displayed.
    // Only the logged-in user's profile image is preloaded (in SidebarHeader).

    // Rebroadcast profiles to local/all relays based on settings
    // Only rebroadcast newly fetched profiles, not cached ones
    const newlyFetchedProfiles = profiles.filter(p => pubkeysToFetch.includes(p.pubkey))
    if (newlyFetchedProfiles.length > 0) {
      await rebroadcastEvents(newlyFetchedProfiles, relayPool, settings)
    }

    return profiles
  } catch (error) {
    console.error('Failed to fetch profiles:', error)
    return []
  }
}

