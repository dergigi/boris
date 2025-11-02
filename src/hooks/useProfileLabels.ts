import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Hooks } from 'applesauce-react'
import { Helpers, IEventStore } from 'applesauce-core'
import { getContentPointers } from 'applesauce-factory/helpers'
import { RelayPool } from 'applesauce-relay'
import { NostrEvent } from 'nostr-tools'
import { fetchProfiles, loadCachedProfiles } from '../services/profileService'
import { getNpubFallbackDisplay } from '../utils/nostrUriResolver'
import { extractProfileDisplayName } from '../utils/profileUtils'

const { getPubkeyFromDecodeResult, encodeDecodeResult } = Helpers

/**
 * Hook to resolve profile labels from content containing npub/nprofile identifiers
 * Returns an object with labels Map and loading Map that updates progressively as profiles load
 */
export function useProfileLabels(
  content: string, 
  relayPool?: RelayPool | null
): { labels: Map<string, string>; loading: Map<string, boolean> } {
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
    } catch (error) {
      console.warn(`[profile-labels] Error extracting profile pointers:`, error)
      return []
    }
  }, [content])

  // Initialize labels synchronously from cache on first render to avoid delay
  // Use pubkey (hex) as the key instead of encoded string for canonical identification
  const initialLabels = useMemo(() => {
    if (profileData.length === 0) {
      return new Map<string, string>()
    }
    
    const allPubkeys = profileData.map(({ pubkey }) => pubkey)
    const cachedProfiles = loadCachedProfiles(allPubkeys)
    const labels = new Map<string, string>()
    
    profileData.forEach(({ pubkey }) => {
      const cachedProfile = cachedProfiles.get(pubkey)
      if (cachedProfile) {
        const displayName = extractProfileDisplayName(cachedProfile)
        if (displayName) {
          // Only add @ prefix if we have a real name, otherwise use fallback format directly
          const label = displayName.startsWith('@') ? displayName : `@${displayName}`
          labels.set(pubkey, label)
        } else {
          // Use fallback npub display if profile has no name
          const fallback = getNpubFallbackDisplay(pubkey)
          labels.set(pubkey, fallback)
        }
      }
    })
    
    return labels
  }, [profileData])

  const [profileLabels, setProfileLabels] = useState<Map<string, string>>(initialLabels)
  const [profileLoading, setProfileLoading] = useState<Map<string, boolean>>(new Map())
  
  // Batching strategy: Collect profile updates and apply them in batches via RAF to prevent UI flicker
  // when many profiles resolve simultaneously. We use refs to avoid stale closures in async callbacks.
  // Use pubkey (hex) as the key for canonical identification
  const pendingUpdatesRef = useRef<Map<string, string>>(new Map())
  const rafScheduledRef = useRef<number | null>(null)
  
  /**
   * Helper to apply pending batched updates to state
   * Cancels any scheduled RAF and applies updates synchronously
   */
  const applyPendingUpdates = () => {
    const pendingUpdates = pendingUpdatesRef.current
    if (pendingUpdates.size === 0) return
    
    // Cancel scheduled RAF since we're applying synchronously
    if (rafScheduledRef.current !== null) {
      cancelAnimationFrame(rafScheduledRef.current)
      rafScheduledRef.current = null
    }
    
    // Apply all pending updates in one batch
    setProfileLabels(prevLabels => {
      const updatedLabels = new Map(prevLabels)
      for (const [encoded, label] of pendingUpdates.entries()) {
        updatedLabels.set(encoded, label)
      }
      pendingUpdates.clear()
      return updatedLabels
    })
  }
  
  /**
   * Helper to schedule a batched update via RAF (if not already scheduled)
   * This prevents multiple RAF calls when many profiles resolve at once
   * Wrapped in useCallback for stable reference in dependency arrays
   */
  const scheduleBatchedUpdate = useCallback(() => {
    if (rafScheduledRef.current === null) {
      rafScheduledRef.current = requestAnimationFrame(() => {
        applyPendingUpdates()
        rafScheduledRef.current = null
      })
    }
  }, []) // Empty deps: only uses refs which are stable
  
    // Sync state when initialLabels changes (e.g., when content changes)
  // This ensures we start with the correct cached labels even if profiles haven't loaded yet
  useEffect(() => {
    // Use a functional update to access current state without including it in dependencies
    setProfileLabels(prevLabels => {
      const currentPubkeys = new Set(Array.from(prevLabels.keys()))
      const newPubkeys = new Set(profileData.map(p => p.pubkey))
      
      // If the content changed significantly (different set of profiles), reset state
      const hasDifferentProfiles = 
        currentPubkeys.size !== newPubkeys.size ||
        !Array.from(newPubkeys).every(pk => currentPubkeys.has(pk))
      
      if (hasDifferentProfiles) {
        // Clear pending updates and cancel RAF for old profiles
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
        for (const [pubkey, label] of initialLabels.entries()) {
          // Only update if missing or if initial label has a better value (not a fallback)
          if (!merged.has(pubkey) || (!prevLabels.get(pubkey)?.startsWith('@') && label.startsWith('@'))) {
            merged.set(pubkey, label)
          }
        }
        return merged
      }
    })
    
    // Reset loading state when content changes significantly
    setProfileLoading(prevLoading => {
      const currentPubkeys = new Set(Array.from(prevLoading.keys()))
      const newPubkeys = new Set(profileData.map(p => p.pubkey))
      
      const hasDifferentProfiles = 
        currentPubkeys.size !== newPubkeys.size ||
        !Array.from(newPubkeys).every(pk => currentPubkeys.has(pk))
      
      if (hasDifferentProfiles) {
        return new Map()
      }
      return prevLoading
    })
  }, [initialLabels, profileData])

  // Build initial labels: localStorage cache -> eventStore -> fetch from relays
  useEffect(() => {
    // Extract all pubkeys
    const allPubkeys = profileData.map(({ pubkey }) => pubkey)
    
    if (allPubkeys.length === 0) {
      setProfileLabels(new Map())
      setProfileLoading(new Map())
      // Clear pending updates and cancel RAF when clearing labels
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
    // Use pubkey (hex) as the key for canonical identification
    const labels = new Map<string, string>(initialLabels)
    const loading = new Map<string, boolean>()
    
    const pubkeysToFetch: string[] = []
    
    profileData.forEach(({ pubkey }) => {
      // Skip if already resolved from initial cache
      if (labels.has(pubkey)) {
        loading.set(pubkey, false)
        console.log(`[profile-loading-debug][profile-labels-loading] ${pubkey.slice(0, 16)}... in cache, not loading`)
        return
      }
      
      // Check EventStore for profiles that weren't in cache
      const eventStoreProfile = eventStore?.getEvent(pubkey + ':0')
      
      if (eventStoreProfile && eventStore) {
        // Extract display name using centralized utility
        const displayName = extractProfileDisplayName(eventStoreProfile as NostrEvent)
        if (displayName) {
          // Only add @ prefix if we have a real name, otherwise use fallback format directly
          const label = displayName.startsWith('@') ? displayName : `@${displayName}`
          labels.set(pubkey, label)
        } else {
          // Use fallback npub display if profile has no name
          const fallback = getNpubFallbackDisplay(pubkey)
          labels.set(pubkey, fallback)
        }
        loading.set(pubkey, false)
        console.log(`[profile-loading-debug][profile-labels-loading] ${pubkey.slice(0, 16)}... in eventStore, not loading`)
      } else {
      // No profile found yet, will use fallback after fetch or keep empty
      // We'll set fallback labels for missing profiles at the end
      // Mark as loading since we'll fetch it
      pubkeysToFetch.push(pubkey)
      loading.set(pubkey, true)
      console.log(`[profile-loading-debug][profile-labels-loading] ${pubkey.slice(0, 16)}... not found, SET LOADING=true`)
      console.log(`[shimmer-debug][profile-labels] Marking profile as loading: ${pubkey.slice(0, 16)}..., will need to fetch`)
      }
    })
    
    // Don't set fallback labels in the Map - we'll use fallback directly when rendering
    // This allows us to distinguish between "no label yet" (use fallback) vs "resolved label" (use Map value)
    
    setProfileLabels(new Map(labels))
    setProfileLoading(new Map(loading))
    console.log(`[profile-loading-debug][profile-labels-loading] Initial loading state:`, Array.from(loading.entries()).map(([pk, l]) => `${pk.slice(0, 16)}...=${l}`))
    console.log(`[shimmer-debug][profile-labels] Set initial loading state, loading count=${Array.from(loading.values()).filter(l => l).length}, total profiles=${loading.size}`)
    
    // Fetch missing profiles asynchronously with reactive updates
    if (pubkeysToFetch.length > 0 && relayPool && eventStore) {
      console.log(`[profile-loading-debug][profile-labels-loading] Starting fetch for ${pubkeysToFetch.length} profiles:`, pubkeysToFetch.map(p => p.slice(0, 16) + '...'))
      
      // Reactive callback: collects profile updates and batches them via RAF to prevent flicker
      // Strategy: Collect updates in ref, schedule RAF on first update, apply all in batch
      const handleProfileEvent = (event: NostrEvent) => {
        // Use pubkey directly as the key
        const pubkey = event.pubkey
        
        // Determine the label for this profile using centralized utility
        const displayName = extractProfileDisplayName(event)
        const label = displayName ? (displayName.startsWith('@') ? displayName : `@${displayName}`) : getNpubFallbackDisplay(pubkey)
        
        // Add to pending updates and schedule batched application
        pendingUpdatesRef.current.set(pubkey, label)
        scheduleBatchedUpdate()
        
        // Clear loading state for this profile when it resolves
        console.log(`[profile-loading-debug][profile-labels-loading] Profile resolved for ${pubkey.slice(0, 16)}..., CLEARING LOADING`)
        console.log(`[shimmer-debug][profile-labels] Profile resolved: ${pubkey.slice(0, 16)}..., setting loading=false, label="${label}"`)
        setProfileLoading(prevLoading => {
          const updated = new Map(prevLoading)
          const wasLoading = updated.get(pubkey) === true
          updated.set(pubkey, false)
          console.log(`[shimmer-debug][profile-labels] Updated loading state: ${pubkey.slice(0, 16)}... wasLoading=${wasLoading}, nowLoading=${updated.get(pubkey)}`)
          return updated
        })
      }
      
      fetchProfiles(relayPool, eventStore as unknown as IEventStore, pubkeysToFetch, undefined, handleProfileEvent)
        .then(() => {
          // After EOSE: apply any remaining pending updates immediately
          // This ensures all profile updates are applied even if RAF hasn't fired yet
          applyPendingUpdates()
          
          // Clear loading state for all fetched profiles
          console.log(`[profile-loading-debug][profile-labels-loading] Fetch complete, clearing loading for all ${pubkeysToFetch.length} profiles`)
          console.log(`[shimmer-debug][profile-labels] Fetch complete, clearing loading for ${pubkeysToFetch.length} profiles`)
          setProfileLoading(prevLoading => {
            const updated = new Map(prevLoading)
            const loadingCountBefore = Array.from(updated.values()).filter(l => l).length
            pubkeysToFetch.forEach(pubkey => {
              const wasLoading = updated.get(pubkey)
              updated.set(pubkey, false)
              if (wasLoading) {
                console.log(`[profile-loading-debug][profile-labels-loading] ${pubkey.slice(0, 16)}... CLEARED loading after fetch complete`)
              }
            })
            const loadingCountAfter = Array.from(updated.values()).filter(l => l).length
            console.log(`[shimmer-debug][profile-labels] Loading state after fetch complete: ${loadingCountBefore} -> ${loadingCountAfter} loading profiles`)
            return updated
          })
        })
        .catch((error) => {
          console.error(`[profile-labels] Error fetching profiles:`, error)
          // Silently handle fetch errors, but still clear any pending updates
          pendingUpdatesRef.current.clear()
          if (rafScheduledRef.current !== null) {
            cancelAnimationFrame(rafScheduledRef.current)
            rafScheduledRef.current = null
          }
          
          // Clear loading state on error (show fallback)
          setProfileLoading(prevLoading => {
            const updated = new Map(prevLoading)
            pubkeysToFetch.forEach(pubkey => {
              updated.set(pubkey, false)
            })
            return updated
          })
        })
      
      // Cleanup: apply any pending updates before unmount to avoid losing them
      return () => {
        applyPendingUpdates()
      }
    }
  }, [profileData, eventStore, relayPool, initialLabels, scheduleBatchedUpdate])
  
  return { labels: profileLabels, loading: profileLoading }
}

