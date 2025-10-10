import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faClock } from '@fortawesome/free-solid-svg-icons'
import { format } from 'date-fns'
import { useImageCache } from '../hooks/useImageCache'
import { UserSettings } from '../services/settingsService'

interface ReaderHeaderProps {
  title?: string
  image?: string
  summary?: string
  published?: number
  readingTimeText?: string | null
  hasHighlights: boolean
  highlightCount: number
  settings?: UserSettings
}

const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  title,
  image,
  summary,
  published,
  readingTimeText,
  hasHighlights,
  highlightCount,
  settings
}) => {
  const cachedImage = useImageCache(image, settings)
  const formattedDate = published ? format(new Date(published * 1000), 'MMM d, yyyy') : null
  const isLongSummary = summary && summary.length > 150
  
  if (cachedImage) {
    return (
      <>
        <div className="reader-hero-image">
          <img src={cachedImage} alt={title || 'Article image'} />
          {formattedDate && (
            <div className="publish-date-topright">
              {formattedDate}
            </div>
          )}
          {title && (
            <div className="reader-header-overlay">
              <h2 className="reader-title">{title}</h2>
              {summary && <p className={`reader-summary ${isLongSummary ? 'hide-on-mobile' : ''}`}>{summary}</p>}
              <div className="reader-meta">
                {readingTimeText && (
                  <div className="reading-time">
                    <FontAwesomeIcon icon={faClock} />
                    <span>{readingTimeText}</span>
                  </div>
                )}
                {hasHighlights && (
                  <div className="highlight-indicator">
                    <FontAwesomeIcon icon={faHighlighter} />
                    <span>{highlightCount} highlight{highlightCount !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {isLongSummary && (
          <div className="reader-summary-below-image">
            <p className="reader-summary">{summary}</p>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {title && (
        <div className="reader-header">
          {formattedDate && (
            <div className="publish-date-topright">
              {formattedDate}
            </div>
          )}
          <h2 className="reader-title">{title}</h2>
          {summary && <p className="reader-summary">{summary}</p>}
          <div className="reader-meta">
            {readingTimeText && (
              <div className="reading-time">
                <FontAwesomeIcon icon={faClock} />
                <span>{readingTimeText}</span>
              </div>
            )}
            {hasHighlights && (
              <div className="highlight-indicator">
                <FontAwesomeIcon icon={faHighlighter} />
                <span>{highlightCount} highlight{highlightCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default ReaderHeader


