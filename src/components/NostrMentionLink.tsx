import React, { useMemo } from 'react'
import { nip19 } from 'nostr-tools'
import { useEventModel } from 'applesauce-react/hooks'
import { Hooks } from 'applesauce-react'
import { Models, Helpers } from 'applesauce-core'
import { getProfileDisplayName } from '../utils/nostrUriResolver'
import { isProfileInCacheOrStore } from '../utils/profileLoadingUtils'

const { getPubkeyFromDecodeResult } = Helpers

interface NostrMentionLinkProps {
  nostrUri: string
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

/**
 * Component to render nostr mentions with resolved profile names
 * Handles npub, nprofile, note, nevent, and naddr URIs
 */
const NostrMentionLink: React.FC<NostrMentionLinkProps> = ({ 
  nostrUri, 
  onClick,
  className = 'highlight-comment-link'
}) => {
  // Decode the nostr URI first
  let decoded: ReturnType<typeof nip19.decode> | null = null
  
  try {
    const identifier = nostrUri.replace(/^nostr:/, '')
    decoded = nip19.decode(identifier)
  } catch (error) {
    // Decoding failed, will fallback to shortened identifier
  }
  
  // Extract pubkey for profile fetching using applesauce helper (works for npub and nprofile)
  const pubkey = decoded ? getPubkeyFromDecodeResult(decoded) : undefined
  
  const eventStore = Hooks.useEventStore()
  // Fetch profile at top level (Rules of Hooks)
  const profile = useEventModel(Models.ProfileModel, pubkey ? [pubkey] : null)
  
  // Check if profile is in cache or eventStore for loading detection
  const isInCacheOrStore = useMemo(() => {
    if (!pubkey) return false
    return isProfileInCacheOrStore(pubkey, eventStore)
  }, [pubkey, eventStore])
  
  // Show loading if profile doesn't exist and not in cache/store (for npub/nprofile)
  // pubkey will be undefined for non-profile types, so no need for explicit type check
  const isLoading = !profile && pubkey && !isInCacheOrStore
  
  // If decoding failed, show shortened identifier
  if (!decoded) {
    const identifier = nostrUri.replace(/^nostr:/, '')
    return (
      <span className="highlight-comment-nostr-id">
        {identifier.slice(0, 20)}...
      </span>
    )
  }
  
  // Helper function to render profile links (used for both npub and nprofile)
  const renderProfileLink = (pubkey: string) => {
    const npub = nip19.npubEncode(pubkey)
    const displayName = getProfileDisplayName(profile, pubkey)
    const linkClassName = isLoading ? `${className} profile-loading` : className
    
    return (
      <a
        href={`/p/${npub}`}
        className={linkClassName}
        onClick={onClick}
      >
        @{displayName}
      </a>
    )
  }

  // Render based on decoded type
  // If we have a pubkey (from npub/nprofile), render profile link directly
  if (pubkey) {
    return renderProfileLink(pubkey)
  }
  
  switch (decoded.type) {
    case 'naddr': {
      const { kind, pubkey: pk, identifier: addrIdentifier } = decoded.data
      // Check if it's a blog post (kind:30023)
      if (kind === 30023) {
        const naddr = nip19.naddrEncode({ kind, pubkey: pk, identifier: addrIdentifier })
        return (
          <a
            href={`/a/${naddr}`}
            className={className}
            onClick={onClick}
          >
            {addrIdentifier || 'Article'}
          </a>
        )
      }
      // For other kinds, show shortened identifier
      return (
        <span className="highlight-comment-nostr-id">
          nostr:{addrIdentifier.slice(0, 12)}...
        </span>
      )
    }
    case 'note': {
      const eventId = decoded.data
      return (
        <span className="highlight-comment-nostr-id">
          note:{eventId.slice(0, 12)}...
        </span>
      )
    }
    case 'nevent': {
      const { id } = decoded.data
      return (
        <span className="highlight-comment-nostr-id">
          event:{id.slice(0, 12)}...
        </span>
      )
    }
    default: {
      // Fallback for unrecognized types
      const identifier = nostrUri.replace(/^nostr:/, '')
      return (
        <span className="highlight-comment-nostr-id">
          {identifier.slice(0, 20)}...
        </span>
      )
    }
  }
}

export default NostrMentionLink

