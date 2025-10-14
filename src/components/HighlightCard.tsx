import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuoteLeft } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { formatDateCompact } from '../utils/bookmarkUtils'

interface HighlightCardProps {
  highlight: Highlight
  onClick?: () => void
}

export const HighlightCard: React.FC<HighlightCardProps> = ({ 
  highlight,
  onClick 
}) => {
  const profile = useEventModel(Models.ProfileModel, [highlight.pubkey])
  
  const getUserDisplayName = () => {
    if (profile?.name) return profile.name
    if (profile?.display_name) return profile.display_name
    return `${highlight.pubkey.slice(0, 8)}...`
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  return (
    <div 
      className="blog-post-card highlight-card" 
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="highlight-card-header">
        <FontAwesomeIcon icon={faQuoteLeft} className="highlight-card-icon" />
      </div>
      <div className="blog-post-card-content">
        <div className="highlight-card-text">
          {truncateText(highlight.content, 200)}
        </div>
        {highlight.comment && (
          <div className="highlight-card-comment">
            {truncateText(highlight.comment, 100)}
          </div>
        )}
        <div className="blog-post-card-footer">
          <div className="blog-post-card-author">
            <FontAwesomeIcon icon={faQuoteLeft} style={{ fontSize: '0.7rem', opacity: 0.5 }} />
            {' '}
            {getUserDisplayName()}
          </div>
          <div className="blog-post-card-date">
            {formatDateCompact(highlight.created_at)}
          </div>
        </div>
      </div>
    </div>
  )
}

