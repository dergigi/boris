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
      return result
    } catch {
      return []
    }
  }, [content])

  // Initialize labels synchronously from cache on first render to avoid delay
  const initialLabels = useMemo(() => {
    if (profileData.length === 0) {
      return new Map<string, string>()
    }
    
    const allPubkeys = profileData.map(({ pubkey }) => pubkey)
    const cachedProfiles = loadCachedProfiles(allPubkeys)
    const labels = new Map<string, string>()
    
    profileData.forEach(({ encoded, pubkey }) => {
      const cachedProfile = cachedProfiles.get(pubkey)
      if (cachedProfile) {
        try {
          const profileData = JSON.parse(cachedProfile.content || '{}') as { name?: string; display_name?: string; nip05?: string }
          const displayName = profileData.display_name || profileData.name || profileData.nip05
          if (displayName) {
            labels.set(encoded, `@${displayName}`)
          } else {
            // Use fallback npub display if profile has no name
            const fallback = getNpubFallbackDisplay(pubkey)
            labels.set(encoded, fallback)
          }
        } catch {
          // Use fallback npub display if parsing fails
          const fallback = getNpubFallbackDisplay(pubkey)
          labels.set(encoded, fallback)
        }
      }
    })
    
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
    
    profileData.forEach(({ encoded, pubkey }) => {
      // Skip if already resolved from initial cache
      if (labels.has(encoded)) {
        return
      }
      
      // Check EventStore for profiles that weren't in cache
      let profileEvent: { content: string } | null = null
      if (eventStore) {
        const eventStoreProfile = eventStore.getEvent(pubkey + ':0')
        if (eventStoreProfile) {
          profileEvent = eventStoreProfile
        }
      }
      
      if (profileEvent) {
        try {
          const profileData = JSON.parse(profileEvent.content || '{}') as { name?: string; display_name?: string; nip05?: string }
          const displayName = profileData.display_name || profileData.name || profileData.nip05
          if (displayName) {
            labels.set(encoded, `@${displayName}`)
          } else {
            // Use fallback npub display if profile has no name
            const fallback = getNpubFallbackDisplay(pubkey)
            labels.set(encoded, fallback)
          }
        } catch {
          // Use fallback npub display if parsing fails
          const fallback = getNpubFallbackDisplay(pubkey)
          labels.set(encoded, fallback)
        }
      } else {
        // No profile found yet, will use fallback after fetch or keep empty
        // We'll set fallback labels for missing profiles at the end
        pubkeysToFetch.push(pubkey)
      }
    })
    
    // Set fallback labels for profiles that weren't found
    profileData.forEach(({ encoded, pubkey }) => {
      if (!labels.has(encoded)) {
        const fallback = getNpubFallbackDisplay(pubkey)
        labels.set(encoded, fallback)
      }
    })
    
    setProfileLabels(new Map(labels))
    
    // Fetch missing profiles asynchronously
    if (pubkeysToFetch.length > 0 && relayPool && eventStore) {
      fetchProfiles(relayPool, eventStore as unknown as IEventStore, pubkeysToFetch)
        .then((fetchedProfiles) => {
          const updatedLabels = new Map(labels)
          const fetchedProfilesByPubkey = new Map(fetchedProfiles.map(p => [p.pubkey, p]))
          
          profileData.forEach(({ encoded, pubkey }) => {
            if (!updatedLabels.has(encoded)) {
              // First, try to use the profile from the returned array
              const fetchedProfile = fetchedProfilesByPubkey.get(pubkey)
              if (fetchedProfile) {
                try {
                  const profileData = JSON.parse(fetchedProfile.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                  const displayName = profileData.display_name || profileData.name || profileData.nip05
                  if (displayName) {
                    updatedLabels.set(encoded, `@${displayName}`)
                  } else {
                    // Use fallback npub display if profile has no name
                    const fallback = getNpubFallbackDisplay(pubkey)
                    updatedLabels.set(encoded, fallback)
                  }
                } catch {
                  // Use fallback npub display if parsing fails
                  const fallback = getNpubFallbackDisplay(pubkey)
                  updatedLabels.set(encoded, fallback)
                }
              } else if (eventStore) {
                // Fallback: check eventStore (in case fetchProfiles stored but didn't return)
                const profileEvent = eventStore.getEvent(pubkey + ':0')
                if (profileEvent) {
                  try {
                    const profileData = JSON.parse(profileEvent.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                    const displayName = profileData.display_name || profileData.name || profileData.nip05
                    if (displayName) {
                      updatedLabels.set(encoded, `@${displayName}`)
                    } else {
                      // Use fallback npub display if profile has no name
                      const fallback = getNpubFallbackDisplay(pubkey)
                      updatedLabels.set(encoded, fallback)
                    }
                  } catch {
                    // Use fallback npub display if parsing fails
                    const fallback = getNpubFallbackDisplay(pubkey)
                    updatedLabels.set(encoded, fallback)
                  }
                } else {
                  // No profile found, use fallback
                  const fallback = getNpubFallbackDisplay(pubkey)
                  updatedLabels.set(encoded, fallback)
                }
              } else {
                // No eventStore, use fallback
                const fallback = getNpubFallbackDisplay(pubkey)
                updatedLabels.set(encoded, fallback)
              }
            }
          })
          
          setProfileLabels(updatedLabels)
        })
        .catch(() => {
          // Silently handle fetch errors
        })
    }
  }, [profileData, eventStore, relayPool, initialLabels])
  
  return profileLabels
}

