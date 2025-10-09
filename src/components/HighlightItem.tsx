import React, { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuoteLeft, faExternalLinkAlt, faPlane, faSpinner, faServer } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { formatDistanceToNow } from 'date-fns'
import { useEventModel } from 'applesauce-react/hooks'
import { Models, IEventStore } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { onSyncStateChange, isEventSyncing } from '../services/offlineSyncService'
import { RELAYS } from '../config/relays'
import { areAllRelaysLocal } from '../utils/helpers'

interface HighlightWithLevel extends Highlight {
  level?: 'mine' | 'friends' | 'nostrverse'
}

interface HighlightItemProps {
  highlight: HighlightWithLevel
  onSelectUrl?: (url: string) => void
  isSelected?: boolean
  onHighlightClick?: (highlightId: string) => void
  relayPool?: RelayPool | null
  eventStore?: IEventStore | null
  onHighlightUpdate?: (highlight: Highlight) => void
}

export const HighlightItem: React.FC<HighlightItemProps> = ({ 
  highlight, 
  onSelectUrl, 
  isSelected, 
  onHighlightClick,
  relayPool,
  eventStore,
  onHighlightUpdate
}) => {
  const itemRef = useRef<HTMLDivElement>(null)
  const [isSyncing, setIsSyncing] = useState(() => isEventSyncing(highlight.id))
  const [showOfflineIndicator, setShowOfflineIndicator] = useState(() => highlight.isOfflineCreated && !isSyncing)
  const [isRebroadcasting, setIsRebroadcasting] = useState(false)
  
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
  
  // Handle rebroadcast to all relays
  const handleRebroadcast = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering highlight selection
    
    if (!relayPool || !eventStore || isRebroadcasting) return
    
    setIsRebroadcasting(true)
    
    try {
      // Get the event from the event store
      const event = eventStore.getEvent(highlight.id)
      if (!event) {
        console.error('Event not found in store:', highlight.id)
        return
      }
      
      // Get all connected relays
      const connectedRelays = Array.from(relayPool.relays.values())
        .filter(relay => relay.connected)
        .map(relay => relay.url)
      
      // Publish to all connected relays
      const targetRelays = RELAYS.filter(url => connectedRelays.includes(url))
      
      if (targetRelays.length === 0) {
        console.warn('No connected relays to rebroadcast to')
        return
      }
      
      console.log('📡 Rebroadcasting highlight to', targetRelays.length, 'relay(s):', targetRelays)
      
      await relayPool.publish(targetRelays, event)
      
      console.log('✅ Rebroadcast successful!')
      
      // Update the highlight with new relay info
      const isLocalOnly = areAllRelaysLocal(targetRelays)
      const updatedHighlight = {
        ...highlight,
        publishedRelays: targetRelays,
        isLocalOnly,
        isOfflineCreated: false
      }
      
      // Notify parent of the update
      if (onHighlightUpdate) {
        onHighlightUpdate(updatedHighlight)
      }
      
      // Update local state
      setShowOfflineIndicator(false)
      
    } catch (error) {
      console.error('❌ Failed to rebroadcast:', error)
    } finally {
      setIsRebroadcasting(false)
    }
  }
  
  // Determine relay indicator icon and tooltip
  const getRelayIndicatorInfo = () => {
    // Show spinner if manually rebroadcasting OR auto-syncing
    if (isRebroadcasting || isSyncing) {
      return {
        icon: faSpinner,
        tooltip: isRebroadcasting ? 'Rebroadcasting to all relays...' : 'Auto-syncing to remote relays...',
        spin: true
      }
    }
    
    const isLocalOrOffline = highlight.isLocalOnly || showOfflineIndicator
    
    if (isLocalOrOffline) {
      return {
        icon: faPlane,
        tooltip: 'Click to rebroadcast to all relays',
        spin: false
      }
    }
    
    if (!highlight.publishedRelays || highlight.publishedRelays.length === 0) {
      return null
    }
    
    const relayNames = highlight.publishedRelays.map(url => 
      url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
    )
    return {
      icon: faServer,
      tooltip: `Published to ${relayNames.length} relay(s):\n${relayNames.join('\n')}\n\nClick to rebroadcast`,
      spin: false
    }
  }
  
  const relayIndicator = getRelayIndicatorInfo()
  
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
        {relayIndicator && (
          <div 
            className="highlight-relay-indicator" 
            title={relayIndicator.tooltip}
            onClick={handleRebroadcast}
            style={{ cursor: relayPool && eventStore ? 'pointer' : 'default' }}
          >
            <FontAwesomeIcon icon={relayIndicator.icon} spin={relayIndicator.spin} />
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

