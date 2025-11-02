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
  lastAccessed: number // For LRU eviction
}

const PROFILE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds (profiles change less frequently than articles)
const PROFILE_CACHE_PREFIX = 'profile_cache_'
const MAX_CACHED_PROFILES = 1000 // Limit number of cached profiles to prevent quota issues
let quotaExceededLogged = false // Only log quota error once per session

function getProfileCacheKey(pubkey: string): string {
  return `${PROFILE_CACHE_PREFIX}${pubkey}`
}

/**
 * Get a cached profile from localStorage
 * Returns null if not found, expired, or on error
 * Updates lastAccessed timestamp for LRU eviction
 */
export function getCachedProfile(pubkey: string): NostrEvent | null {
  try {
    const cacheKey = getProfileCacheKey(pubkey)
    const cached = localStorage.getItem(cacheKey)
    if (!cached) {
      return null
    }

    const data: CachedProfile = JSON.parse(cached)
    const age = Date.now() - data.timestamp

    if (age > PROFILE_CACHE_TTL) {
      localStorage.removeItem(cacheKey)
      return null
    }

    // Update lastAccessed for LRU eviction (but don't fail if update fails)
    try {
      data.lastAccessed = Date.now()
      localStorage.setItem(cacheKey, JSON.stringify(data))
    } catch {
      // Ignore update errors, still return the profile
    }

    return data.event
  } catch (err) {
    // Silently handle cache read errors (quota, invalid data, etc.)
    return null
  }
}

/**
 * Get all cached profile keys for eviction
 */
function getAllCachedProfileKeys(): Array<{ key: string; lastAccessed: number }> {
  const keys: Array<{ key: string; lastAccessed: number }> = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(PROFILE_CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key)
          if (cached) {
            const data: CachedProfile = JSON.parse(cached)
            keys.push({
              key,
              lastAccessed: data.lastAccessed || data.timestamp || 0
            })
          }
        } catch {
          // Skip invalid entries
        }
      }
    }
  } catch {
    // Ignore errors during enumeration
  }
  return keys
}

/**
 * Evict oldest profiles (LRU) to free up space
 * Removes the oldest accessed profiles until we're under the limit
 */
function evictOldProfiles(targetCount: number): void {
  try {
    const keys = getAllCachedProfileKeys()
    if (keys.length <= targetCount) {
      return
    }

    // Sort by lastAccessed (oldest first) and remove oldest
    keys.sort((a, b) => a.lastAccessed - b.lastAccessed)
    const toRemove = keys.slice(0, keys.length - targetCount)
    
    for (const { key } of toRemove) {
      localStorage.removeItem(key)
    }
  } catch {
    // Silently fail eviction
  }
}

/**
 * Cache a profile to localStorage
 * Handles errors gracefully (quota exceeded, invalid data, etc.)
 * Implements LRU eviction when cache is full
 */
