import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faClock } from '@fortawesome/free-solid-svg-icons'

interface ReaderHeaderProps {
  title?: string
  image?: string
  readingTimeText?: string | null
  hasHighlights: boolean
  highlightCount: number
}

const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  title,
  image,
  readingTimeText,
  hasHighlights,
  highlightCount
}) => {
  return (
    <>
      {image && (
        <div className="reader-hero-image">
          <img src={image} alt={title || 'Article image'} />
        </div>
      )}
      {title && (
        <div className="reader-header">
          <h2 className="reader-title">{title}</h2>
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


