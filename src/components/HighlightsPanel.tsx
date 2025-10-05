import React, { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faHighlighter, faEye, faEyeSlash, faRotate, faUser, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'

export type HighlightMode = 'mine' | 'others'

interface HighlightsPanelProps {
  highlights: Highlight[]
  loading: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSelectUrl?: (url: string) => void
  selectedUrl?: string
  onToggleUnderlines?: (show: boolean) => void
  selectedHighlightId?: string
  onRefresh?: () => void
  onHighlightClick?: (highlightId: string) => void
  currentUserPubkey?: string
  highlightMode?: HighlightMode
  onHighlightModeChange?: (mode: HighlightMode) => void
}

export const HighlightsPanel: React.FC<HighlightsPanelProps> = ({
  highlights,
  loading,
  isCollapsed,
  onToggleCollapse,
  onSelectUrl,
  selectedUrl,
  onToggleUnderlines,
  selectedHighlightId,
  onRefresh,
  onHighlightClick,
  currentUserPubkey,
  highlightMode = 'others',
  onHighlightModeChange
}) => {
  const [showUnderlines, setShowUnderlines] = useState(true)
  
  const handleToggleUnderlines = () => {
    const newValue = !showUnderlines
    setShowUnderlines(newValue)
    onToggleUnderlines?.(newValue)
  }
  
  // Filter highlights based on mode and URL
  const filteredHighlights = useMemo(() => {
    if (!selectedUrl) return highlights
    
    let urlFiltered = highlights
    
    // For Nostr articles (URL starts with "nostr:"), we don't need to filter by URL
    // because we already fetched highlights specifically for this article
    if (!selectedUrl.startsWith('nostr:')) {
      // For web URLs, filter by URL matching
      const normalizeUrl = (url: string) => {
        try {
          const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
          return `${urlObj.hostname.replace(/^www\./, '')}${urlObj.pathname}`.replace(/\/$/, '').toLowerCase()
        } catch {
          return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase()
        }
      }
      
      const normalizedSelected = normalizeUrl(selectedUrl)
      
      urlFiltered = highlights.filter(h => {
        if (!h.urlReference) return false
        const normalizedRef = normalizeUrl(h.urlReference)
        return normalizedSelected === normalizedRef || 
               normalizedSelected.includes(normalizedRef) ||
               normalizedRef.includes(normalizedSelected)
      })
    }
    
    // Filter by mode (mine vs others)
    if (!currentUserPubkey) {
      // If no user is logged in, show all highlights (others mode only makes sense)
      return urlFiltered
    }
    
    if (highlightMode === 'mine') {
      return urlFiltered.filter(h => h.pubkey === currentUserPubkey)
    } else {
      return urlFiltered.filter(h => h.pubkey !== currentUserPubkey)
    }
  }, [highlights, selectedUrl, highlightMode, currentUserPubkey])
  
  if (isCollapsed) {
    const hasHighlights = filteredHighlights.length > 0
    
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

  return (
    <div className="highlights-container">
      <div className="highlights-header">
        <div className="highlights-title">
          <FontAwesomeIcon icon={faHighlighter} />
          <h3>Highlights</h3>
          {!loading && <span className="count">({filteredHighlights.length})</span>}
        </div>
        <div className="highlights-actions">
          {currentUserPubkey && onHighlightModeChange && (
            <div className="highlight-mode-toggle">
              <button
                onClick={() => onHighlightModeChange('mine')}
                className={`mode-btn ${highlightMode === 'mine' ? 'active' : ''}`}
                title="My highlights"
                aria-label="Show my highlights"
              >
                <FontAwesomeIcon icon={faUser} />
              </button>
              <button
                onClick={() => onHighlightModeChange('others')}
                className={`mode-btn ${highlightMode === 'others' ? 'active' : ''}`}
                title="Other highlights"
                aria-label="Show highlights from others"
              >
                <FontAwesomeIcon icon={faUserGroup} />
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
          {filteredHighlights.length > 0 && (
            <button
              onClick={handleToggleUnderlines}
              className="toggle-underlines-btn"
              title={showUnderlines ? 'Hide underlines' : 'Show underlines'}
              aria-label={showUnderlines ? 'Hide underlines' : 'Show underlines'}
            >
              <FontAwesomeIcon icon={showUnderlines ? faEye : faEyeSlash} />
            </button>
          )}
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
              isSelected={highlight.id === selectedHighlightId}
              onHighlightClick={onHighlightClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

