import React from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDate } from '../../utils/bookmarkUtils'
import RichContent from '../RichContent'
import { IconGetter } from './shared'
import { useImageCache } from '../../hooks/useImageCache'
import { naddrEncode } from 'nostr-tools/nip19'

interface LargeViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  getIconForUrlType: IconGetter
  previewImage: string | null
  authorNpub: string
  getAuthorDisplayName: () => string
  handleReadNow: (e: React.MouseEvent<HTMLButtonElement>) => void
  articleSummary?: string
  contentTypeIcon: IconDefinition
  readingProgress?: number // 0-1 reading progress (optional)
}

export const LargeView: React.FC<LargeViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  getIconForUrlType,
  previewImage,
  authorNpub,
  getAuthorDisplayName,
  handleReadNow,
  articleSummary,
  contentTypeIcon,
  readingProgress
}) => {
  const cachedImage = useImageCache(previewImage || undefined)
  const isArticle = bookmark.kind === 30023
  
  // Calculate progress display (matching readingProgressUtils.ts logic)
  const progressPercent = readingProgress ? Math.round(readingProgress * 100) : 0
  let progressColor = '#6366f1' // Default blue (reading)
  
  if (readingProgress && readingProgress >= 0.95) {
    progressColor = '#10b981' // Green (completed)
  } else if (readingProgress && readingProgress > 0 && readingProgress <= 0.10) {
    progressColor = 'var(--color-text)' // Neutral text color (started)
  }
  
  const triggerOpen = () => handleReadNow({ preventDefault: () => {} } as React.MouseEvent<HTMLButtonElement>)
  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      triggerOpen()
    }
  }

  // Get internal route for the bookmark
  const getInternalRoute = (): string | null => {
    const firstUrl = hasUrls ? extractedUrls[0] : null
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
      className={`individual-bookmark large ${bookmark.isPrivate ? 'private-bookmark' : ''}`}
      onClick={triggerOpen}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {(hasUrls || (isArticle && cachedImage)) && (
        <div 
          className="large-preview-image" 
          onClick={(e) => {
            e.stopPropagation()
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
          <RichContent content={articleSummary} className="large-text article-summary" />
        ) : bookmark.content && (
          <RichContent content={bookmark.content} className="large-text" />
        )}
        
        {/* Reading progress indicator for all bookmark types - always shown */}
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
              width: readingProgress ? `${progressPercent}%` : '0%',
              background: readingProgress ? progressColor : 'var(--color-border)',
              transition: 'width 0.3s ease, background 0.3s ease'
            }}
          />
        </div>
        
        <div className="large-footer">
          <span className="bookmark-type-large">
            <FontAwesomeIcon icon={contentTypeIcon} className="content-type-icon" />
          </span>
          <span className="large-author">
            <Link
              to={`/p/${authorNpub}`}
              className="author-link-minimal"
              onClick={(e) => e.stopPropagation()}
            >
              {getAuthorDisplayName()}
            </Link>
          </span>
          
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
          
          {/* CTA removed */}
        </div>
      </div>
    </div>
  )
}

