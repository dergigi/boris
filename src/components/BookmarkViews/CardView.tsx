import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDate, renderParsedContent } from '../../utils/bookmarkUtils'
import ContentWithResolvedProfiles from '../ContentWithResolvedProfiles'
import { classifyUrl } from '../../utils/helpers'
import { useImageCache } from '../../hooks/useImageCache'
import { getPreviewImage, fetchOgImage } from '../../utils/imagePreview'
import { getEventUrl } from '../../config/nostrGateways'

interface CardViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  authorNpub: string
  eventNevent?: string
  getAuthorDisplayName: () => string
  handleReadNow: (e: React.MouseEvent<HTMLButtonElement>) => void
  articleImage?: string
  articleSummary?: string
  contentTypeIcon: IconDefinition
  readingProgress?: number
}

export const CardView: React.FC<CardViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  authorNpub,
  eventNevent,
  getAuthorDisplayName,
  handleReadNow,
  articleImage,
  articleSummary,
  contentTypeIcon,
  readingProgress
}) => {
  const firstUrl = hasUrls ? extractedUrls[0] : null
  const firstUrlClassificationType = firstUrl ? classifyUrl(firstUrl)?.type : null
  const instantPreview = firstUrl ? getPreviewImage(firstUrl, firstUrlClassificationType || '') : null
  
  const [ogImage, setOgImage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [urlsExpanded, setUrlsExpanded] = useState(false)
  
  const contentLength = (bookmark.content || '').length
  const shouldTruncate = !expanded && contentLength > 210
  const isArticle = bookmark.kind === 30023
  
  // Calculate progress color (matching BlogPostCard logic)
  let progressColor = '#6366f1' // Default blue (reading)
  if (readingProgress && readingProgress >= 0.95) {
    progressColor = '#10b981' // Green (completed)
  } else if (readingProgress && readingProgress > 0 && readingProgress <= 0.10) {
    progressColor = 'var(--color-text)' // Neutral text color (started)
  }
  
  // Determine which image to use (article image, instant preview, or OG image)
  const previewImage = articleImage || instantPreview || ogImage
  const cachedImage = useImageCache(previewImage || undefined)
  
  // Fetch OG image if we don't have any other image
  React.useEffect(() => {
    if (firstUrl && !articleImage && !instantPreview && !ogImage) {
      fetchOgImage(firstUrl).then(setOgImage)
    }
  }, [firstUrl, articleImage, instantPreview, ogImage])

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
      className={`individual-bookmark ${bookmark.isPrivate ? 'private-bookmark' : ''}`}
      onClick={triggerOpen}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {cachedImage && (
        <div 
          className="article-hero-image"
          style={{ backgroundImage: `url(${cachedImage})` }}
          onClick={() => handleReadNow({ preventDefault: () => {} } as React.MouseEvent<HTMLButtonElement>)}
        />
      )}
      <div className="bookmark-header">
        <span className="bookmark-type">
          <FontAwesomeIcon icon={contentTypeIcon} className="content-type-icon" />
        </span>
        
        {eventNevent ? (
          <a
            href={getEventUrl(eventNevent)}
            target="_blank"
            rel="noopener noreferrer"
            className="bookmark-date-link"
            title="Open event in search"
            onClick={(e) => e.stopPropagation()}
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
            return (
              <button
                key={urlIndex}
                className="bookmark-url"
                onClick={(e) => { e.stopPropagation(); onSelectUrl?.(url) }}
                title="Open in reader"
              >
                {url}
              </button>
            )
          })}
          {extractedUrls.length > 1 && (
            <button
              className="expand-toggle-urls"
              onClick={(e) => { e.stopPropagation(); setUrlsExpanded(v => !v) }}
              aria-label={urlsExpanded ? 'Collapse URLs' : 'Expand URLs'}
              title={urlsExpanded ? 'Collapse URLs' : 'Expand URLs'}
            >
              {urlsExpanded ? `Hide ${extractedUrls.length - 1} more` : `Show ${extractedUrls.length - 1} more`}
            </button>
          )}
        </div>
      )}
      
      {isArticle && articleSummary ? (
        <div className="bookmark-content article-summary">
          <ContentWithResolvedProfiles content={articleSummary} />
        </div>
      ) : bookmark.parsedContent ? (
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
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} />
        </button>
      )}
      
      {/* Reading progress indicator for articles */}
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
              width: `${Math.round(readingProgress * 100)}%`,
              background: progressColor,
              transition: 'width 0.3s ease, background 0.3s ease'
            }}
          />
        </div>
      )}
      
      <div className="bookmark-footer">
        <div className="bookmark-meta-minimal">
          <Link
            to={`/p/${authorNpub}`}
            className="author-link-minimal"
            title="Open author profile"
            onClick={(e) => e.stopPropagation()}
          >
            {getAuthorDisplayName()}
          </Link>
        </div>
        {/* CTA removed */}
      </div>
    </div>
  )
}

