import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useEventModel } from 'applesauce-react/hooks'
import { Hooks } from 'applesauce-react'
import { Models, Helpers } from 'applesauce-core'
import { decode, npubEncode } from 'nostr-tools/nip19'
import { getProfileDisplayName } from '../utils/nostrUriResolver'
import { loadCachedProfiles } from '../services/profileService'

const { getPubkeyFromDecodeResult } = Helpers

interface ResolvedMentionProps {
  encoded?: string
}

const ResolvedMention: React.FC<ResolvedMentionProps> = ({ encoded }) => {
  if (!encoded) return null
  let pubkey: string | undefined
  try {
    pubkey = getPubkeyFromDecodeResult(decode(encoded))
  } catch {
    // ignore; will fallback to showing the encoded value
  }

  const eventStore = Hooks.useEventStore()
  const profile = pubkey ? useEventModel(Models.ProfileModel, [pubkey]) : undefined
  
  // Check if profile is in cache or eventStore
  const isInCacheOrStore = useMemo(() => {
    if (!pubkey) return false
    // Check cache
    const cached = loadCachedProfiles([pubkey])
    if (cached.has(pubkey)) {
      console.log(`[resolved-mention] ${encoded?.slice(0, 16)}... in cache`)
      return true
    }
    // Check eventStore
    const eventStoreProfile = eventStore?.getEvent(pubkey + ':0')
    const inStore = !!eventStoreProfile
    if (inStore) {
      console.log(`[resolved-mention] ${encoded?.slice(0, 16)}... in eventStore`)
    }
    return inStore
  }, [pubkey, eventStore, encoded])
  
  // Show loading if profile doesn't exist and not in cache/store
  const isLoading = !profile && pubkey && !isInCacheOrStore
  if (isLoading && encoded) {
    console.log(`[resolved-mention] ${encoded.slice(0, 16)}... isLoading=true (profile=${!!profile}, pubkey=${!!pubkey}, inCacheOrStore=${isInCacheOrStore})`)
  }
  
  const display = pubkey ? getProfileDisplayName(profile, pubkey) : encoded
  const npub = pubkey ? npubEncode(pubkey) : undefined

  if (npub) {
    const className = isLoading ? 'nostr-mention profile-loading' : 'nostr-mention'
    return (
      <Link
        to={`/p/${npub}`}
        className={className}
      >
        @{display}
      </Link>
    )
  }

  return <span className="nostr-mention">{encoded}</span>
}

export default ResolvedMention


