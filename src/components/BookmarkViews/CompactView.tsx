import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark, faUserLock, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDateCompact } from '../../utils/bookmarkUtils'
import ContentWithResolvedProfiles from '../ContentWithResolvedProfiles'
import { IconGetter } from './shared'

interface CompactViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  getIconForUrlType: IconGetter
  articleImage?: string
  articleSummary?: string
}

export const CompactView: React.FC<CompactViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  getIconForUrlType,
  articleSummary
}) => {
  const isArticle = bookmark.kind === 30023
  const isWebBookmark = bookmark.kind === 39701
  const isClickable = hasUrls || isArticle || isWebBookmark
  
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
          {isWebBookmark ? (
            <span className="fa-layers fa-fw">
              <FontAwesomeIcon icon={faBookmark} className="bookmark-visibility public" />
              <FontAwesomeIcon icon={faGlobe} className="bookmark-visibility public" transform="shrink-8 down-2" />
            </span>
          ) : bookmark.isPrivate ? (
            <>
              <FontAwesomeIcon icon={faBookmark} className="bookmark-visibility public" />
              <FontAwesomeIcon icon={faUserLock} className="bookmark-visibility private" />
            </>
          ) : (
            <FontAwesomeIcon icon={faBookmark} className="bookmark-visibility public" />
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

