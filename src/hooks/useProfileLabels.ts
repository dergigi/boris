import { useMemo, useState, useEffect } from 'react'
import { Hooks } from 'applesauce-react'
import { Helpers, IEventStore } from 'applesauce-core'
import { getContentPointers } from 'applesauce-factory/helpers'
import { RelayPool } from 'applesauce-relay'
import { fetchProfiles, loadCachedProfiles } from '../services/profileService'
import { getNpubFallbackDisplay } from '../utils/nostrUriResolver'

const { getPubkeyFromDecodeResult, encodeDecodeResult } = Helpers

/**
 * Hook to resolve profile labels from content containing npub/nprofile identifiers
 * Returns a Map of encoded identifier -> display name that updates progressively as profiles load
 */
export function useProfileLabels(content: string, relayPool?: RelayPool | null): Map<string, string> {
  const eventStore = Hooks.useEventStore()
  
  // Extract profile pointers (npub and nprofile) using applesauce helpers
  const profileData = useMemo(() => {
      try {
        const pointers = getContentPointers(content)
        const filtered = pointers.filter(p => p.type === 'npub' || p.type === 'nprofile')
      const result: Array<{ pubkey: string; encoded: string }> = []
      filtered.forEach(pointer => {
        try {
          const pubkey = getPubkeyFromDecodeResult(pointer)
          const encoded = encodeDecodeResult(pointer)
          if (pubkey && encoded) {
            result.push({ pubkey, encoded: encoded as string })
          }
        } catch {
          // Ignore errors, continue processing other pointers
        }
      })
      console.log(`[profile-labels] Extracted ${result.length} profile identifiers from content:`, result.map(r => ({ encoded: r.encoded.slice(0, 20) + '...', pubkey: r.pubkey.slice(0, 16) + '...' })))
      return result
    } catch (error) {
      console.warn(`[profile-labels] Error extracting profile pointers:`, error)
      return []
    }
  }, [content])

  // Initialize labels synchronously from cache on first render to avoid delay
  const initialLabels = useMemo(() => {
    if (profileData.length === 0) {
      console.log(`[profile-labels] No profile data, returning empty labels`)
      return new Map<string, string>()
    }
    
    const allPubkeys = profileData.map(({ pubkey }) => pubkey)
    const cachedProfiles = loadCachedProfiles(allPubkeys)
    console.log(`[profile-labels] Loaded ${cachedProfiles.size} cached profiles out of ${allPubkeys.length} requested`)
    const labels = new Map<string, string>()
    
    profileData.forEach(({ encoded, pubkey }) => {
      const cachedProfile = cachedProfiles.get(pubkey)
      if (cachedProfile) {
        try {
          const profileData = JSON.parse(cachedProfile.content || '{}') as { name?: string; display_name?: string; nip05?: string }
          const displayName = profileData.display_name || profileData.name || profileData.nip05
          if (displayName) {
            labels.set(encoded, `@${displayName}`)
            console.log(`[profile-labels] Found cached name for ${encoded.slice(0, 20)}...: ${displayName}`)
          } else {
            // Use fallback npub display if profile has no name
            const fallback = getNpubFallbackDisplay(pubkey)
            labels.set(encoded, fallback)
            console.log(`[profile-labels] Cached profile for ${encoded.slice(0, 20)}... has no name, using fallback: ${fallback}`)
          }
        } catch (error) {
          // Use fallback npub display if parsing fails
          const fallback = getNpubFallbackDisplay(pubkey)
          labels.set(encoded, fallback)
          console.warn(`[profile-labels] Error parsing cached profile for ${encoded.slice(0, 20)}..., using fallback:`, error)
        }
      } else {
        console.log(`[profile-labels] No cached profile for ${encoded.slice(0, 20)}... (pubkey: ${pubkey.slice(0, 16)}...)`)
      }
    })
    
    console.log(`[profile-labels] Initial labels from cache:`, Array.from(labels.entries()).map(([enc, label]) => ({ encoded: enc.slice(0, 20) + '...', label })))
    return labels
  }, [profileData])

  const [profileLabels, setProfileLabels] = useState<Map<string, string>>(initialLabels)

  // Build initial labels: localStorage cache -> eventStore -> fetch from relays
  useEffect(() => {
    // Extract all pubkeys
    const allPubkeys = profileData.map(({ pubkey }) => pubkey)
    
    if (allPubkeys.length === 0) {
      setProfileLabels(new Map())
      return
    }
    
    // Add cached profiles to EventStore for consistency
    const cachedProfiles = loadCachedProfiles(allPubkeys)
    if (eventStore) {
      for (const profile of cachedProfiles.values()) {
        eventStore.add(profile)
      }
    }
    
    // Build labels from localStorage cache and eventStore
    // initialLabels already has all cached profiles, so we only need to check eventStore
    const labels = new Map<string, string>(initialLabels)
    
    const pubkeysToFetch: string[] = []
    
    console.log(`[profile-labels] Checking eventStore for ${profileData.length} profiles`)
    profileData.forEach(({ encoded, pubkey }) => {
      // Skip if already resolved from initial cache
      if (labels.has(encoded)) {
        console.log(`[profile-labels] Skipping ${encoded.slice(0, 20)}..., already has label from cache`)
        return
      }
      
      // Check EventStore for profiles that weren't in cache
      let profileEvent: { content: string } | null = null
      if (eventStore) {
        const eventStoreProfile = eventStore.getEvent(pubkey + ':0')
        if (eventStoreProfile) {
          profileEvent = eventStoreProfile
          console.log(`[profile-labels] Found profile in eventStore for ${encoded.slice(0, 20)}...`)
        } else {
          console.log(`[profile-labels] Profile not in eventStore for ${encoded.slice(0, 20)}... (pubkey: ${pubkey.slice(0, 16)}...)`)
        }
      } else {
        console.log(`[profile-labels] No eventStore available`)
      }
      
      if (profileEvent) {
        try {
          const profileData = JSON.parse(profileEvent.content || '{}') as { name?: string; display_name?: string; nip05?: string }
          const displayName = profileData.display_name || profileData.name || profileData.nip05
          if (displayName) {
            labels.set(encoded, `@${displayName}`)
            console.log(`[profile-labels] Set label from eventStore for ${encoded.slice(0, 20)}...: @${displayName}`)
          } else {
            // Use fallback npub display if profile has no name
            const fallback = getNpubFallbackDisplay(pubkey)
            labels.set(encoded, fallback)
            console.log(`[profile-labels] Profile in eventStore for ${encoded.slice(0, 20)}... has no name, using fallback: ${fallback}`)
          }
        } catch (error) {
          // Use fallback npub display if parsing fails
          const fallback = getNpubFallbackDisplay(pubkey)
          labels.set(encoded, fallback)
          console.warn(`[profile-labels] Error parsing eventStore profile for ${encoded.slice(0, 20)}..., using fallback:`, error)
        }
      } else {
        // No profile found yet, will use fallback after fetch or keep empty
        // We'll set fallback labels for missing profiles at the end
        console.log(`[profile-labels] Adding ${encoded.slice(0, 20)}... to fetch queue`)
        pubkeysToFetch.push(pubkey)
      }
    })
    
    // Set fallback labels for profiles that weren't found
    profileData.forEach(({ encoded, pubkey }) => {
      if (!labels.has(encoded)) {
        const fallback = getNpubFallbackDisplay(pubkey)
        labels.set(encoded, fallback)
        console.log(`[profile-labels] Setting fallback label for ${encoded.slice(0, 20)}...: ${fallback}`)
      }
    })
    
    console.log(`[profile-labels] Labels after checking cache and eventStore:`, Array.from(labels.entries()).map(([enc, label]) => ({ encoded: enc.slice(0, 20) + '...', label })))
    console.log(`[profile-labels] Profiles to fetch: ${pubkeysToFetch.length}`, pubkeysToFetch.map(p => p.slice(0, 16) + '...'))
    setProfileLabels(new Map(labels))
    
    // Fetch missing profiles asynchronously
    if (pubkeysToFetch.length > 0 && relayPool && eventStore) {
      const pubkeysToFetchSet = new Set(pubkeysToFetch)
      console.log(`[profile-labels] Fetching ${pubkeysToFetch.length} profiles from relays`)
      fetchProfiles(relayPool, eventStore as unknown as IEventStore, pubkeysToFetch)
        .then((fetchedProfiles) => {
          console.log(`[profile-labels] Fetch completed, received ${fetchedProfiles.length} profiles`)
          const updatedLabels = new Map(labels)
          const fetchedProfilesByPubkey = new Map(fetchedProfiles.map(p => [p.pubkey, p]))
          
          profileData.forEach(({ encoded, pubkey }) => {
            // Only update profiles that were in pubkeysToFetch (i.e., were being fetched)
            // This allows us to replace fallback labels with resolved names
            if (pubkeysToFetchSet.has(pubkey)) {
              console.log(`[profile-labels] Processing fetched profile for ${encoded.slice(0, 20)}...`)
              // First, try to use the profile from the returned array
              const fetchedProfile = fetchedProfilesByPubkey.get(pubkey)
              if (fetchedProfile) {
                console.log(`[profile-labels] Found profile in fetch results for ${encoded.slice(0, 20)}...`)
                try {
                  const profileData = JSON.parse(fetchedProfile.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                  const displayName = profileData.display_name || profileData.name || profileData.nip05
                  if (displayName) {
                    updatedLabels.set(encoded, `@${displayName}`)
                    console.log(`[profile-labels] Updated label for ${encoded.slice(0, 20)}... to @${displayName}`)
                  } else {
                    // Use fallback npub display if profile has no name
                    const fallback = getNpubFallbackDisplay(pubkey)
                    updatedLabels.set(encoded, fallback)
                    console.log(`[profile-labels] Fetched profile for ${encoded.slice(0, 20)}... has no name, using fallback: ${fallback}`)
                  }
                } catch (error) {
                  // Use fallback npub display if parsing fails
                  const fallback = getNpubFallbackDisplay(pubkey)
                  updatedLabels.set(encoded, fallback)
                  console.warn(`[profile-labels] Error parsing fetched profile for ${encoded.slice(0, 20)}..., using fallback:`, error)
                }
              } else if (eventStore) {
                console.log(`[profile-labels] Profile not in fetch results, checking eventStore for ${encoded.slice(0, 20)}...`)
                // Fallback: check eventStore (in case fetchProfiles stored but didn't return)
                const profileEvent = eventStore.getEvent(pubkey + ':0')
                if (profileEvent) {
                  console.log(`[profile-labels] Found profile in eventStore after fetch for ${encoded.slice(0, 20)}...`)
                  try {
                    const profileData = JSON.parse(profileEvent.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                    const displayName = profileData.display_name || profileData.name || profileData.nip05
                    if (displayName) {
                      updatedLabels.set(encoded, `@${displayName}`)
                      console.log(`[profile-labels] Updated label from eventStore for ${encoded.slice(0, 20)}... to @${displayName}`)
                    } else {
                      // Use fallback npub display if profile has no name
                      const fallback = getNpubFallbackDisplay(pubkey)
                      updatedLabels.set(encoded, fallback)
                      console.log(`[profile-labels] Profile in eventStore for ${encoded.slice(0, 20)}... has no name, using fallback: ${fallback}`)
                    }
                  } catch (error) {
                    // Use fallback npub display if parsing fails
                    const fallback = getNpubFallbackDisplay(pubkey)
                    updatedLabels.set(encoded, fallback)
                    console.warn(`[profile-labels] Error parsing eventStore profile for ${encoded.slice(0, 20)}..., using fallback:`, error)
                  }
                } else {
                  console.log(`[profile-labels] Profile not in eventStore after fetch for ${encoded.slice(0, 20)}..., keeping fallback`)
                }
                // If no profile found in eventStore, keep existing fallback
              } else {
                console.log(`[profile-labels] No eventStore available, keeping fallback for ${encoded.slice(0, 20)}...`)
              }
              // If no eventStore, keep existing fallback
            }
          })
          
          console.log(`[profile-labels] Final labels after fetch:`, Array.from(updatedLabels.entries()).map(([enc, label]) => ({ encoded: enc.slice(0, 20) + '...', label })))
          setProfileLabels(updatedLabels)
        })
        .catch((error) => {
          console.error(`[profile-labels] Error fetching profiles:`, error)
          // Silently handle fetch errors
        })
    } else {
      if (pubkeysToFetch.length === 0) {
        console.log(`[profile-labels] No profiles to fetch`)
      } else if (!relayPool) {
        console.log(`[profile-labels] No relayPool available, cannot fetch profiles`)
      } else if (!eventStore) {
        console.log(`[profile-labels] No eventStore available, cannot fetch profiles`)
      }
    }
  }, [profileData, eventStore, relayPool, initialLabels])
  
  return profileLabels
}

