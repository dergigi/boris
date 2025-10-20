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
  try {
    // Remove nostr: prefix
    const identifier = nostrUri.replace(/^nostr:/, '')
    const decoded = nip19.decode(identifier)
    
    switch (decoded.type) {
      case 'npub': {
        const pubkey = decoded.data
        // Fetch profile in the background
        const profile = useEventModel(Models.ProfileModel, [pubkey])
        const displayName = profile?.name || profile?.display_name || profile?.nip05 || `${pubkey.slice(0, 8)}...`
        
        return (
          <a
            href={`/p/${nip19.npubEncode(pubkey)}`}
            className={className}
            onClick={onClick}
          >
            @{displayName}
          </a>
        )
      }
      case 'nprofile': {
        const { pubkey } = decoded.data
        // Fetch profile in the background
        const profile = useEventModel(Models.ProfileModel, [pubkey])
        const displayName = profile?.name || profile?.display_name || profile?.nip05 || `${pubkey.slice(0, 8)}...`
        const npub = nip19.npubEncode(pubkey)
        
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
        const { kind, pubkey, identifier: addrIdentifier } = decoded.data
        // Check if it's a blog post (kind:30023)
        if (kind === 30023) {
          const naddr = nip19.naddrEncode({ kind, pubkey, identifier: addrIdentifier })
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
      default:
        // Fallback for unrecognized types
        return (
          <span className="highlight-comment-nostr-id">
            {identifier.slice(0, 20)}...
          </span>
        )
    }
  } catch (error) {
    // If decoding fails, show shortened identifier
    const identifier = nostrUri.replace(/^nostr:/, '')
    return (
      <span className="highlight-comment-nostr-id">
        {identifier.slice(0, 20)}...
      </span>
    )
  }
}

export default NostrMentionLink

