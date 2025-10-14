import React, { useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faClock } from '@fortawesome/free-solid-svg-icons'
import { format } from 'date-fns'
import { useImageCache } from '../hooks/useImageCache'
import { UserSettings } from '../services/settingsService'
import { Highlight, HighlightLevel } from '../types/highlights'
import { HighlightVisibility } from './HighlightsPanel'
import { hexToRgb } from '../utils/colorHelpers'

interface ReaderHeaderProps {
  title?: string
  image?: string
  summary?: string
  published?: number
  readingTimeText?: string | null
  hasHighlights: boolean
  highlightCount: number
  settings?: UserSettings
  highlights?: Highlight[]
  highlightVisibility?: HighlightVisibility
}

const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  title,
  image,
  summary,
  published,
  readingTimeText,
  hasHighlights,
  highlightCount,
  settings,
  highlights = [],
  highlightVisibility = { nostrverse: true, friends: true, mine: true }
}) => {
  const cachedImage = useImageCache(image, settings)
  const formattedDate = published ? format(new Date(published * 1000), 'MMM d, yyyy') : null
  const isLongSummary = summary && summary.length > 150
  
  // Determine the dominant highlight color based on visibility and priority
  const getHighlightIndicatorStyles = useMemo(() => (isOverlay: boolean) => {
    if (!highlights.length) return undefined
    
    // Count highlights by level that are visible
    const visibleLevels = new Set<HighlightLevel>()
    highlights.forEach(h => {
      if (h.level && highlightVisibility[h.level]) {
        visibleLevels.add(h.level)
      }
    })
    
    let hexColor: string | undefined
    // Priority: nostrverse > friends > mine
    if (visibleLevels.has('nostrverse') && highlightVisibility.nostrverse) {
      hexColor = settings?.highlightColorNostrverse || '#9333ea'
    } else if (visibleLevels.has('friends') && highlightVisibility.friends) {
      hexColor = settings?.highlightColorFriends || '#f97316'
    } else if (visibleLevels.has('mine') && highlightVisibility.mine) {
      hexColor = settings?.highlightColorMine || '#ffff00'
    }
    
    if (!hexColor) return undefined
    
    const rgb = hexToRgb(hexColor)
    return {
      backgroundColor: `rgba(${rgb}, 0.1)`,
      borderColor: `rgba(${rgb}, 0.3)`,
      // Only force white color in overlay context, otherwise let CSS handle it
      ...(isOverlay && { color: '#fff' })
    }
  }, [highlights, highlightVisibility, settings])
  
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
                  <div 
                    className="highlight-indicator"
                    style={getHighlightIndicatorStyles(true)}
                  >
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
              <div 
                className="highlight-indicator"
                style={getHighlightIndicatorStyles(false)}
              >
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


