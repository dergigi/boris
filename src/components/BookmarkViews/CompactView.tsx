import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark, faUserLock } from '@fortawesome/free-solid-svg-icons'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDate } from '../../utils/bookmarkUtils'
import ContentWithResolvedProfiles from '../ContentWithResolvedProfiles'
import { IconGetter } from './shared'

interface CompactViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string) => void
  getIconForUrlType: IconGetter
  firstUrlClassification: { buttonText: string } | null
}

export const CompactView: React.FC<CompactViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  getIconForUrlType,
  firstUrlClassification
}) => {
  const handleCompactClick = () => {
    if (hasUrls && onSelectUrl) {
      onSelectUrl(extractedUrls[0])
    }
  }

  return (
    <div key={`${bookmark.id}-${index}`} className={`individual-bookmark compact ${bookmark.isPrivate ? 'private-bookmark' : ''}`}>
      <div 
        className={`compact-row ${hasUrls ? 'clickable' : ''}`}
        onClick={handleCompactClick}
        role={hasUrls ? 'button' : undefined}
        tabIndex={hasUrls ? 0 : undefined}
      >
        <span className="bookmark-type-compact">
          {bookmark.isPrivate ? (
            <>
              <FontAwesomeIcon icon={faBookmark} className="bookmark-visibility public" />
              <FontAwesomeIcon icon={faUserLock} className="bookmark-visibility private" />
            </>
          ) : (
            <FontAwesomeIcon icon={faBookmark} className="bookmark-visibility public" />
          )}
        </span>
        {bookmark.content && (
          <div className="compact-text">
            <ContentWithResolvedProfiles content={bookmark.content.slice(0, 60) + (bookmark.content.length > 60 ? '…' : '')} />
          </div>
        )}
        <span className="bookmark-date-compact">{formatDate(bookmark.created_at)}</span>
        {hasUrls && (
          <button
            className="compact-read-btn"
            onClick={(e) => { e.stopPropagation(); onSelectUrl?.(extractedUrls[0]) }}
            title={firstUrlClassification?.buttonText}
          >
            <FontAwesomeIcon icon={getIconForUrlType(extractedUrls[0])} />
          </button>
        )}
      </div>
    </div>
  )
}

