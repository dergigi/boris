import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark, faUserLock, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDate } from '../../utils/bookmarkUtils'
import ContentWithResolvedProfiles from '../ContentWithResolvedProfiles'
import { IconGetter } from './shared'

interface CompactViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  getIconForUrlType: IconGetter
  firstUrlClassification: { buttonText: string } | null
  articleImage?: string
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
        {bookmark.content && (
          <div className="compact-text">
            <ContentWithResolvedProfiles content={bookmark.content.slice(0, 60) + (bookmark.content.length > 60 ? '…' : '')} />
          </div>
        )}
        <span className="bookmark-date-compact">{formatDate(bookmark.created_at)}</span>
        {isClickable && (
          <button
            className="compact-read-btn"
            onClick={(e) => { 
              e.stopPropagation()
              if (isArticle) {
                onSelectUrl?.('', { id: bookmark.id, kind: bookmark.kind, tags: bookmark.tags, pubkey: bookmark.pubkey })
              } else {
                onSelectUrl?.(extractedUrls[0])
              }
            }}
            title={isArticle ? 'Read Article' : firstUrlClassification?.buttonText}
          >
            <FontAwesomeIcon icon={isArticle ? getIconForUrlType('') : getIconForUrlType(extractedUrls[0])} />
          </button>
        )}
      </div>
    </div>
  )
}

