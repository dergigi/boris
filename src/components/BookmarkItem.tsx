import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark, faUserLock } from '@fortawesome/free-solid-svg-icons'
import { faChevronDown, faChevronUp, faBookOpen, faPlay, faEye } from '@fortawesome/free-solid-svg-icons'
import IconButton from './IconButton'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { npubEncode, neventEncode } from 'nostr-tools/nip19'
import { IndividualBookmark } from '../types/bookmarks'
import { formatDate, renderParsedContent } from '../utils/bookmarkUtils'
import ContentWithResolvedProfiles from './ContentWithResolvedProfiles'
import { extractUrlsFromContent } from '../services/bookmarkHelpers'
import { classifyUrl } from '../utils/helpers'
import { ViewMode } from './Bookmarks'
import { getPreviewImage } from '../utils/imagePreview'

interface BookmarkItemProps {
  bookmark: IndividualBookmark
  index: number
  onSelectUrl?: (url: string) => void
  viewMode?: ViewMode
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookmark, index, onSelectUrl, viewMode = 'cards' }) => {
  const [expanded, setExpanded] = useState(false)
  const [urlsExpanded, setUrlsExpanded] = useState(false)
  // removed copy-to-clipboard buttons

  const short = (v: string) => `${v.slice(0, 8)}...${v.slice(-8)}`
  
  // Extract URLs from bookmark content
  const extractedUrls = extractUrlsFromContent(bookmark.content)
  const hasUrls = extractedUrls.length > 0
  const contentLength = (bookmark.content || '').length
  const shouldTruncate = !expanded && contentLength > 210

  // Resolve author profile using applesauce
  const authorProfile = useEventModel(Models.ProfileModel, [bookmark.pubkey])
  const authorNpub = npubEncode(bookmark.pubkey)
  const isHexId = /^[0-9a-f]{64}$/i.test(bookmark.id)
  const eventNevent = isHexId ? neventEncode({ id: bookmark.id }) : undefined
  
  // Get display name for author
  const getAuthorDisplayName = () => {
    if (authorProfile?.name) return authorProfile.name
    if (authorProfile?.display_name) return authorProfile.display_name
    if (authorProfile?.nip05) return authorProfile.nip05
    return short(bookmark.pubkey) // fallback to short pubkey
  }

  // use helper from kindIcon.ts

  const getIconForUrlType = (url: string) => {
    const classification = classifyUrl(url)
    switch (classification.type) {
      case 'youtube':
      case 'video':
        return faPlay
      case 'image':
        return faEye
      default:
        return faBookOpen
    }
  }

  const handleReadNow = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasUrls) return
    const firstUrl = extractedUrls[0]
    if (onSelectUrl) {
      event.preventDefault()
      onSelectUrl(firstUrl)
    } else {
      window.open(firstUrl, '_blank')
    }
  }

  // Get classification for the first URL (for the main button)
  const firstUrlClassification = hasUrls ? classifyUrl(extractedUrls[0]) : null

  // Compact view rendering
  if (viewMode === 'compact') {
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

  // Large preview view rendering
  if (viewMode === 'large') {
    const firstUrl = hasUrls ? extractedUrls[0] : null
    const previewImage = firstUrl ? getPreviewImage(firstUrl, firstUrlClassification?.type || '') : null
    
    return (
      <div key={`${bookmark.id}-${index}`} className={`individual-bookmark large ${bookmark.isPrivate ? 'private-bookmark' : ''}`}>
        {hasUrls && (
          <div 
            className="large-preview-image" 
            onClick={() => onSelectUrl?.(extractedUrls[0])}
            style={previewImage ? { backgroundImage: `url(${previewImage})` } : undefined}
          >
            {!previewImage && (
              <div className="preview-placeholder">
                <FontAwesomeIcon icon={getIconForUrlType(extractedUrls[0])} />
              </div>
            )}
          </div>
        )}
        
        <div className="large-content">
          {bookmark.content && (
            <div className="large-text">
              <ContentWithResolvedProfiles content={bookmark.content} />
            </div>
          )}
          
          <div className="large-footer">
            <span className="large-author">
              <a
                href={`https://search.dergigi.com/p/${authorNpub}`}
                target="_blank"
                rel="noopener noreferrer"
                className="author-link-minimal"
              >
                {getAuthorDisplayName()}
              </a>
            </span>
            
            {eventNevent && (
              <a
                href={`https://search.dergigi.com/e/${eventNevent}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bookmark-date-link"
              >
                {formatDate(bookmark.created_at)}
              </a>
            )}
            
            {hasUrls && firstUrlClassification && (
              <button className="large-read-button" onClick={handleReadNow}>
                <FontAwesomeIcon icon={getIconForUrlType(extractedUrls[0])} />
                {firstUrlClassification.buttonText}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Card view rendering (default)
  return (
    <div key={`${bookmark.id}-${index}`} className={`individual-bookmark ${bookmark.isPrivate ? 'private-bookmark' : ''}`}>
      <div className="bookmark-header">
        <span className="bookmark-type">
          {bookmark.isPrivate ? (
            <>
              <FontAwesomeIcon icon={faBookmark} className="bookmark-visibility public" />
              <FontAwesomeIcon icon={faUserLock} className="bookmark-visibility private" />
            </>
          ) : (
            <FontAwesomeIcon icon={faBookmark} className="bookmark-visibility public" />
          )}
        </span>
        
        {eventNevent ? (
          <a
            href={`https://search.dergigi.com/e/${eventNevent}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bookmark-date-link"
            title="Open event in search"
          >
            {formatDate(bookmark.created_at)}
          </a>
        ) : (
          <span className="bookmark-date">{formatDate(bookmark.created_at)}</span>
        )}
      </div>
      
      {extractedUrls.length > 0 && (
        <div className="bookmark-urls">
          {(urlsExpanded ? extractedUrls : extractedUrls.slice(0, 1)).map((url, urlIndex) => {
            const classification = classifyUrl(url)
            return (
              <div key={urlIndex} className="url-row">
                <button
                  className="bookmark-url"
                  onClick={() => onSelectUrl?.(url)}
                  title="Open in reader"
                >
                  {url}
                </button>
                <IconButton
                  icon={getIconForUrlType(url)}
                  ariaLabel={classification.buttonText}
                  title={classification.buttonText}
                  variant="success"
                  size={32}
                  onClick={(e) => { e.preventDefault(); onSelectUrl?.(url) }}
                />
              </div>
            )
          })}
          {extractedUrls.length > 1 && (
            <button
              className="expand-toggle-urls"
              onClick={() => setUrlsExpanded(v => !v)}
              aria-label={urlsExpanded ? 'Collapse URLs' : 'Expand URLs'}
              title={urlsExpanded ? 'Collapse URLs' : 'Expand URLs'}
            >
              {urlsExpanded ? `Hide ${extractedUrls.length - 1} more` : `Show ${extractedUrls.length - 1} more`}
            </button>
          )}
        </div>
      )}
      
      {bookmark.parsedContent ? (
        <div className="bookmark-content">
          {shouldTruncate && bookmark.content
            ? <ContentWithResolvedProfiles content={`${bookmark.content.slice(0, 210).trimEnd()}…`} />
            : renderParsedContent(bookmark.parsedContent)}
        </div>
      ) : bookmark.content && (
        <div className="bookmark-content">
          <ContentWithResolvedProfiles content={shouldTruncate ? `${bookmark.content.slice(0, 210).trimEnd()}…` : bookmark.content} />
        </div>
      )}

      {contentLength > 210 && (
        <button
          className="expand-toggle"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} />
        </button>
      )}
      
      <div className="bookmark-footer">
        <div className="bookmark-meta-minimal">
          <a
            href={`https://search.dergigi.com/p/${authorNpub}`}
            target="_blank"
            rel="noopener noreferrer"
            className="author-link-minimal"
            title="Open author in search"
          >
            {getAuthorDisplayName()}
          </a>
        </div>
        {hasUrls && firstUrlClassification && (
          <button className="read-now-button-minimal" onClick={handleReadNow}>
            {firstUrlClassification.buttonText}
          </button>
        )}
      </div>
    </div>
  )
}
