import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuoteLeft, faLink, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { formatDistanceToNow } from 'date-fns'

interface HighlightItemProps {
  highlight: Highlight
  onSelectUrl?: (url: string) => void
}

export const HighlightItem: React.FC<HighlightItemProps> = ({ highlight, onSelectUrl }) => {
  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    if (onSelectUrl) {
      e.preventDefault()
      onSelectUrl(url)
    }
  }
  
  const getSourceLink = () => {
    if (highlight.eventReference) {
      return `https://search.dergigi.com/e/${highlight.eventReference}`
    }
    return highlight.urlReference
  }
  
  const sourceLink = getSourceLink()
  
  return (
    <div className="highlight-item">
      <div className="highlight-quote-icon">
        <FontAwesomeIcon icon={faQuoteLeft} />
      </div>
      
      <div className="highlight-content">
        <blockquote className="highlight-text">
          {highlight.content}
        </blockquote>
        
        {highlight.comment && (
          <div className="highlight-comment">
            {highlight.comment}
          </div>
        )}
        
        {highlight.context && (
          <details className="highlight-context">
            <summary>Show context</summary>
            <p className="context-text">{highlight.context}</p>
          </details>
        )}
        
        <div className="highlight-meta">
          <span className="highlight-time">
            {formatDistanceToNow(new Date(highlight.created_at * 1000), { addSuffix: true })}
          </span>
          
          {sourceLink && (
            <a
              href={sourceLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => highlight.urlReference && onSelectUrl ? handleLinkClick(highlight.urlReference, e) : undefined}
              className="highlight-source"
              title={highlight.eventReference ? 'View on Nostr' : 'View source'}
            >
              <FontAwesomeIcon icon={highlight.eventReference ? faLink : faExternalLinkAlt} />
              <span>{highlight.eventReference ? 'Nostr event' : 'Source'}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

