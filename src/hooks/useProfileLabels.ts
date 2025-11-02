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
    console.log('[useProfileLabels] Processing content, length:', content?.length || 0)
    try {
      const pointers = getContentPointers(content)
      console.log('[useProfileLabels] Found pointers:', pointers.length, 'types:', pointers.map(p => p.type))
      const filtered = pointers.filter(p => p.type === 'npub' || p.type === 'nprofile')
      console.log('[useProfileLabels] Profile pointers:', filtered.length)
      const result: Array<{ pubkey: string; encoded: string }> = []
      filtered.forEach(pointer => {
        try {
          const pubkey = getPubkeyFromDecodeResult(pointer)
          const encoded = encodeDecodeResult(pointer)
          if (pubkey && encoded) {
            result.push({ pubkey, encoded: encoded as string })
          }
        } catch (err) {
          console.error('[useProfileLabels] Error processing pointer:', err, pointer)
        }
      })
      console.log('[useProfileLabels] Profile data after filtering:', result.length)
      return result
    } catch (err) {
      console.error('[useProfileLabels] Error extracting pointers:', err)
      return []
    }
  }, [content])

  const [profileLabels, setProfileLabels] = useState<Map<string, string>>(new Map())

  // Build initial labels from eventStore, then fetch missing profiles
  useEffect(() => {
    console.log('[useProfileLabels] Building labels, profileData:', profileData.length, 'hasEventStore:', !!eventStore)
    
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
              console.log('[useProfileLabels] Found in eventStore:', encoded, '->', displayName)
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
      console.log('[useProfileLabels] Fetching', pubkeysToFetch.length, 'missing profiles')
      fetchProfiles(relayPool, eventStore as unknown as IEventStore, pubkeysToFetch)
        .then(profiles => {
          // Rebuild labels map with fetched profiles
          const updatedLabels = new Map(labels)
          profileData.forEach(({ encoded, pubkey }) => {
            if (!updatedLabels.has(encoded)) {
              const profileEvent = profiles.find(p => p.pubkey === pubkey)
              if (profileEvent) {
                try {
                  const profileData = JSON.parse(profileEvent.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                  const displayName = profileData.display_name || profileData.name || profileData.nip05
                  if (displayName) {
                    updatedLabels.set(encoded, `@${displayName}`)
                    console.log('[useProfileLabels] Fetched profile:', encoded, '->', displayName)
                  }
                } catch {
                  // ignore parse errors
                }
              }
            }
          })
          setProfileLabels(updatedLabels)
        })
        .catch(err => {
          console.error('[useProfileLabels] Error fetching profiles:', err)
        })
    }
  }, [profileData, eventStore, relayPool])

  console.log('[useProfileLabels] Final labels map size:', profileLabels.size)
  return profileLabels
}

