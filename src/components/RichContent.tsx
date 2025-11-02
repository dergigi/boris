import React from 'react'
import NostrMentionLink from './NostrMentionLink'
import { Tokens } from 'applesauce-content/helpers'

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
  console.log('[RichContent] Rendering, content length:', content?.length || 0)
  
  try {
    // Pattern to match:
    // 1. nostr: URIs (nostr:npub1..., nostr:note1..., etc.) using applesauce Tokens.nostrLink
    // 2. http(s) URLs
    const nostrPattern = Tokens.nostrLink
    const urlPattern = /https?:\/\/[^\s]+/gi
    const combinedPattern = new RegExp(`(${nostrPattern.source}|${urlPattern.source})`, 'gi')
    
    const parts = content.split(combinedPattern)
    console.log('[RichContent] Split into parts:', parts.length)
  
    // Helper to check if a string is a nostr identifier (without mutating regex state)
    const isNostrIdentifier = (str: string): boolean => {
      const testPattern = new RegExp(nostrPattern.source, nostrPattern.flags)
      return testPattern.test(str)
    }
    
    return (
    <div className={className}>
      {parts.map((part, index) => {
        // Handle nostr: URIs - Tokens.nostrLink matches both formats
        if (part.startsWith('nostr:')) {
          return (
            <NostrMentionLink
              key={index}
              nostrUri={part}
            />
          )
        }
        
        // Handle plain nostr identifiers (Tokens.nostrLink matches these too)
        if (isNostrIdentifier(part)) {
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
  } catch (err) {
    console.error('[RichContent] Error rendering:', err)
    return <div className={className}>Error rendering content</div>
  }
}

export default RichContent

