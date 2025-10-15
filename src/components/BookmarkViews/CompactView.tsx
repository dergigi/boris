import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUserLock } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDateCompact } from '../../utils/bookmarkUtils'
import ContentWithResolvedProfiles from '../ContentWithResolvedProfiles'
import { useImageCache } from '../../hooks/useImageCache'

interface CompactViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  articleImage?: string
  articleSummary?: string
  contentTypeIcon: IconDefinition
}

export const CompactView: React.FC<CompactViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  articleImage,
  articleSummary,
  contentTypeIcon
}) => {
  const isArticle = bookmark.kind === 30023
  const isWebBookmark = bookmark.kind === 39701
  const isClickable = hasUrls || isArticle || isWebBookmark
  
  // Get cached image for thumbnail
  const cachedImage = useImageCache(articleImage || undefined)
  
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
        {/* Thumbnail image */}
        {cachedImage && (
          <div className="compact-thumbnail">
            <img src={cachedImage} alt="" />
          </div>
        )}
        
        <span className="bookmark-type-compact">
          <FontAwesomeIcon icon={contentTypeIcon} className="content-type-icon" />
          {bookmark.isPrivate && (
            <FontAwesomeIcon icon={faUserLock} className="bookmark-visibility private" />
          )}
        </span>
        {displayText && (
          <div className="compact-text">
            <ContentWithResolvedProfiles content={displayText.slice(0, 60) + (displayText.length > 60 ? '…' : '')} />
          </div>
        )}
        <span className="bookmark-date-compact">{formatDateCompact(bookmark.created_at)}</span>
        {/* CTA removed */}
      </div>
    </div>
  )
}

