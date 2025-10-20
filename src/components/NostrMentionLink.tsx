import React from 'react'
import { nip19 } from 'nostr-tools'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'

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
  let pubkey: string | undefined
  
  try {
    const identifier = nostrUri.replace(/^nostr:/, '')
    decoded = nip19.decode(identifier)
    
    // Extract pubkey for profile fetching (works for npub and nprofile)
    if (decoded.type === 'npub') {
      pubkey = decoded.data
    } else if (decoded.type === 'nprofile') {
      pubkey = decoded.data.pubkey
    }
  } catch (error) {
    // Decoding failed, will fallback to shortened identifier
  }
  
  // Fetch profile at top level (Rules of Hooks)
  const profile = useEventModel(Models.ProfileModel, pubkey ? [pubkey] : null)
  
  // If decoding failed, show shortened identifier
  if (!decoded) {
    const identifier = nostrUri.replace(/^nostr:/, '')
    return (
      <span className="highlight-comment-nostr-id">
        {identifier.slice(0, 20)}...
      </span>
    )
  }
  
  // Render based on decoded type
  switch (decoded.type) {
    case 'npub': {
      const pk = decoded.data
      const displayName = profile?.name || profile?.display_name || profile?.nip05 || `${pk.slice(0, 8)}...`
      
      return (
        <a
          href={`/p/${nip19.npubEncode(pk)}`}
          className={className}
          onClick={onClick}
        >
          @{displayName}
        </a>
      )
    }
    case 'nprofile': {
      const { pubkey: pk } = decoded.data
      const displayName = profile?.name || profile?.display_name || profile?.nip05 || `${pk.slice(0, 8)}...`
      const npub = nip19.npubEncode(pk)
      
      return (
        <a
          href={`/p/${npub}`}
          className={className}
          onClick={onClick}
        >
          @{displayName}
        </a>
      )
    }
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

