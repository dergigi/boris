import { useMemo, useState, useEffect } from 'react'
import { Hooks } from 'applesauce-react'
import { Helpers, IEventStore } from 'applesauce-core'
import { getContentPointers } from 'applesauce-factory/helpers'
import { RelayPool } from 'applesauce-relay'
import { fetchProfiles } from '../services/profileService'

const { getPubkeyFromDecodeResult, encodeDecodeResult } = Helpers

/**
 * Hook to resolve profile labels from content containing npub/nprofile identifiers
 * Returns a Map of encoded identifier -> display name that updates progressively as profiles load
 */
export function useProfileLabels(content: string, relayPool?: RelayPool | null): Map<string, string> {
  const eventStore = Hooks.useEventStore()
  
  // Extract profile pointers (npub and nprofile) using applesauce helpers
  const profileData = useMemo(() => {
      console.log('[npub-resolve] Processing content, length:', content?.length || 0)
      try {
        const pointers = getContentPointers(content)
        console.log('[npub-resolve] Found pointers:', pointers.length, 'types:', pointers.map(p => p.type))
        const filtered = pointers.filter(p => p.type === 'npub' || p.type === 'nprofile')
        console.log('[npub-resolve] Profile pointers:', filtered.length)
      const result: Array<{ pubkey: string; encoded: string }> = []
      filtered.forEach(pointer => {
        try {
          const pubkey = getPubkeyFromDecodeResult(pointer)
          const encoded = encodeDecodeResult(pointer)
          if (pubkey && encoded) {
            result.push({ pubkey, encoded: encoded as string })
          }
        } catch (err) {
            console.error('[npub-resolve] Error processing pointer:', err, pointer)
        }
      })
      console.log('[npub-resolve] Profile data after filtering:', result.length)
      return result
    } catch (err) {
      console.error('[npub-resolve] Error extracting pointers:', err)
      return []
    }
  }, [content])

  const [profileLabels, setProfileLabels] = useState<Map<string, string>>(new Map())

  // Build initial labels from eventStore, then fetch missing profiles
  useEffect(() => {
    console.log('[npub-resolve] Building labels, profileData:', profileData.length, 'hasEventStore:', !!eventStore)
    
    // First, get profiles from eventStore synchronously
    const labels = new Map<string, string>()
    const pubkeysToFetch: string[] = []
    
    profileData.forEach(({ encoded, pubkey }) => {
      if (eventStore) {
        const profileEvent = eventStore.getEvent(pubkey + ':0')
        if (profileEvent) {
          try {
            const profileData = JSON.parse(profileEvent.content || '{}') as { name?: string; display_name?: string; nip05?: string }
            const displayName = profileData.display_name || profileData.name || profileData.nip05
            if (displayName) {
              labels.set(encoded, `@${displayName}`)
              console.log('[npub-resolve] Found in eventStore:', encoded, '->', displayName)
            } else {
              pubkeysToFetch.push(pubkey)
            }
          } catch {
            pubkeysToFetch.push(pubkey)
          }
        } else {
          pubkeysToFetch.push(pubkey)
        }
      } else {
        pubkeysToFetch.push(pubkey)
      }
    })
    
    // Update labels with what we found in eventStore
    setProfileLabels(new Map(labels))
    
    // Fetch missing profiles asynchronously
    if (pubkeysToFetch.length > 0 && relayPool && eventStore) {
      console.log('[npub-resolve] Fetching', pubkeysToFetch.length, 'missing profiles:', pubkeysToFetch.slice(0, 3).map(p => p.slice(0, 8) + '...'))
      fetchProfiles(relayPool, eventStore as unknown as IEventStore, pubkeysToFetch)
        .then(() => {
          // Re-check eventStore periodically as profiles arrive asynchronously
          let checkCount = 0
          const maxChecks = 10
          const checkInterval = 200 // ms
          
          // Keep track of resolved labels across checks
          let currentLabels = new Map(labels)
          
          const checkForProfiles = () => {
            checkCount++
            const updatedLabels = new Map(currentLabels)
            let newlyResolvedCount = 0
            let withEventsCount = 0
            let withoutNamesCount = 0
            
            profileData.forEach(({ encoded, pubkey }) => {
              if (!updatedLabels.has(encoded) && eventStore) {
                const profileEvent = eventStore.getEvent(pubkey + ':0')
                if (profileEvent) {
                  withEventsCount++
                  try {
                    const profileData = JSON.parse(profileEvent.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                    const displayName = profileData.display_name || profileData.name || profileData.nip05
                    if (displayName) {
                      updatedLabels.set(encoded, `@${displayName}`)
                      newlyResolvedCount++
                      console.log('[npub-resolve] Resolved profile:', encoded.slice(0, 20) + '...', '->', displayName)
                    } else {
                      withoutNamesCount++
                      if (checkCount === 1) { // Only log once on first check
                        console.log('[npub-resolve] Profile has no name:', encoded.slice(0, 20) + '...', 'content keys:', Object.keys(profileData))
                      }
                    }
                  } catch (err) {
                    console.error('[npub-resolve] Error parsing profile:', encoded.slice(0, 20) + '...', err)
                  }
                }
              }
            })
            
            currentLabels = updatedLabels
            console.log('[npub-resolve] Check', checkCount, '- resolved:', updatedLabels.size, 'total,', newlyResolvedCount, 'new,', withEventsCount, 'with events,', withoutNamesCount, 'without names')
            setProfileLabels(updatedLabels)
            
            // Continue checking if we haven't resolved all profiles and haven't exceeded max checks
            if (updatedLabels.size < profileData.length && checkCount < maxChecks) {
              setTimeout(checkForProfiles, checkInterval)
            } else if (updatedLabels.size < profileData.length) {
              console.warn('[npub-resolve] Stopped checking after', checkCount, 'attempts. Resolved', updatedLabels.size, 'out of', profileData.length)
            }
          }
          
          // Start checking immediately, then periodically
          checkForProfiles()
        })
        .catch(err => {
          console.error('[npub-resolve] Error fetching profiles:', err)
        })
    }
  }, [profileData, eventStore, relayPool])

  console.log('[npub-resolve] Final labels map size:', profileLabels.size)
  return profileLabels
}

