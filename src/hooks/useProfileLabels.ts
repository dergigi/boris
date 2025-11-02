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
    const pointers = getContentPointers(content)
    return pointers
      .filter(p => p.type === 'npub' || p.type === 'nprofile')
      .map(pointer => ({
        pubkey: getPubkeyFromDecodeResult(pointer),
        encoded: encodeDecodeResult(pointer)
      }))
      .filter(p => p.pubkey)
  }, [content])

  // Fetch profiles for all found pubkeys (progressive loading)
  const profiles = profileData.map(({ pubkey }) => 
    useEventModel(Models.ProfileModel, pubkey ? [pubkey] : null)
  )

  // Build profile labels map that updates reactively as profiles load
  return useMemo(() => {
    const labels = new Map<string, string>()
    profileData.forEach(({ encoded }, index) => {
      const profile = profiles[index]
      if (profile) {
        const displayName = profile.name || profile.display_name || profile.nip05
        if (displayName) {
          labels.set(encoded, `@${displayName}`)
        }
      }
    })
    return labels
  }, [profileData, profiles])
}

