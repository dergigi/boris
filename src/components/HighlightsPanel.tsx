import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'

interface HighlightsPanelProps {
  highlights: Highlight[]
  loading: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSelectUrl?: (url: string) => void
}

export const HighlightsPanel: React.FC<HighlightsPanelProps> = ({
  highlights,
  loading,
  isCollapsed,
  onToggleCollapse,
  onSelectUrl
}) => {
  if (isCollapsed) {
    return (
      <div className="highlights-container collapsed">
        <button
          onClick={onToggleCollapse}
          className="toggle-highlights-btn"
          title="Expand highlights panel"
          aria-label="Expand highlights panel"
        >
          <FontAwesomeIcon icon={faChevronRight} />
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
          {!loading && <span className="count">({highlights.length})</span>}
        </div>
        <button
          onClick={onToggleCollapse}
          className="toggle-highlights-btn"
          title="Collapse highlights panel"
          aria-label="Collapse highlights panel"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      {loading ? (
        <div className="highlights-loading">
          <p>Loading highlights...</p>
        </div>
      ) : highlights.length === 0 ? (
        <div className="highlights-empty">
          <FontAwesomeIcon icon={faHighlighter} size="2x" />
          <p>No highlights found.</p>
          <p className="empty-hint">
            Create highlights using a Nostr client that supports NIP-84.
          </p>
        </div>
      ) : (
        <div className="highlights-list">
          {highlights.map((highlight) => (
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

