import React, { useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faChevronLeft, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'

interface HighlightsPanelProps {
  highlights: Highlight[]
  loading: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSelectUrl?: (url: string) => void
  selectedUrl?: string
}

export const HighlightsPanel: React.FC<HighlightsPanelProps> = ({
  highlights,
  loading,
  isCollapsed,
  onToggleCollapse,
  onSelectUrl,
  selectedUrl
}) => {
  // Filter highlights to show only those relevant to the current URL
  const filteredHighlights = useMemo(() => {
    if (!selectedUrl) return highlights
    
    const normalizeUrl = (url: string) => {
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
        return `${urlObj.hostname.replace(/^www\./, '')}${urlObj.pathname}`.replace(/\/$/, '').toLowerCase()
      } catch {
        return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase()
      }
    }
    
    const normalizedSelected = normalizeUrl(selectedUrl)
    
    return highlights.filter(h => {
      if (!h.urlReference) return false
      const normalizedRef = normalizeUrl(h.urlReference)
      return normalizedSelected === normalizedRef || 
             normalizedSelected.includes(normalizedRef) ||
             normalizedRef.includes(normalizedSelected)
    })
  }, [highlights, selectedUrl])
  
  if (isCollapsed) {
    return (
      <div className="highlights-container collapsed">
        <button
          onClick={onToggleCollapse}
          className="toggle-highlights-btn"
          title="Expand highlights panel"
          aria-label="Expand highlights panel"
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
      </div>
    )
  }

  return (
    <div className="highlights-container">
      <div className="highlights-header">
        <div className="highlights-title">
          <FontAwesomeIcon icon={faHighlighter} />
          <h3>Highlights</h3>
          {!loading && <span className="count">({filteredHighlights.length})</span>}
        </div>
        <button
          onClick={onToggleCollapse}
          className="toggle-highlights-btn"
          title="Collapse highlights panel"
          aria-label="Collapse highlights panel"
        >
          <FontAwesomeIcon icon={faChevronRight} rotation={180} />
        </button>
      </div>

      {loading ? (
        <div className="highlights-loading">
          <p>Loading highlights...</p>
        </div>
      ) : filteredHighlights.length === 0 ? (
        <div className="highlights-empty">
          <FontAwesomeIcon icon={faHighlighter} size="2x" />
          <p>No highlights for this article.</p>
          <p className="empty-hint">
            {selectedUrl 
              ? 'Create highlights for this article using a Nostr client that supports NIP-84.'
              : 'Select an article to view its highlights.'}
          </p>
        </div>
      ) : (
        <div className="highlights-list">
          {filteredHighlights.map((highlight) => (
            <HighlightItem
              key={highlight.id}
              highlight={highlight}
              onSelectUrl={onSelectUrl}
            />
          ))}
        </div>
      )}
    </div>
  )
}

