import { useMemo } from 'react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models, Helpers } from 'applesauce-core'
import { getContentPointers } from 'applesauce-factory/helpers'

const { getPubkeyFromDecodeResult, encodeDecodeResult } = Helpers

/**
 * Hook to resolve profile labels from content containing npub/nprofile identifiers
 * Returns a Map of encoded identifier -> display name that updates progressively as profiles load
 */
export function useProfileLabels(content: string): Map<string, string> {
  // Extract profile pointers (npub and nprofile) using applesauce helpers
  const profileData = useMemo(() => {
    console.log('[useProfileLabels] Processing content, length:', content?.length || 0)
    try {
      const pointers = getContentPointers(content)
      console.log('[useProfileLabels] Found pointers:', pointers.length, 'types:', pointers.map(p => p.type))
      const filtered = pointers.filter(p => p.type === 'npub' || p.type === 'nprofile')
      console.log('[useProfileLabels] Profile pointers:', filtered.length)
      const result = filtered
        .map(pointer => {
          try {
            return {
              pubkey: getPubkeyFromDecodeResult(pointer),
              encoded: encodeDecodeResult(pointer)
            }
          } catch (err) {
            console.error('[useProfileLabels] Error processing pointer:', err, pointer)
            return null
          }
        })
        .filter((p): p is { pubkey: string; encoded: string } => p !== null && !!p.pubkey)
      console.log('[useProfileLabels] Profile data after filtering:', result.length)
      return result
    } catch (err) {
      console.error('[useProfileLabels] Error extracting pointers:', err)
      return []
    }
  }, [content])

  // Fetch profiles for all found pubkeys (progressive loading)
  const profiles = profileData.map(({ pubkey }) => 
    useEventModel(Models.ProfileModel, pubkey ? [pubkey] : null)
  )

  // Build profile labels map that updates reactively as profiles load
  return useMemo(() => {
    const labels = new Map<string, string>()
    console.log('[useProfileLabels] Building labels map, profileData:', profileData.length, 'profiles:', profiles.length)
    profileData.forEach(({ encoded }, index) => {
      const profile = profiles[index]
      if (profile) {
        const displayName = profile.name || profile.display_name || profile.nip05
        if (displayName) {
          labels.set(encoded, `@${displayName}`)
          console.log('[useProfileLabels] Set label:', encoded, '->', displayName)
        }
      }
    })
    console.log('[useProfileLabels] Final labels map size:', labels.size)
    return labels
  }, [profileData, profiles])
}

