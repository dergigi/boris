import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faChevronRight } from '@fortawesome/free-solid-svg-icons'

interface HighlightsPanelCollapsedProps {
  hasHighlights: boolean
  onToggleCollapse: () => void
}

const HighlightsPanelCollapsed: React.FC<HighlightsPanelCollapsedProps> = ({
  hasHighlights,
  onToggleCollapse
}) => {
  return (
    <div className="highlights-container collapsed">
      <button
        onClick={onToggleCollapse}
        className={`toggle-highlights-btn with-icon ${hasHighlights ? 'has-highlights' : ''}`}
        title="Expand highlights panel"
        aria-label="Expand highlights panel"
      >
        <FontAwesomeIcon icon={faHighlighter} className={hasHighlights ? 'glow' : ''} />
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  )
}

export default HighlightsPanelCollapsed

