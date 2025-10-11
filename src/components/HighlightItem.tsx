import React, { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuoteLeft, faExternalLinkAlt, faPlane, faSpinner, faServer, faTrash } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { useEventModel } from 'applesauce-react/hooks'
import { Models, IEventStore } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { Hooks } from 'applesauce-react'
import { onSyncStateChange, isEventSyncing } from '../services/offlineSyncService'
import { RELAYS } from '../config/relays'
import { areAllRelaysLocal } from '../utils/helpers'
import { nip19 } from 'nostr-tools'
import { formatDateCompact } from '../utils/bookmarkUtils'
import { createDeletionRequest } from '../services/deletionService'
import ConfirmDialog from './ConfirmDialog'

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
  onHighlightDelete?: (highlightId: string) => void
}

export const HighlightItem: React.FC<HighlightItemProps> = ({ 
  highlight, 
  onSelectUrl, 
  isSelected, 
  onHighlightClick,
  relayPool,
  eventStore,
  onHighlightUpdate,
  onHighlightDelete
}) => {
  const itemRef = useRef<HTMLDivElement>(null)
  const [isSyncing, setIsSyncing] = useState(() => isEventSyncing(highlight.id))
  const [showOfflineIndicator, setShowOfflineIndicator] = useState(() => highlight.isOfflineCreated && !isSyncing)
  const [isRebroadcasting, setIsRebroadcasting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const activeAccount = Hooks.useActiveAccount()
  
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
        // When sync completes successfully, update highlight to show all relays
        if (!syncingState) {
          setShowOfflineIndicator(false)
          
          // Update the highlight with all relays after successful sync
          if (onHighlightUpdate && highlight.isLocalOnly) {
            const updatedHighlight = {
              ...highlight,
              publishedRelays: RELAYS,
              isLocalOnly: false,
              isOfflineCreated: false
            }
            onHighlightUpdate(updatedHighlight)
          }
        }
      }
    })
    
    return unsubscribe
  }, [highlight, onHighlightUpdate])
  
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
      // Check if it's a coordinate string (kind:pubkey:identifier) or a simple event ID
      if (highlight.eventReference.includes(':')) {
        // It's an addressable event coordinate, encode as naddr
        const parts = highlight.eventReference.split(':')
        if (parts.length === 3) {
          const [kindStr, pubkey, identifier] = parts
          const kind = parseInt(kindStr, 10)
          
          // Get non-local relays for the hint
          const relayHints = RELAYS.filter(r => 
            !r.includes('localhost') && !r.includes('127.0.0.1')
          ).slice(0, 3) // Include up to 3 relay hints
          
          const naddr = nip19.naddrEncode({
            kind,
            pubkey,
            identifier,
            relays: relayHints
          })
          return `https://njump.me/${naddr}`
        }
      } else {
        // It's a simple event ID, encode as nevent
        // Get non-local relays for the hint
        const relayHints = RELAYS.filter(r => 
          !r.includes('localhost') && !r.includes('127.0.0.1')
        ).slice(0, 3) // Include up to 3 relay hints
        
        const nevent = nip19.neventEncode({
          id: highlight.eventReference,
          relays: relayHints,
          author: highlight.author
        })
        return `https://njump.me/${nevent}`
      }
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
      
      // Publish to all configured relays - let the relay pool handle connection state
      const targetRelays = RELAYS
      
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
        tooltip: isRebroadcasting ? 'rebroadcasting...' : 'syncing...',
        spin: true
      }
    }
    
    // Always show relay list, use plane icon for local-only
    const isLocalOrOffline = highlight.isLocalOnly || showOfflineIndicator
    
    // Show server icon with relay info if available
    if (highlight.publishedRelays && highlight.publishedRelays.length > 0) {
      const relayNames = highlight.publishedRelays.map(url => 
        url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
      )
      return {
        icon: isLocalOrOffline ? faPlane : faServer,
        tooltip: relayNames.join('\n'),
        spin: false
      }
    }
    
    if (highlight.seenOnRelays && highlight.seenOnRelays.length > 0) {
      const relayNames = highlight.seenOnRelays.map(url => 
        url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
      )
      return {
        icon: faServer,
        tooltip: relayNames.join('\n'),
        spin: false
      }
    }
    
    // Fallback: show all relays we queried (where this was likely fetched from)
    const relayNames = RELAYS.map(url => 
      url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
    )
    return {
      icon: faServer,
      tooltip: relayNames.join('\n'),
      spin: false
    }
  }
  
  const relayIndicator = getRelayIndicatorInfo()
  
  // Check if current user can delete this highlight
  const canDelete = activeAccount && highlight.pubkey === activeAccount.pubkey
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }
  
  const handleConfirmDelete = async () => {
    if (!activeAccount || !relayPool) {
      console.warn('Cannot delete: no account or relay pool')
      return
    }
    
    setIsDeleting(true)
    setShowDeleteConfirm(false)
    
    try {
      await createDeletionRequest(
        highlight.id,
        9802, // kind for highlights
        'Deleted by user',
        activeAccount,
        relayPool
      )
      
      console.log('✅ Highlight deletion request published')
      
      // Notify parent to remove this highlight from the list
      if (onHighlightDelete) {
        onHighlightDelete(highlight.id)
      }
    } catch (error) {
      console.error('Failed to delete highlight:', error)
    } finally {
      setIsDeleting(false)
    }
  }
  
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
  }
  
  return (
    <>
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
        {canDelete && (
          <div 
            className="highlight-delete-btn" 
            title="Delete highlight"
            onClick={handleDeleteClick}
          >
            <FontAwesomeIcon icon={isDeleting ? faSpinner : faTrash} spin={isDeleting} />
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
            {formatDateCompact(highlight.created_at)}
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
    
    <ConfirmDialog
      isOpen={showDeleteConfirm}
      title="Delete Highlight?"
      message="This will request deletion of your highlight. It may still be visible on some relays that don't honor deletion requests."
      confirmText="Delete"
      cancelText="Cancel"
      variant="danger"
      onConfirm={handleConfirmDelete}
      onCancel={handleCancelDelete}
    />
    </>
  )
}

