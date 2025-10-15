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
  contentTypeIcon
}) => {
  const cachedImage = useImageCache(previewImage || undefined)
  const isArticle = bookmark.kind === 30023
  
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