export function cacheProfile(profile: NostrEvent): void {
  try {
    if (profile.kind !== 0) {
      return // Only cache kind:0 (profile) events
    }

    const cacheKey = getProfileCacheKey(profile.pubkey)
    
    // Check if we need to evict before caching
    const existingKeys = getAllCachedProfileKeys()
    if (existingKeys.length >= MAX_CACHED_PROFILES) {
      // Check if this profile is already cached
      const alreadyCached = existingKeys.some(k => k.key === cacheKey)
      if (!alreadyCached) {
        // Evict oldest profiles to make room (keep 90% of max)
        evictOldProfiles(Math.floor(MAX_CACHED_PROFILES * 0.9))
      }
    }

    const cached: CachedProfile = {
      event: profile,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cached))
  } catch (err) {
    // Handle quota exceeded by evicting and retrying once
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      if (!quotaExceededLogged) {
        console.warn(`[npub-cache] localStorage quota exceeded, evicting old profiles...`)
        quotaExceededLogged = true
      }
      
      // Try evicting more aggressively and retry
      try {
        evictOldProfiles(Math.floor(MAX_CACHED_PROFILES * 0.5))
        const cached: CachedProfile = {
          event: profile,
          timestamp: Date.now(),
          lastAccessed: Date.now()
        }
        localStorage.setItem(getProfileCacheKey(profile.pubkey), JSON.stringify(cached))
      } catch {
        // Silently fail if still can't cache - don't block the UI
      }
    }
    // Silently handle other caching errors (invalid data, etc.)
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
      console.log(`[fetch-profiles] No pubkeys provided`)
      return []
    }

    const uniquePubkeys = Array.from(new Set(pubkeys))
    console.log(`[fetch-profiles] Requested ${pubkeys.length} profiles (${uniquePubkeys.length} unique)`)
    
    // First, check localStorage cache for all requested profiles
    const cachedProfiles = loadCachedProfiles(uniquePubkeys)
    const profilesByPubkey = new Map<string, NostrEvent>()
    
    // Add cached profiles to the map and EventStore
    for (const [pubkey, profile] of cachedProfiles.entries()) {
      profilesByPubkey.set(pubkey, profile)
      // Ensure cached profiles are also in EventStore for consistency
      eventStore.add(profile)
    }
    
    console.log(`[fetch-profiles] Found ${cachedProfiles.size} profiles in cache`)
    
    // Determine which pubkeys need to be fetched from relays
    const pubkeysToFetch = uniquePubkeys.filter(pubkey => !cachedProfiles.has(pubkey))
    
    console.log(`[fetch-profiles] Need to fetch ${pubkeysToFetch.length} profiles from relays`)
    
    // If all profiles are cached, return early
    if (pubkeysToFetch.length === 0) {
      console.log(`[fetch-profiles] All profiles cached, returning ${profilesByPubkey.size} profiles`)
      return Array.from(profilesByPubkey.values())
    }

    // Fetch missing profiles from relays
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    const prioritized = prioritizeLocalRelays(relayUrls)
    const { local: localRelays, remote: remoteRelays } = partitionRelays(prioritized)

    console.log(`[fetch-profiles] Querying ${localRelays.length} local relays and ${remoteRelays.length} remote relays`)
    console.log(`[fetch-profiles] Active relays:`, relayUrls)
    const hasPurplePages = relayUrls.some(url => url.includes('purplepag.es'))
    if (!hasPurplePages) {
      console.warn(`[fetch-profiles] purplepag.es not in active relay pool, adding it temporarily`)
      // Add purplepag.es if it's not in the pool (it might not have connected yet)
      const purplePagesUrl = 'wss://purplepag.es'
      if (!relayPool.relays.has(purplePagesUrl)) {
        relayPool.group([purplePagesUrl])
      }
      // Ensure it's included in the remote relays for this fetch
      if (!remoteRelays.includes(purplePagesUrl)) {
        remoteRelays.push(purplePagesUrl)
      }
    }
    let eventCount = 0
    const fetchedPubkeys = new Set<string>()

    const processEvent = (event: NostrEvent) => {
      eventCount++
      fetchedPubkeys.add(event.pubkey)
      const existing = profilesByPubkey.get(event.pubkey)
      if (!existing || event.created_at > existing.created_at) {
        profilesByPubkey.set(event.pubkey, event)
        // Store in event store immediately
        eventStore.add(event)
        // Cache to localStorage for future use
        cacheProfile(event)
        console.log(`[fetch-profiles] Received profile for ${event.pubkey.slice(0, 16)}... (event #${eventCount})`)
      } else {
        console.log(`[fetch-profiles] Received older profile for ${event.pubkey.slice(0, 16)}..., keeping existing`)
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
    
    console.log(`[fetch-profiles] Fetch completed: received ${eventCount} events, ${fetchedPubkeys.size} unique profiles`)
    const missingPubkeys = pubkeysToFetch.filter(p => !fetchedPubkeys.has(p))
    if (missingPubkeys.length > 0) {
      console.warn(`[fetch-profiles] ${missingPubkeys.length} profiles not found on relays:`, missingPubkeys.map(p => p.slice(0, 16) + '...'))
    }
    console.log(`[fetch-profiles] Returning ${profiles.length} total profiles (${cachedProfiles.size} cached + ${fetchedPubkeys.size} fetched)`)

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
    console.error('[fetch-profiles] Failed to fetch profiles:', error)
    return []
  }
}

