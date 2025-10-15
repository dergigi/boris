import React from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDate } from '../../utils/bookmarkUtils'
import ContentWithResolvedProfiles from '../ContentWithResolvedProfiles'
import { IconGetter } from './shared'
import { useImageCache } from '../../hooks/useImageCache'
import { getEventUrl } from '../../config/nostrGateways'

interface LargeViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  getIconForUrlType: IconGetter
  previewImage: string | null
  authorNpub: string
  eventNevent?: string
  getAuthorDisplayName: () => string
  handleReadNow: (e: React.MouseEvent<HTMLButtonElement>) => void
  articleSummary?: string
  contentTypeIcon: IconDefinition
  readingProgress?: number // 0-1 reading progress (optional)
}

export const LargeView: React.FC<LargeViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  getIconForUrlType,
  previewImage,
  authorNpub,
  eventNevent,
  getAuthorDisplayName,
  handleReadNow,
  articleSummary,
  contentTypeIcon,
  readingProgress
}) => {
  const cachedImage = useImageCache(previewImage || undefined)
  const isArticle = bookmark.kind === 30023
  
  // Calculate progress display
  const progressPercent = readingProgress ? Math.round(readingProgress * 100) : 0
  const progressColor = 
    progressPercent >= 95 ? '#10b981' :  // green for completed
    progressPercent > 5 ? '#f97316' :    // orange for in-progress
    'var(--color-border)'                 // default for not started
  
  const triggerOpen = () => handleReadNow({ preventDefault: () => {} } as React.MouseEvent<HTMLButtonElement>)
  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      triggerOpen()
    }
  }

  return (
    <div 
      key={`${bookmark.id}-${index}`} 
      className={`individual-bookmark large ${bookmark.isPrivate ? 'private-bookmark' : ''}`}
      onClick={triggerOpen}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {(hasUrls || (isArticle && cachedImage)) && (
        <div 
          className="large-preview-image" 
          onClick={(e) => {
            e.stopPropagation()
            if (isArticle) {
              handleReadNow({ preventDefault: () => {} } as React.MouseEvent<HTMLButtonElement>)
            } else {
              onSelectUrl?.(extractedUrls[0])
            }
          }}
          style={cachedImage ? { backgroundImage: `url(${cachedImage})` } : undefined}
        >
          {!previewImage && hasUrls && (
            <div className="preview-placeholder">
              <FontAwesomeIcon icon={getIconForUrlType(extractedUrls[0])} />
            </div>
          )}
        </div>
      )}
      
      <div className="large-content">
        {isArticle && articleSummary ? (
          <div className="large-text article-summary">
            <ContentWithResolvedProfiles content={articleSummary} />
          </div>
        ) : bookmark.content && (
          <div className="large-text">
            <ContentWithResolvedProfiles content={bookmark.content} />
          </div>
        )}
        
        {/* Reading progress indicator for articles - shown only if there's progress */}
        {isArticle && readingProgress !== undefined && readingProgress > 0 && (
          <div 
            style={{
              height: '3px',
              width: '100%',
              background: 'var(--color-border)',
              overflow: 'hidden',
              marginTop: '0.75rem'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: progressColor,
                transition: 'width 0.3s ease, background 0.3s ease'
              }}
            />
          </div>
        )}
        
        <div className="large-footer">
          <span className="bookmark-type-large">
            <FontAwesomeIcon icon={contentTypeIcon} className="content-type-icon" />
          </span>
          <span className="large-author">
            <Link
              to={`/p/${authorNpub}`}
              className="author-link-minimal"
              onClick={(e) => e.stopPropagation()}
            >
              {getAuthorDisplayName()}
            </Link>
          </span>
          
          {eventNevent && (
            <a
              href={getEventUrl(eventNevent)}
              target="_blank"
              rel="noopener noreferrer"
              className="bookmark-date-link"
              onClick={(e) => e.stopPropagation()}
            >
              {formatDate(bookmark.created_at)}
            </a>
          )}
          
          {/* CTA removed */}
        </div>
      </div>
    </div>
  )
}

