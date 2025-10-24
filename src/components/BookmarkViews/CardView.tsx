import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDate, renderParsedContent } from '../../utils/bookmarkUtils'
import RichContent from '../RichContent'
import { classifyUrl } from '../../utils/helpers'
import { useImageCache } from '../../hooks/useImageCache'
import { getPreviewImage, fetchOgImage } from '../../utils/imagePreview'
import { naddrEncode } from 'nostr-tools/nip19'

interface CardViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  authorNpub: string
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

  // Add loading state for images
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState(false)

  const triggerOpen = () => handleReadNow({ preventDefault: () => {} } as React.MouseEvent<HTMLButtonElement>)

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      triggerOpen()
    }
  }

  // Get internal route for the bookmark
  const getInternalRoute = (): string | null => {
    if (bookmark.kind === 30023) {
      // Nostr-native article - use /a/ route
      const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1]
      if (dTag) {
        const naddr = naddrEncode({
          kind: bookmark.kind,
          pubkey: bookmark.pubkey,
          identifier: dTag
        })
        return `/a/${naddr}`
      }
    } else if (bookmark.kind === 1) {
      // Note - use /e/ route
      return `/e/${bookmark.id}`
    } else if (firstUrl) {
      // External URL - use /r/ route
      return `/r/${encodeURIComponent(firstUrl)}`
    }
    return null
  }

  return (
    <div 
      key={`${bookmark.id}-${index}`}
      className={`individual-bookmark card-view ${bookmark.isPrivate ? 'private-bookmark' : ''}`}
      onClick={triggerOpen}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="card-layout">
        {/* Bookmark type icon in top-left corner */}
        <div className="bookmark-type-overlay">
          <FontAwesomeIcon icon={contentTypeIcon} className="content-type-icon" />
        </div>
        
        <div className="card-content">
          <div className="card-content-header">
            {(cachedImage || firstUrl) && (
              <div 
                className="card-thumbnail"
                style={cachedImage ? { backgroundImage: `url(${cachedImage})` } : undefined}
                onClick={() => handleReadNow({ preventDefault: () => {} } as React.MouseEvent<HTMLButtonElement>)}
              >
                {!cachedImage && firstUrl && (
                  <div className="thumbnail-placeholder">
                    <FontAwesomeIcon icon={contentTypeIcon} />
                  </div>
                )}
              </div>
            )}
            <div className="card-text-content">
        <div className="bookmark-header">
          
          {getInternalRoute() ? (
            <Link
              to={getInternalRoute()!}
              className="bookmark-date-link"
              title="Open in app"
              onClick={(e) => e.stopPropagation()}
            >
              {formatDate(bookmark.created_at ?? bookmark.listUpdatedAt)}
            </Link>
          ) : (
            <span className="bookmark-date">{formatDate(bookmark.created_at ?? bookmark.listUpdatedAt)}</span>
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
          <RichContent content={articleSummary} className="bookmark-content article-summary" />
        ) : bookmark.parsedContent ? (
          <div className="bookmark-content">
            {shouldTruncate && bookmark.content
              ? <RichContent content={`${bookmark.content.slice(0, 210).trimEnd()}…`} className="" />
              : renderParsedContent(bookmark.parsedContent)}
          </div>
        ) : bookmark.content && (
          <RichContent content={shouldTruncate ? `${bookmark.content.slice(0, 210).trimEnd()}…` : bookmark.content} />
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
        
            </div>
          </div>
        </div>
        
        {/* Reading progress indicator as separator - always shown */}
        {isArticle && (
          <div className="reading-progress-separator">
            <div
              className="progress-fill"
              style={{
                width: readingProgress ? `${Math.round(readingProgress * 100)}%` : '0%',
                background: readingProgress ? progressColor : 'transparent'
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
    </div>
  )
}

