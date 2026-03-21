import React from 'react'
import NostrMentionLink from './NostrMentionLink'
import { nostrLinkPattern } from '../utils/nostrPatterns'

// Pre-compiled patterns (static, no need to recreate per render)
const urlPattern = /https?:\/\/[^\s]+/gi
const combinedPattern = new RegExp(`(${nostrLinkPattern.source}|${urlPattern.source})`, 'gi')
const nostrTestPattern = new RegExp(nostrLinkPattern.source, nostrLinkPattern.flags)

// Helper to add timestamps to error logs
const ts = () => {
  const now = new Date()
  const ms = now.getMilliseconds().toString().padStart(3, '0')
  return `${now.toLocaleTimeString('en-US', { hour12: false })}.${ms}`
}

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
  try {
    const parts = content.split(combinedPattern)
  
    const isNostrIdentifier = (str: string): boolean => {
      nostrTestPattern.lastIndex = 0
      return nostrTestPattern.test(str)
    }
    
    return (
    <div className={className}>
      {parts.map((part, index) => {
        // Skip empty or undefined parts
        if (!part) {
          return null
        }
        
        // Handle nostr: URIs
        if (part.startsWith('nostr:')) {
          return (
            <NostrMentionLink
              key={index}
              nostrUri={part}
            />
          )
        }
        
        // Handle plain nostr identifiers
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
    console.error(`[${ts()}] [npub-resolve] RichContent: Error rendering:`, err)
    return <div className={className}>Error rendering content</div>
  }
}

export default RichContent

