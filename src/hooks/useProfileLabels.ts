import { useMemo, useState, useEffect, useRef } from 'react'
import { Hooks } from 'applesauce-react'
import { Helpers, IEventStore } from 'applesauce-core'
import { getContentPointers } from 'applesauce-factory/helpers'
import { RelayPool } from 'applesauce-relay'
import { fetchProfiles } from '../services/profileService'

const { getPubkeyFromDecodeResult, encodeDecodeResult } = Helpers

// Helper to add timestamps to logs
const ts = () => {
  const now = new Date()
  const ms = now.getMilliseconds().toString().padStart(3, '0')
  return `${now.toLocaleTimeString('en-US', { hour12: false })}.${ms}`
}

/**
 * Hook to resolve profile labels from content containing npub/nprofile identifiers
 * Returns a Map of encoded identifier -> display name that updates progressively as profiles load
 */
export function useProfileLabels(content: string, relayPool?: RelayPool | null): Map<string, string> {
  const eventStore = Hooks.useEventStore()
  
  // Extract profile pointers (npub and nprofile) using applesauce helpers
  const profileData = useMemo(() => {
      console.log(`[${ts()}] [npub-resolve] Processing content, length:`, content?.length || 0)
      try {
        const pointers = getContentPointers(content)
        console.log(`[${ts()}] [npub-resolve] Found pointers:`, pointers.length, 'types:', pointers.map(p => p.type))
        const filtered = pointers.filter(p => p.type === 'npub' || p.type === 'nprofile')
        console.log(`[${ts()}] [npub-resolve] Profile pointers:`, filtered.length)
      const result: Array<{ pubkey: string; encoded: string }> = []
      filtered.forEach(pointer => {
        try {
          const pubkey = getPubkeyFromDecodeResult(pointer)
          const encoded = encodeDecodeResult(pointer)
          if (pubkey && encoded) {
            result.push({ pubkey, encoded: encoded as string })
          }
        } catch (err) {
            console.error(`[${ts()}] [npub-resolve] Error processing pointer:`, err, pointer)
        }
      })
      console.log(`[${ts()}] [npub-resolve] Profile data after filtering:`, result.length)
      return result
    } catch (err) {
      console.error(`[${ts()}] [npub-resolve] Error extracting pointers:`, err)
      return []
    }
  }, [content])

  const [profileLabels, setProfileLabels] = useState<Map<string, string>>(new Map())
  const lastLoggedSize = useRef<number>(0)

  // Build initial labels from eventStore, then fetch missing profiles
  useEffect(() => {
    const startTime = Date.now()
    console.log(`[${ts()}] [npub-resolve] Building labels, profileData:`, profileData.length, 'hasEventStore:', !!eventStore)
    
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
              console.log(`[${ts()}] [npub-resolve] Found in eventStore:`, encoded, '->', displayName)
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
      const fetchStartTime = Date.now()
      console.log(`[${ts()}] [npub-resolve] Fetching`, pubkeysToFetch.length, 'missing profiles')
      fetchProfiles(relayPool, eventStore as unknown as IEventStore, pubkeysToFetch)
        .then((fetchedProfiles) => {
          const fetchDuration = Date.now() - fetchStartTime
          console.log(`[${ts()}] [npub-resolve] fetchProfiles returned`, fetchedProfiles.length, 'profiles in', fetchDuration, 'ms')
          
          // First, use the profiles returned from fetchProfiles directly
          const updatedLabels = new Map(labels)
          const fetchedProfilesByPubkey = new Map(fetchedProfiles.map(p => [p.pubkey, p]))
          
          let resolvedFromArray = 0
          let resolvedFromStore = 0
          let withNames = 0
          let withoutNames = 0
          let missingFromStore = 0
          
          profileData.forEach(({ encoded, pubkey }) => {
            if (!updatedLabels.has(encoded)) {
              // First, try to use the profile from the returned array
              const fetchedProfile = fetchedProfilesByPubkey.get(pubkey)
              if (fetchedProfile) {
                resolvedFromArray++
                try {
                  const profileData = JSON.parse(fetchedProfile.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                  const displayName = profileData.display_name || profileData.name || profileData.nip05
                  if (displayName) {
                    updatedLabels.set(encoded, `@${displayName}`)
                    withNames++
                    console.log(`[${ts()}] [npub-resolve] Resolved from fetched array:`, encoded.slice(0, 30) + '...', '->', displayName)
                  } else {
                    withoutNames++
                    if (withoutNames <= 3) {
                      console.log(`[${ts()}] [npub-resolve] Fetched profile has no name/display_name/nip05:`, encoded.slice(0, 30) + '...', 'content keys:', Object.keys(profileData))
                    }
                  }
                } catch (err) {
                  console.error(`[${ts()}] [npub-resolve] Error parsing fetched profile for`, encoded.slice(0, 30) + '...', err)
                }
              } else if (eventStore) {
                // Fallback: check eventStore (in case fetchProfiles stored but didn't return)
                const profileEvent = eventStore.getEvent(pubkey + ':0')
                if (profileEvent) {
                  resolvedFromStore++
                  try {
                    const profileData = JSON.parse(profileEvent.content || '{}') as { name?: string; display_name?: string; nip05?: string }
                    const displayName = profileData.display_name || profileData.name || profileData.nip05
                    if (displayName) {
                      updatedLabels.set(encoded, `@${displayName}`)
                      withNames++
                      console.log(`[${ts()}] [npub-resolve] Resolved from eventStore:`, encoded.slice(0, 30) + '...', '->', displayName)
                    }
                  } catch (err) {
                    console.error(`[${ts()}] [npub-resolve] Error parsing profile event for`, encoded.slice(0, 30) + '...', err)
                  }
                } else {
                  missingFromStore++
                  if (missingFromStore <= 3) {
                    console.log(`[${ts()}] [npub-resolve] Profile not found in array or eventStore:`, pubkey.slice(0, 16) + '...')
                  }
                }
              } else {
                missingFromStore++
              }
            }
          })
          
          const totalDuration = Date.now() - startTime
          console.log(`[${ts()}] [npub-resolve] After fetch - resolved:`, updatedLabels.size, 'total | from array:', resolvedFromArray, '| from store:', resolvedFromStore, '| with names:', withNames, '| without names:', withoutNames, '| missing:', missingFromStore, '| out of', profileData.length, '| total time:', totalDuration, 'ms')
          setProfileLabels(updatedLabels)
        })
        .catch(err => {
          const fetchDuration = Date.now() - fetchStartTime
          console.error(`[${ts()}] [npub-resolve] Error fetching profiles after`, fetchDuration, 'ms:', err)
        })
    }
  }, [profileData, eventStore, relayPool])

  // Only log when size actually changes to reduce noise
  useEffect(() => {
    if (profileLabels.size !== lastLoggedSize.current) {
      console.log(`[${ts()}] [npub-resolve] Final labels map size:`, profileLabels.size)
      lastLoggedSize.current = profileLabels.size
    }
  }, [profileLabels.size])
  
  return profileLabels
}

