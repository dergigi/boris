import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { useFilteredHighlights } from '../hooks/useFilteredHighlights'
import { usePullToRefresh } from 'use-pull-to-refresh'
import HighlightsPanelCollapsed from './HighlightsPanel/HighlightsPanelCollapsed'
import HighlightsPanelHeader from './HighlightsPanel/HighlightsPanelHeader'
import RefreshIndicator from './RefreshIndicator'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { UserSettings } from '../services/settingsService'
import { HighlightSkeleton } from './Skeletons'

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
  relayPool?: RelayPool | null
  eventStore?: IEventStore | null
  settings?: UserSettings
  isMobile?: boolean
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
  followedPubkeys = new Set(),
  relayPool,
  eventStore,
  settings,
  isMobile = false
}) => {
  const [showHighlights, setShowHighlights] = useState(true)
  const [localHighlights, setLocalHighlights] = useState(highlights)
  
  const handleToggleHighlights = () => {
    const newValue = !showHighlights
    setShowHighlights(newValue)
    onToggleHighlights?.(newValue)
  }

  // Pull-to-refresh for highlights
  const { isRefreshing, pullPosition } = usePullToRefresh({
    onRefresh: () => {
      if (onRefresh) {
        onRefresh()
      }
    },
    maximumPullLength: 240,
    refreshThreshold: 80,
    isDisabled: !onRefresh
  })
  
  // Keep track of highlight updates
  React.useEffect(() => {
    setLocalHighlights(highlights)
  }, [highlights])
  
  const handleHighlightUpdate = (updatedHighlight: Highlight) => {
    setLocalHighlights(prev => 
      prev.map(h => h.id === updatedHighlight.id ? updatedHighlight : h)
    )
  }
  
  const handleHighlightDelete = (highlightId: string) => {
    // Remove highlight from local state
    setLocalHighlights(prev => prev.filter(h => h.id !== highlightId))
  }
  
  const filteredHighlights = useFilteredHighlights({
    highlights: localHighlights,
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
        settings={settings}
      />
    )
  }

  return (
    <div className="highlights-container">
      <HighlightsPanelHeader
        hasHighlights={filteredHighlights.length > 0}
        showHighlights={showHighlights}
        highlightVisibility={highlightVisibility}
        currentUserPubkey={currentUserPubkey}
        onToggleHighlights={handleToggleHighlights}
        onToggleCollapse={onToggleCollapse}
        onHighlightVisibilityChange={onHighlightVisibilityChange}
        onRefresh={onRefresh}
        isLoading={loading}
        isMobile={isMobile}
      />

      {loading && filteredHighlights.length === 0 ? (
        <div className="highlights-list" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <HighlightSkeleton key={i} />
          ))}
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
          <RefreshIndicator
            isRefreshing={isRefreshing}
            pullPosition={pullPosition}
          />
          {filteredHighlights.map((highlight) => (
            <HighlightItem
              key={highlight.id}
              highlight={highlight}
              onSelectUrl={onSelectUrl}
              isSelected={highlight.id === selectedHighlightId}
              onHighlightClick={onHighlightClick}
              relayPool={relayPool}
              eventStore={eventStore}
              onHighlightUpdate={handleHighlightUpdate}
              onHighlightDelete={handleHighlightDelete}
              showCitation={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}

