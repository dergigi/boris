import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faClock } from '@fortawesome/free-solid-svg-icons'

interface ReaderHeaderProps {
  title?: string
  image?: string
  summary?: string
  readingTimeText?: string | null
  hasHighlights: boolean
  highlightCount: number
}

const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  title,
  image,
  summary,
  readingTimeText,
  hasHighlights,
  highlightCount
}) => {
  if (image) {
    return (
      <div className="reader-hero-image">
        <img src={image} alt={title || 'Article image'} />
        {title && (
          <div className="reader-header-overlay">
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


