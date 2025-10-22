import React from 'react'
import { faChevronRight, faEye, faEyeSlash, faRotate, faUser, faUserGroup, faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import { HighlightVisibility } from '../HighlightsPanel'
import IconButton from '../IconButton'

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
  isMobile?: boolean
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
  onHighlightVisibilityChange,
  isMobile = false
}) => {
  return (
    <div className="highlights-header">
      <div className="highlights-actions">
        <div className="highlights-actions-left">
          {onHighlightVisibilityChange && (
            <div className="highlight-level-toggles">
              <IconButton
                icon={faNetworkWired}
                onClick={() => onHighlightVisibilityChange({ 
                  ...highlightVisibility, 
                  nostrverse: !highlightVisibility.nostrverse 
                })}
                title="Toggle nostrverse highlights"
                ariaLabel="Toggle nostrverse highlights"
                variant="ghost"
                style={{ 
                  color: highlightVisibility.nostrverse ? 'var(--highlight-color-nostrverse, #9333ea)' : undefined,
                  opacity: highlightVisibility.nostrverse ? 1 : 0.4 
                }}
              />
              {currentUserPubkey && (
                <>
                  <IconButton
                    icon={faUserGroup}
                    onClick={() => onHighlightVisibilityChange({ 
                      ...highlightVisibility, 
                      friends: !highlightVisibility.friends 
                    })}
                    title="Toggle friends highlights"
                    ariaLabel="Toggle friends highlights"
                    variant="ghost"
                    style={{ 
                      color: highlightVisibility.friends ? 'var(--highlight-color-friends, #f97316)' : undefined,
                      opacity: highlightVisibility.friends ? 1 : 0.4 
                    }}
                  />
                  <IconButton
                    icon={faUser}
                    onClick={() => onHighlightVisibilityChange({ 
                      ...highlightVisibility, 
                      mine: !highlightVisibility.mine 
                    })}
                    title="Toggle my highlights"
                    ariaLabel="Toggle my highlights"
                    variant="ghost"
                    style={{ 
                      color: highlightVisibility.mine ? 'var(--highlight-color-mine, #eab308)' : undefined,
                      opacity: highlightVisibility.mine ? 1 : 0.4 
                    }}
                  />
                </>
              )}
            </div>
          )}
          {onRefresh && (
            <IconButton
              icon={faRotate}
              onClick={onRefresh}
              title="Refresh highlights"
              ariaLabel="Refresh highlights"
              variant="ghost"
              disabled={loading}
              spin={loading}
            />
          )}
          {hasHighlights && (
            <IconButton
              icon={showHighlights ? faEye : faEyeSlash}
              onClick={onToggleHighlights}
              title={showHighlights ? 'Hide highlights' : 'Show highlights'}
              ariaLabel={showHighlights ? 'Hide highlights' : 'Show highlights'}
              variant="ghost"
            />
          )}
        </div>
        {!isMobile && (
          <IconButton
            icon={faChevronRight}
            onClick={onToggleCollapse}
            title="Collapse highlights panel"
            ariaLabel="Collapse highlights panel"
            variant="ghost"
            style={{ transform: 'rotate(180deg)' }}
          />
        )}
      </div>
    </div>
  )
}

export default HighlightsPanelHeader

