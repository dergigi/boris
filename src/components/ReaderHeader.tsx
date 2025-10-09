import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faClock, faCalendar } from '@fortawesome/free-solid-svg-icons'
import { format } from 'date-fns'

interface ReaderHeaderProps {
  title?: string
  image?: string
  summary?: string
  published?: number
  readingTimeText?: string | null
  hasHighlights: boolean
  highlightCount: number
}

const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  title,
  image,
  summary,
  published,
  readingTimeText,
  hasHighlights,
  highlightCount
}) => {
  const formattedDate = published ? format(new Date(published * 1000), 'MMM d, yyyy') : null
  if (image) {
    return (
      <div className="reader-hero-image">
        <img src={image} alt={title || 'Article image'} />
        {title && (
          <div className="reader-header-overlay">
            <h2 className="reader-title">{title}</h2>
            {summary && <p className="reader-summary">{summary}</p>}
            <div className="reader-meta">
              {formattedDate && (
                <div className="publish-date">
                  <FontAwesomeIcon icon={faCalendar} />
                  <span>{formattedDate}</span>
                </div>
              )}
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
    )
  }

  return (
    <>
      {title && (
        <div className="reader-header">
          <h2 className="reader-title">{title}</h2>
          {summary && <p className="reader-summary">{summary}</p>}
          <div className="reader-meta">
            {formattedDate && (
              <div className="publish-date">
                <FontAwesomeIcon icon={faCalendar} />
                <span>{formattedDate}</span>
              </div>
            )}
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


