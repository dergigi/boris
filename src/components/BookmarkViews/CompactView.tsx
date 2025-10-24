import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { IndividualBookmark } from '../../types/bookmarks'
import { formatDateCompact } from '../../utils/bookmarkUtils'
import RichContent from '../RichContent'
import { naddrEncode } from 'nostr-tools/nip19'

interface CompactViewProps {
  bookmark: IndividualBookmark
  index: number
  hasUrls: boolean
  extractedUrls: string[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  articleTitle?: string
  contentTypeIcon: IconDefinition
  readingProgress?: number
}

export const CompactView: React.FC<CompactViewProps> = ({
  bookmark,
  index,
  hasUrls,
  extractedUrls,
  onSelectUrl,
  articleTitle,
  contentTypeIcon,
  readingProgress
}) => {
  const navigate = useNavigate()
  const isArticle = bookmark.kind === 30023
  const isWebBookmark = bookmark.kind === 39701
  const isNote = bookmark.kind === 1
  const isClickable = hasUrls || isArticle || isWebBookmark || isNote
  
  const displayText = isArticle && articleTitle ? articleTitle : bookmark.content

  // Calculate progress color
  let progressColor = '#6366f1' // Default blue (reading)
  if (readingProgress && readingProgress >= 0.95) {
    progressColor = '#10b981' // Green (completed)
  } else if (readingProgress && readingProgress > 0 && readingProgress <= 0.10) {
    progressColor = 'var(--color-text)' // Neutral text color (started)
  }

  const handleCompactClick = () => {
    if (isArticle) {
      const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1]
      if (dTag) {
        const naddr = naddrEncode({
          kind: bookmark.kind,
          pubkey: bookmark.pubkey,
          identifier: dTag
        })
        navigate(`/a/${naddr}`)
      }
    } else if (hasUrls) {
      onSelectUrl?.(extractedUrls[0])
    } else if (isNote) {
      navigate(`/e/${bookmark.id}`)
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
          <FontAwesomeIcon icon={contentTypeIcon} className="content-type-icon" />
        </span>
        {displayText ? (
          <div className="compact-text">
            <RichContent content={displayText.slice(0, 60) + (displayText.length > 60 ? '…' : '')} className="" />
          </div>
        ) : (
          <div className="compact-text" style={{ opacity: 0.5, fontSize: '0.85em' }}>
            <code>{bookmark.id.slice(0, 12)}...</code>
          </div>
        )}
        <span className="bookmark-date-compact">{formatDateCompact(bookmark.created_at ?? bookmark.listUpdatedAt)}</span>
        {/* CTA removed */}
      </div>
      
      {/* Reading progress indicator for all bookmark types with reading data */}
      {readingProgress !== undefined && readingProgress > 0 && (
        <div 
          style={{
            height: '1px',
            width: '100%',
            background: 'var(--color-border)',
            overflow: 'hidden',
            margin: '0',
            marginLeft: '1.5rem'
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
    </div>
  )
}

