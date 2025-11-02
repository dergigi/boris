import { useMemo, useState, useEffect, useRef } from 'react'
import { Hooks } from 'applesauce-react'
import { Helpers, IEventStore } from 'applesauce-core'
import { getContentPointers } from 'applesauce-factory/helpers'
import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
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
  
  // Refs for batching updates to prevent flickering
  const pendingUpdatesRef = useRef<Map<string, string>>(new Map())
  const rafScheduledRef = useRef<number | null>(null)
  
  // Sync state when initialLabels changes (e.g., when content changes)
  // This ensures we start with the correct cached labels even if profiles haven't loaded yet
  useEffect(() => {
    // Use a functional update to access current state without including it in dependencies
    setProfileLabels(prevLabels => {
      const currentEncodedIds = new Set(Array.from(prevLabels.keys()))
      const newEncodedIds = new Set(profileData.map(p => p.encoded))
      
      // If the content changed significantly (different set of profiles), reset state
      const hasDifferentProfiles = 
        currentEncodedIds.size !== newEncodedIds.size ||
        !Array.from(newEncodedIds).every(id => currentEncodedIds.has(id))
      
      if (hasDifferentProfiles) {
        // Clear pending updates for old profiles
        pendingUpdatesRef.current.clear()
        if (rafScheduledRef.current !== null) {
          cancelAnimationFrame(rafScheduledRef.current)
          rafScheduledRef.current = null
        }
        // Reset to initial labels
        return new Map(initialLabels)
      } else {
        // Same profiles, merge initial labels with existing state (initial labels take precedence for missing ones)
        const merged = new Map(prevLabels)
        for (const [encoded, label] of initialLabels.entries()) {
          // Only update if missing or if initial label has a better value (not a fallback)
          if (!merged.has(encoded) || (!prevLabels.get(encoded)?.startsWith('@') && label.startsWith('@'))) {
            merged.set(encoded, label)
          }
        }
        return merged
      }
    })
  }, [initialLabels, profileData])

  // Build initial labels: localStorage cache -> eventStore -> fetch from relays
  useEffect(() => {
    // Extract all pubkeys
    const allPubkeys = profileData.map(({ pubkey }) => pubkey)
    
    if (allPubkeys.length === 0) {
      setProfileLabels(new Map())
      // Clear pending updates when clearing labels
      pendingUpdatesRef.current.clear()
      if (rafScheduledRef.current !== null) {
        cancelAnimationFrame(rafScheduledRef.current)
        rafScheduledRef.current = null
      }
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
    
    // Fetch missing profiles asynchronously with reactive updates
    if (pubkeysToFetch.length > 0 && relayPool && eventStore) {
      const pubkeysToFetchSet = new Set(pubkeysToFetch)
      // Create a map from pubkey to encoded identifier for quick lookup
      const pubkeyToEncoded = new Map<string, string>()
      profileData.forEach(({ encoded, pubkey }) => {
        if (pubkeysToFetchSet.has(pubkey)) {
          pubkeyToEncoded.set(pubkey, encoded)
        }
      })
      
      console.log(`[profile-labels] Fetching ${pubkeysToFetch.length} profiles from relays`)
      console.log(`[profile-labels] Calling fetchProfiles with relayPool and ${pubkeysToFetch.length} pubkeys`)
      
      // Reactive callback: batch updates to prevent flickering
      const handleProfileEvent = (event: NostrEvent) => {
        const encoded = pubkeyToEncoded.get(event.pubkey)
        if (!encoded) {
          console.log(`[profile-labels] Received profile for unknown pubkey ${event.pubkey.slice(0, 16)}..., skipping`)
          return
        }
        
        console.log(`[profile-labels] Received profile event for ${encoded.slice(0, 20)}...`)
        
        // Determine the label for this profile
        let label: string
        try {
          const profileData = JSON.parse(event.content || '{}') as { name?: string; display_name?: string; nip05?: string }
          const displayName = profileData.display_name || profileData.name || profileData.nip05
          if (displayName) {
            label = `@${displayName}`
            console.log(`[profile-labels] Updated label reactively for ${encoded.slice(0, 20)}... to @${displayName}`)
          } else {
            // Use fallback npub display if profile has no name
            label = getNpubFallbackDisplay(event.pubkey)
            console.log(`[profile-labels] Profile for ${encoded.slice(0, 20)}... has no name, keeping fallback: ${label}`)
          }
        } catch (error) {
          // Use fallback npub display if parsing fails
          label = getNpubFallbackDisplay(event.pubkey)
          console.warn(`[profile-labels] Error parsing profile for ${encoded.slice(0, 20)}..., using fallback:`, error)
        }
        
        // Add to pending updates
        pendingUpdatesRef.current.set(encoded, label)
        
        // Schedule batched update if not already scheduled
        if (rafScheduledRef.current === null) {
          rafScheduledRef.current = requestAnimationFrame(() => {
            // Apply all pending updates in one batch
            setProfileLabels(prevLabels => {
              const updatedLabels = new Map(prevLabels)
              const pendingUpdates = pendingUpdatesRef.current
              
              // Apply all pending updates
              for (const [encoded, label] of pendingUpdates.entries()) {
                updatedLabels.set(encoded, label)
              }
              
              // Clear pending updates
              pendingUpdates.clear()
              rafScheduledRef.current = null
              
              return updatedLabels
            })
          })
        }
      }
      
      fetchProfiles(relayPool, eventStore as unknown as IEventStore, pubkeysToFetch, undefined, handleProfileEvent)
        .then((fetchedProfiles) => {
          console.log(`[profile-labels] Fetch completed (EOSE), received ${fetchedProfiles.length} profiles total`)
          
          // Ensure any pending batched updates are applied immediately after EOSE
          // This ensures all profile updates are applied even if RAF hasn't fired yet
          const pendingUpdates = pendingUpdatesRef.current
          const pendingCount = pendingUpdates.size
          
          // Cancel any pending RAF since we're applying updates synchronously now
          if (rafScheduledRef.current !== null) {
            cancelAnimationFrame(rafScheduledRef.current)
            rafScheduledRef.current = null
          }
          
          if (pendingCount > 0) {
            // Apply all pending updates synchronously
            setProfileLabels(prevLabels => {
              const updatedLabels = new Map(prevLabels)
              for (const [encoded, label] of pendingUpdates.entries()) {
                updatedLabels.set(encoded, label)
              }
              pendingUpdates.clear()
              console.log(`[profile-labels] Flushed ${pendingCount} pending updates after EOSE`)
              console.log(`[profile-labels] Final labels after EOSE:`, Array.from(updatedLabels.entries()).map(([enc, label]) => ({ encoded: enc.slice(0, 20) + '...', label })))
              return updatedLabels
            })
          } else {
            // No pending updates, just log final state
            setProfileLabels(prevLabels => {
              console.log(`[profile-labels] Final labels after EOSE:`, Array.from(prevLabels.entries()).map(([enc, label]) => ({ encoded: enc.slice(0, 20) + '...', label })))
              return prevLabels
            })
          }
        })
        .catch((error) => {
          console.error(`[profile-labels] Error fetching profiles:`, error)
          // Silently handle fetch errors
        })
      
      // Cleanup: flush any pending updates before clearing, then cancel RAF
      return () => {
        // Flush any pending updates before cleanup to avoid losing them
        const pendingUpdates = pendingUpdatesRef.current
        if (pendingUpdates.size > 0 && rafScheduledRef.current !== null) {
          // Cancel the scheduled RAF and apply updates immediately
          cancelAnimationFrame(rafScheduledRef.current)
          rafScheduledRef.current = null
          
          // Apply pending updates synchronously before cleanup
          setProfileLabels(prevLabels => {
            const updatedLabels = new Map(prevLabels)
            for (const [encoded, label] of pendingUpdates.entries()) {
              updatedLabels.set(encoded, label)
            }
            return updatedLabels
          })
          
          pendingUpdates.clear()
        } else if (rafScheduledRef.current !== null) {
          cancelAnimationFrame(rafScheduledRef.current)
          rafScheduledRef.current = null
        }
        pendingUpdatesRef.current.clear()
      }
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

