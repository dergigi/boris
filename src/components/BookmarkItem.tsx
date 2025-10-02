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
import { getKindIcon } from './kindIcon'
import ContentWithResolvedProfiles from './ContentWithResolvedProfiles'
import { extractUrlsFromContent } from '../services/bookmarkHelpers'
import { classifyUrl } from '../utils/helpers'

interface BookmarkItemProps {
  bookmark: IndividualBookmark
  index: number
  onSelectUrl?: (url: string) => void
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookmark, index, onSelectUrl }) => {
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
        
        <span className="bookmark-date">{formatDate(bookmark.created_at)}</span>
      </div>
      
      {extractedUrls.length > 0 && (
        <div className="bookmark-urls">
          <h4>URLs:</h4>
          {(urlsExpanded ? extractedUrls : extractedUrls.slice(0, 3)).map((url, urlIndex) => {
            const classification = classifyUrl(url)
            return (
              <div key={urlIndex} className="url-row">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bookmark-url"
                >
                  {url}
                </a>
                <IconButton
                  icon={getIconForUrlType(url)}
                  ariaLabel={classification.buttonText}
                  title={classification.buttonText}
                  variant="success"
                  size={36}
                  onClick={(e) => { e.preventDefault(); onSelectUrl?.(url) }}
                />
              </div>
            )
          })}
          {extractedUrls.length > 3 && (
            <button
              className="expand-toggle"
              onClick={() => setUrlsExpanded(v => !v)}
              aria-label={urlsExpanded ? 'Collapse URLs' : 'Expand URLs'}
              title={urlsExpanded ? 'Collapse URLs' : 'Expand URLs'}
            >
              <FontAwesomeIcon icon={urlsExpanded ? faChevronUp : faChevronDown} />
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
      
      <div className="bookmark-meta">
        {eventNevent ? (
          <a
            href={`https://search.dergigi.com/e/${eventNevent}`}
            target="_blank"
            rel="noopener noreferrer"
            className="kind-icon-link"
            title="Open event in search"
          >
            <span className="kind-icon">
              <FontAwesomeIcon icon={getKindIcon(bookmark.kind)} />
            </span>
          </a>
        ) : (
          <span className="kind-icon">
            <FontAwesomeIcon icon={getKindIcon(bookmark.kind)} />
          </span>
        )}
        <span>
          <a
            href={`https://search.dergigi.com/p/${authorNpub}`}
            target="_blank"
            rel="noopener noreferrer"
            className="author-link"
            title="Open author in search"
          >
            by: {getAuthorDisplayName()}
          </a>
        </span>
      </div>

      {hasUrls && firstUrlClassification && (
        <div className="read-now">
          <button className="read-now-button" onClick={handleReadNow}>
            {firstUrlClassification.buttonText}
          </button>
        </div>
      )}
    </div>
  )
}
