import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { useFilteredHighlights } from '../hooks/useFilteredHighlights'
import HighlightsPanelCollapsed from './HighlightsPanel/HighlightsPanelCollapsed'
import HighlightsPanelHeader from './HighlightsPanel/HighlightsPanelHeader'

export interface HighlightVisibility {
  nostrverse: boolean
  friends: boolean
  mine: boolean
}

interface HighlightsPanelProps {
  highlights: Highlight[]
  loading: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSelectUrl?: (url: string) => void
  selectedUrl?: string
  onToggleHighlights?: (show: boolean) => void
  selectedHighlightId?: string
  onRefresh?: () => void
  onHighlightClick?: (highlightId: string) => void
  currentUserPubkey?: string
  highlightVisibility?: HighlightVisibility
  onHighlightVisibilityChange?: (visibility: HighlightVisibility) => void
  followedPubkeys?: Set<string>
}

export const HighlightsPanel: React.FC<HighlightsPanelProps> = ({
  highlights,
  loading,
  isCollapsed,
  onToggleCollapse,
  onSelectUrl,
  selectedUrl,
  onToggleHighlights,
  selectedHighlightId,
  onRefresh,
  onHighlightClick,
  currentUserPubkey,
  highlightVisibility = { nostrverse: true, friends: true, mine: true },
  onHighlightVisibilityChange,
  followedPubkeys = new Set()
}) => {
  const [showHighlights, setShowHighlights] = useState(true)
  
  const handleToggleHighlights = () => {
    const newValue = !showHighlights
    setShowHighlights(newValue)
    onToggleHighlights?.(newValue)
  }
  
  const filteredHighlights = useFilteredHighlights({
    highlights,
    selectedUrl,
    highlightVisibility,
    currentUserPubkey,
    followedPubkeys
  })
  
  if (isCollapsed) {
    return (
      <HighlightsPanelCollapsed 
        hasHighlights={filteredHighlights.length > 0} 
        onToggleCollapse={onToggleCollapse}
      />
    )
  }

  return (
    <div className="highlights-container">
      <HighlightsPanelHeader
        loading={loading}
        hasHighlights={filteredHighlights.length > 0}
        showHighlights={showHighlights}
        highlightVisibility={highlightVisibility}
        currentUserPubkey={currentUserPubkey}
        onToggleHighlights={handleToggleHighlights}
        onRefresh={onRefresh}
        onToggleCollapse={onToggleCollapse}
        onHighlightVisibilityChange={onHighlightVisibilityChange}
      />

      {loading && filteredHighlights.length === 0 ? (
        <div className="highlights-loading">
          <FontAwesomeIcon icon={faHighlighter} spin />
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
              isSelected={highlight.id === selectedHighlightId}
              onHighlightClick={onHighlightClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

