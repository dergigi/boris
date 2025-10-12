import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'

interface HighlightsPanelCollapsedProps {
  hasHighlights: boolean
  onToggleCollapse: () => void
  settings?: UserSettings
}

const HighlightsPanelCollapsed: React.FC<HighlightsPanelCollapsedProps> = ({
  hasHighlights,
  onToggleCollapse,
  settings
}) => {
  const highlightColor = settings?.highlightColorMine || '#ffff00'
  
  return (
    <div className="highlights-container collapsed">
      <button
        onClick={onToggleCollapse}
        className={`toggle-highlights-btn with-icon ${hasHighlights ? 'has-highlights' : ''}`}
        title="Expand highlights panel"
        aria-label="Expand highlights panel"
        style={{ color: highlightColor }}
      >
        <FontAwesomeIcon icon={faHighlighter} className={hasHighlights ? 'glow' : ''} />
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  )
}

export default HighlightsPanelCollapsed

