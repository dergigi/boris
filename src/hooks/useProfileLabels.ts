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
      console.log('[npub-resolve] Fetching', pubkeysToFetch.length, 'missing profiles')
      fetchProfiles(relayPool, eventStore as unknown as IEventStore, pubkeysToFetch)
        .then((fetchedProfiles) => {
          console.log('[npub-resolve] fetchProfiles returned', fetchedProfiles.length, 'profiles')
          
          // Re-check eventStore for all profiles (including ones we just fetched)
          // This ensures we get profiles even if fetchProfiles didn't return them in the array
          const updatedLabels = new Map(labels)
          let foundInStore = 0
          let withNames = 0
          let withoutNames = 0
          let missingFromStore = 0
          
          profileData.forEach(({ encoded, pubkey }) => {
            if (!updatedLabels.has(encoded) && eventStore) {
              const profileEvent = eventStore.getEvent(pubkey + ':0')
              if (profileEvent) {
                foundInStore++
                try {
                  const profileData = JSON.parse(profileEvent.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                  const displayName = profileData.display_name || profileData.name || profileData.nip05
                  if (displayName) {
                    updatedLabels.set(encoded, `@${displayName}`)
                    withNames++
                    console.log('[npub-resolve] Resolved profile:', encoded.slice(0, 30) + '...', '->', displayName)
                  } else {
                    withoutNames++
                    if (withoutNames <= 3) { // Log first few for debugging
                      console.log('[npub-resolve] Profile event found but no name/display_name/nip05:', encoded.slice(0, 30) + '...', 'content keys:', Object.keys(profileData))
                    }
                  }
                } catch (err) {
                  console.error('[npub-resolve] Error parsing profile event for', encoded.slice(0, 30) + '...', err)
                }
              } else {
                missingFromStore++
                if (missingFromStore <= 3) { // Log first few for debugging
                  console.log('[npub-resolve] Profile not in eventStore after fetch:', pubkey.slice(0, 16) + '...')
                }
              }
            }
          })
          
          console.log('[npub-resolve] After fetch - resolved:', updatedLabels.size, 'total | found in store:', foundInStore, '| with names:', withNames, '| without names:', withoutNames, '| missing:', missingFromStore, '| out of', profileData.length)
          setProfileLabels(updatedLabels)
        })
        .catch(err => {
          console.error('[npub-resolve] Error fetching profiles:', err)
        })
    }
  }, [profileData, eventStore, relayPool])

  console.log('[npub-resolve] Final labels map size:', profileLabels.size)
  return profileLabels
}

