import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDate } from '../../utils/bookmarkUtils'
import ContentWithResolvedProfiles from '../ContentWithResolvedProfiles'
import { IconGetter } from './shared'
import { useImageCache } from '../../hooks/useImageCache'
import { UserSettings } from '../../services/settingsService'
import { getProfileUrl, getEventUrl } from '../../config/nostrGateways'

interface LargeViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  getIconForUrlType: IconGetter
  firstUrlClassification: { buttonText: string } | null
  previewImage: string | null
  authorNpub: string
  eventNevent?: string
  getAuthorDisplayName: () => string
  handleReadNow: (e: React.MouseEvent<HTMLButtonElement>) => void
  articleSummary?: string
  settings?: UserSettings
}

export const LargeView: React.FC<LargeViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  getIconForUrlType,
  firstUrlClassification,
  previewImage,
  authorNpub,
  eventNevent,
  getAuthorDisplayName,
  handleReadNow,
  articleSummary,
  settings
}) => {
  const cachedImage = useImageCache(previewImage || undefined, settings)
  const isArticle = bookmark.kind === 30023
  
  return (
    <div key={`${bookmark.id}-${index}`} className={`individual-bookmark large ${bookmark.isPrivate ? 'private-bookmark' : ''}`}>
      {(hasUrls || (isArticle && cachedImage)) && (
        <div 
          className="large-preview-image" 
          onClick={() => {
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
          <span className="large-author">
            <a
              href={getProfileUrl(authorNpub)}
              target="_blank"
              rel="noopener noreferrer"
              className="author-link-minimal"
            >
              {getAuthorDisplayName()}
            </a>
          </span>
          
          {eventNevent && (
            <a
              href={getEventUrl(eventNevent)}
              target="_blank"
              rel="noopener noreferrer"
              className="bookmark-date-link"
            >
              {formatDate(bookmark.created_at)}
            </a>
          )}
          
          {(hasUrls && firstUrlClassification) || isArticle ? (
            <button className="large-read-button" onClick={handleReadNow}>
              <FontAwesomeIcon icon={isArticle ? getIconForUrlType('') : getIconForUrlType(extractedUrls[0])} />
              {isArticle ? 'Read Article' : firstUrlClassification?.buttonText}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

