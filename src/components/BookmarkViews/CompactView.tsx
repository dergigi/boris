import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDateCompact } from '../../utils/bookmarkUtils'
import ContentWithResolvedProfiles from '../ContentWithResolvedProfiles'

interface CompactViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  articleSummary?: string
  contentTypeIcon: IconDefinition
  readingProgress?: number
}

export const CompactView: React.FC<CompactViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  articleSummary,
  contentTypeIcon,
  readingProgress
}) => {
  const isArticle = bookmark.kind === 30023
  const isWebBookmark = bookmark.kind === 39701
  const isClickable = hasUrls || isArticle || isWebBookmark
  
  // Calculate progress color (matching BlogPostCard logic)
  let progressColor = '#6366f1' // Default blue (reading)
  if (readingProgress && readingProgress >= 0.95) {
    progressColor = '#10b981' // Green (completed)
  } else if (readingProgress && readingProgress > 0 && readingProgress <= 0.10) {
    progressColor = 'var(--color-text)' // Neutral text color (started)
  }

  const handleCompactClick = () => {
    if (!onSelectUrl) return
    
    if (isArticle) {
      onSelectUrl('', { id: bookmark.id, kind: bookmark.kind, tags: bookmark.tags, pubkey: bookmark.pubkey })
    } else if (hasUrls) {
      onSelectUrl(extractedUrls[0])
    }
  }

  // For articles, prefer summary; for others, use content
  const displayText = isArticle && articleSummary 
    ? articleSummary 
    : bookmark.content

  return (
    <div key={`${bookmark.id}-${index}`} className={`individual-bookmark compact ${bookmark.isPrivate ? 'private-bookmark' : ''}`}>
      <div 
        className={`compact-row ${isClickable ? 'clickable' : ''}`}
        onClick={handleCompactClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <span className="bookmark-type-compact">
          <FontAwesomeIcon icon={contentTypeIcon} className="content-type-icon" />
        </span>
        {displayText && (
          <div className="compact-text">
            <ContentWithResolvedProfiles content={displayText.slice(0, 60) + (displayText.length > 60 ? '…' : '')} />
          </div>
        )}
        <span className="bookmark-date-compact">{formatDateCompact(bookmark.created_at)}</span>
        {/* CTA removed */}
      </div>
      
      {/* Reading progress indicator for all bookmark types with reading data */}
      {readingProgress !== undefined && readingProgress > 0 && (
        <div 
          style={{
            height: '1px',
            width: '100%',
            background: 'var(--color-border)',
            overflow: 'hidden',
            margin: '0'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.round(readingProgress * 100)}%`,
              background: progressColor,
              transition: 'width 0.3s ease, background 0.3s ease',
              marginLeft: '1.85rem'
            }}
          />
        </div>
      )}
    </div>
  )
}

