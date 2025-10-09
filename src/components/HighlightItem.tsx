import React, { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuoteLeft, faExternalLinkAlt, faHouseSignal, faPlane, faSpinner, faServer } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { formatDistanceToNow } from 'date-fns'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { onSyncStateChange, isEventSyncing } from '../services/offlineSyncService'

interface HighlightWithLevel extends Highlight {
  level?: 'mine' | 'friends' | 'nostrverse'
}

interface HighlightItemProps {
  highlight: HighlightWithLevel
  onSelectUrl?: (url: string) => void
  isSelected?: boolean
  onHighlightClick?: (highlightId: string) => void
}

export const HighlightItem: React.FC<HighlightItemProps> = ({ highlight, onSelectUrl, isSelected, onHighlightClick }) => {
  const itemRef = useRef<HTMLDivElement>(null)
  const [isSyncing, setIsSyncing] = useState(() => isEventSyncing(highlight.id))
  const [showOfflineIndicator, setShowOfflineIndicator] = useState(() => highlight.isOfflineCreated && !isSyncing)
  
  // Resolve the profile of the user who made the highlight
  const profile = useEventModel(Models.ProfileModel, [highlight.pubkey])
  
  // Get display name for the user
  const getUserDisplayName = () => {
    if (profile?.name) return profile.name
    if (profile?.display_name) return profile.display_name
    return `${highlight.pubkey.slice(0, 8)}...` // fallback to short pubkey
  }
  
  // Update offline indicator when highlight prop changes
  useEffect(() => {
    if (highlight.isOfflineCreated && !isSyncing) {
      setShowOfflineIndicator(true)
    }
  }, [highlight.isOfflineCreated, isSyncing])
  
  // Listen to sync state changes
  useEffect(() => {
    const unsubscribe = onSyncStateChange((eventId, syncingState) => {
      if (eventId === highlight.id) {
        setIsSyncing(syncingState)
        // Hide offline indicator when sync completes successfully
        if (!syncingState) {
          setShowOfflineIndicator(false)
        }
      }
    })
    
    return unsubscribe
  }, [highlight.id])
  
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isSelected])
  
  const handleItemClick = () => {
    if (onHighlightClick) {
      onHighlightClick(highlight.id)
    }
  }
  
  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    if (onSelectUrl) {
      e.preventDefault()
      onSelectUrl(url)
    }
  }
  
  const getSourceLink = () => {
    if (highlight.eventReference) {
      return `https://search.dergigi.com/e/${highlight.eventReference}`
    }
    return highlight.urlReference
  }
  
  const sourceLink = getSourceLink()
  
  // Format relay list for tooltip
  const getRelayTooltip = () => {
    if (!highlight.publishedRelays || highlight.publishedRelays.length === 0) {
      return 'No relay information available'
    }
    const relayNames = highlight.publishedRelays.map(url => 
      url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
    )
    return `Published to ${relayNames.length} relay(s):\n${relayNames.join('\n')}`
  }
  
  return (
    <div 
      ref={itemRef} 
      className={`highlight-item ${isSelected ? 'selected' : ''} ${highlight.level ? `level-${highlight.level}` : ''}`} 
      data-highlight-id={highlight.id}
      onClick={handleItemClick}
      style={{ cursor: onHighlightClick ? 'pointer' : 'default' }}
    >
      <div className="highlight-quote-icon">
        <FontAwesomeIcon icon={faQuoteLeft} />
        {highlight.publishedRelays && highlight.publishedRelays.length > 0 && (
          <div className="highlight-relay-indicator" title={getRelayTooltip()}>
            <FontAwesomeIcon icon={faServer} />
          </div>
        )}
      </div>
      
      <div className="highlight-content">
        <blockquote className="highlight-text">
          {highlight.content}
        </blockquote>
        
        {highlight.comment && (
          <div className="highlight-comment">
            {highlight.comment}
          </div>
        )}
        
        
        <div className="highlight-meta">
          <span className="highlight-author">
            {getUserDisplayName()}
          </span>
          <span className="highlight-meta-separator">•</span>
          <span className="highlight-time">
            {formatDistanceToNow(new Date(highlight.created_at * 1000), { addSuffix: true })}
          </span>
          
          {highlight.isLocalOnly && (
            <>
              <span className="highlight-meta-separator">•</span>
              <span className="highlight-local-indicator" title="This highlight is only stored on your local relay">
                <FontAwesomeIcon icon={faHouseSignal} />
                <span className="highlight-local-text">Local</span>
              </span>
            </>
          )}
          
          {isSyncing && (
            <>
              <span className="highlight-meta-separator">•</span>
              <span className="highlight-syncing-indicator" title="Syncing to remote relays...">
                <FontAwesomeIcon icon={faSpinner} spin />
              </span>
            </>
          )}
          
          {!isSyncing && showOfflineIndicator && (
            <>
              <span className="highlight-meta-separator">•</span>
              <span className="highlight-offline-indicator" title="Created while in flight mode">
                <FontAwesomeIcon icon={faPlane} />
              </span>
            </>
          )}
          
          {sourceLink && (
            <a
              href={sourceLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => highlight.urlReference && onSelectUrl ? handleLinkClick(highlight.urlReference, e) : undefined}
              className="highlight-source"
              title={highlight.eventReference ? 'Open on Nostr' : 'Open source'}
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

