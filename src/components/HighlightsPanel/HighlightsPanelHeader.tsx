import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faEye, faEyeSlash, faRotate, faUser, faUserGroup, faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import { HighlightVisibility } from '../HighlightsPanel'

interface HighlightsPanelHeaderProps {
  loading: boolean
  hasHighlights: boolean
  showHighlights: boolean
  highlightVisibility: HighlightVisibility
  currentUserPubkey?: string
  onToggleHighlights: () => void
  onRefresh?: () => void
  onToggleCollapse: () => void
  onHighlightVisibilityChange?: (visibility: HighlightVisibility) => void
}

const HighlightsPanelHeader: React.FC<HighlightsPanelHeaderProps> = ({
  loading,
  hasHighlights,
  showHighlights,
  highlightVisibility,
  currentUserPubkey,
  onToggleHighlights,
  onRefresh,
  onToggleCollapse,
  onHighlightVisibilityChange
}) => {
  return (
    <div className="highlights-header">
      <div className="highlights-actions">
        <div className="highlights-actions-left">
          {onHighlightVisibilityChange && (
            <div className="highlight-level-toggles">
              <button
                onClick={() => onHighlightVisibilityChange({ 
                  ...highlightVisibility, 
                  nostrverse: !highlightVisibility.nostrverse 
                })}
                className={`level-toggle-btn ${highlightVisibility.nostrverse ? 'active' : ''}`}
                title="Toggle nostrverse highlights"
                aria-label="Toggle nostrverse highlights"
                style={{ color: highlightVisibility.nostrverse ? 'var(--highlight-color-nostrverse, #9333ea)' : undefined }}
              >
                <FontAwesomeIcon icon={faNetworkWired} />
              </button>
              <button
                onClick={() => onHighlightVisibilityChange({ 
                  ...highlightVisibility, 
                  friends: !highlightVisibility.friends 
                })}
                className={`level-toggle-btn ${highlightVisibility.friends ? 'active' : ''}`}
                title={currentUserPubkey ? "Toggle friends highlights" : "Login to see friends highlights"}
                aria-label="Toggle friends highlights"
                style={{ color: highlightVisibility.friends ? 'var(--highlight-color-friends, #f97316)' : undefined }}
                disabled={!currentUserPubkey}
              >
                <FontAwesomeIcon icon={faUserGroup} />
              </button>
              <button
                onClick={() => onHighlightVisibilityChange({ 
                  ...highlightVisibility, 
                  mine: !highlightVisibility.mine 
                })}
                className={`level-toggle-btn ${highlightVisibility.mine ? 'active' : ''}`}
                title={currentUserPubkey ? "Toggle my highlights" : "Login to see your highlights"}
                aria-label="Toggle my highlights"
                style={{ color: highlightVisibility.mine ? 'var(--highlight-color-mine, #eab308)' : undefined }}
                disabled={!currentUserPubkey}
              >
                <FontAwesomeIcon icon={faUser} />
              </button>
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="refresh-highlights-btn"
              title="Refresh highlights"
              aria-label="Refresh highlights"
              disabled={loading}
            >
              <FontAwesomeIcon icon={faRotate} spin={loading} />
            </button>
          )}
          {hasHighlights && (
            <button
              onClick={onToggleHighlights}
              className="toggle-highlight-display-btn"
              title={showHighlights ? 'Hide highlights' : 'Show highlights'}
              aria-label={showHighlights ? 'Hide highlights' : 'Show highlights'}
            >
              <FontAwesomeIcon icon={showHighlights ? faEye : faEyeSlash} />
            </button>
          )}
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
    </div>
  )
}

export default HighlightsPanelHeader

