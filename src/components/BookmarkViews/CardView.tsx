import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark, faUserLock, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDate, renderParsedContent } from '../../utils/bookmarkUtils'
import ContentWithResolvedProfiles from '../ContentWithResolvedProfiles'
import IconButton from '../IconButton'
import { classifyUrl } from '../../utils/helpers'
import { IconGetter } from './shared'

interface CardViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string) => void
  getIconForUrlType: IconGetter
  firstUrlClassification: { buttonText: string } | null
  authorNpub: string
  eventNevent?: string
  getAuthorDisplayName: () => string
  handleReadNow: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export const CardView: React.FC<CardViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  getIconForUrlType,
  firstUrlClassification,
  authorNpub,
  eventNevent,
  getAuthorDisplayName,
  handleReadNow
}) => {
  const [expanded, setExpanded] = useState(false)
  const [urlsExpanded, setUrlsExpanded] = useState(false)
  const contentLength = (bookmark.content || '').length
  const shouldTruncate = !expanded && contentLength > 210

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

