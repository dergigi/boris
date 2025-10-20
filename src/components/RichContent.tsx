import React from 'react'
import NostrMentionLink from './NostrMentionLink'

interface RichContentProps {
  content: string
  className?: string
}

/**
 * Component to render text content with:
 * - Clickable links
 * - Resolved nostr mentions (npub, nprofile, note, nevent, naddr)
 * - Plain text
 * 
 * Handles both nostr:npub1... and plain npub1... formats
 */
const RichContent: React.FC<RichContentProps> = ({ 
  content, 
  className = 'bookmark-content' 
}) => {
  // Pattern to match:
  // 1. nostr: URIs (nostr:npub1..., nostr:note1..., etc.)
  // 2. Plain nostr identifiers (npub1..., nprofile1..., note1..., etc.)
  // 3. http(s) URLs
  const pattern = /(nostr:[a-z0-9]+|npub1[a-z0-9]+|nprofile1[a-z0-9]+|note1[a-z0-9]+|nevent1[a-z0-9]+|naddr1[a-z0-9]+|https?:\/\/[^\s]+)/gi
  
  const parts = content.split(pattern)
  
  return (
    <div className={className}>
      {parts.map((part, index) => {
        // Handle nostr: URIs
        if (part.startsWith('nostr:')) {
          return (
            <NostrMentionLink
              key={index}
              nostrUri={part}
            />
          )
        }
        
        // Handle plain nostr identifiers (add nostr: prefix)
        if (
          part.match(/^(npub1|nprofile1|note1|nevent1|naddr1)[a-z0-9]+$/i)
        ) {
          return (
            <NostrMentionLink
              key={index}
              nostrUri={`nostr:${part}`}
            />
          )
        }
        
        // Handle http(s) URLs
        if (part.match(/^https?:\/\//)) {
          return (
            <a
              key={index}
              href={part}
              className="nostr-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {part}
            </a>
          )
        }
        
        // Plain text
        return <React.Fragment key={index}>{part}</React.Fragment>
      })}
    </div>
  )
}

export default RichContent

