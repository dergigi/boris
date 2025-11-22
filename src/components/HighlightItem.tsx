import React, { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuoteLeft, faExternalLinkAlt, faPlane, faSpinner, faHighlighter, faTrash, faEllipsisH, faMobileAlt } from '@fortawesome/free-solid-svg-icons'
import { faComments } from '@fortawesome/free-regular-svg-icons'
import { Highlight } from '../types/highlights'
import { useEventModel } from 'applesauce-react/hooks'
import { Models, IEventStore } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { Hooks } from 'applesauce-react'
import { onSyncStateChange, isEventSyncing, isEventOfflineCreated } from '../services/offlineSyncService'
import { areAllRelaysLocal, isLocalRelay } from '../utils/helpers'
import { getActiveRelayUrls } from '../services/relayManager'
import { isContentRelay, getContentRelays, getFallbackContentRelays } from '../config/relays'
import { nip19 } from 'nostr-tools'
import { formatDateCompact } from '../utils/bookmarkUtils'
import { createDeletionRequest } from '../services/deletionService'
import { getNostrUrl } from '../config/nostrGateways'
import CompactButton from './CompactButton'
import { HighlightCitation } from './HighlightCitation'
import { useNavigate } from 'react-router-dom'
import NostrMentionLink from './NostrMentionLink'
import { getProfileDisplayName } from '../utils/nostrUriResolver'

// Helper to detect if a URL is an image
const isImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/.test(pathname)
  } catch {
    return false
  }
}

// Component to render comment with links, inline images, and nostr identifiers
const CommentContent: React.FC<{ text: string }> = ({ text }) => {
  // Pattern to match both http(s) URLs and nostr: URIs
  const urlPattern = /((?:https?:\/\/|nostr:)[^\s]+)/g
  const parts = text.split(urlPattern)
  
  return (
    <>
      {parts.map((part, index) => {
        // Handle nostr: URIs - now with profile resolution
        if (part.startsWith('nostr:')) {
          return (
            <NostrMentionLink
              key={index}
              nostrUri={part}
              onClick={(e) => e.stopPropagation()}
            />
          )
        }
        
        // Handle http(s) URLs
        if (part.match(/^https?:\/\//)) {
          if (isImageUrl(part)) {
            return (
              <img
                key={index}
                src={part}
                alt="Comment attachment"
                className="highlight-comment-image"
                loading="lazy"
              />
            )
          } else {
            return (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="highlight-comment-link"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            )
          }
        }
        
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

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
  showCitation?: boolean
}

export const HighlightItem: React.FC<HighlightItemProps> = ({ 
  highlight, 
  // onSelectUrl is not used but kept in props for API compatibility
  isSelected, 
  onHighlightClick,
  relayPool,
  eventStore,
  onHighlightUpdate,
  onHighlightDelete,
  showCitation = true
}) => {
  const itemRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isSyncing, setIsSyncing] = useState(() => isEventSyncing(highlight.id))
  const [isRebroadcasting, setIsRebroadcasting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  
  const activeAccount = Hooks.useActiveAccount()
  const navigate = useNavigate()
  
  // Resolve the profile of the user who made the highlight
  const profile = useEventModel(Models.ProfileModel, [highlight.pubkey])
  
  // Get display name for the user
  const getUserDisplayName = () => {
    return getProfileDisplayName(profile, highlight.pubkey)
  }
  
  
  // Listen to sync state changes
  useEffect(() => {
    const unsubscribe = onSyncStateChange((eventId, syncingState) => {
      if (eventId === highlight.id) {
        setIsSyncing(syncingState)
        // When sync completes successfully, update highlight to show all relays
        if (!syncingState) {
          // Update the highlight with all relays after successful sync
          if (onHighlightUpdate && highlight.isLocalOnly && relayPool) {
            const updatedHighlight = {
              ...highlight,
              publishedRelays: getActiveRelayUrls(relayPool),
              isLocalOnly: false,
              isOfflineCreated: false
            }
            onHighlightUpdate(updatedHighlight)
          }
        }
      }
    })
    
    return unsubscribe
  }, [highlight, onHighlightUpdate, relayPool])
  
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isSelected])
  
  // Close menu and reset delete confirm when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
        setShowDeleteConfirm(false)
      }
    }
    
    if (showMenu || showDeleteConfirm) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showMenu, showDeleteConfirm])
  
  const handleItemClick = () => {
    // If onHighlightClick is provided, use it (legacy behavior)
    if (onHighlightClick) {
      onHighlightClick(highlight.id)
      return
    }
    
    // Otherwise, navigate to the article that this highlight references
    if (highlight.eventReference) {
      // Parse the event reference - it can be an event ID or article coordinate (kind:pubkey:identifier)
      const parts = highlight.eventReference.split(':')
      
      // If it's an article coordinate (3 parts) and kind is 30023, navigate to it
      if (parts.length === 3) {
        const [kind, pubkey, identifier] = parts
        
        if (kind === '30023') {
          // Encode as naddr and navigate
          const naddr = nip19.naddrEncode({
            kind: 30023,
            pubkey,
            identifier
          })
          // Pass highlight ID in navigation state to trigger scroll
          navigate(`/a/${naddr}`, { 
            state: { 
              highlightId: highlight.id,
              openHighlights: true 
            } 
          })
        }
      }
    } else if (highlight.urlReference) {
      // Navigate to external URL with highlight ID to trigger scroll
      navigate(`/r/${encodeURIComponent(highlight.urlReference)}`, {
        state: {
          highlightId: highlight.id,
          openHighlights: true
        }
      })
    }
  }
  
  const getHighlightLinks = () => {
    // Encode the highlight event itself (kind 9802) as a nevent
    // Relay hint selection priority:
    // 1. Published relays (where we successfully published the event)
    // 2. Seen relays (where we observed the event)
    // 3. Configured content relays (deterministic fallback)
    // All candidates are deduplicated, filtered to content-capable remote relays, and limited to 3
    
    const publishedRelays = highlight.publishedRelays || []
    const seenOnRelays = highlight.seenOnRelays || []
    
    // Determine base candidates: prefer published, then seen, then configured relays
    let candidates: string[]
    if (publishedRelays.length > 0) {
      // Prefer published relays, but include seen relays as backup
      candidates = Array.from(new Set([...publishedRelays, ...seenOnRelays]))
        .sort((a, b) => a.localeCompare(b))
    } else if (seenOnRelays.length > 0) {
      candidates = seenOnRelays
    } else {
      // Fallback to deterministic configured content relays
      const contentRelays = getContentRelays()
      const fallbackRelays = getFallbackContentRelays()
      candidates = Array.from(new Set([...contentRelays, ...fallbackRelays]))
    }
    
    // Filter to content-capable remote relays (exclude local and non-content relays)
    // Then take up to 3 for relay hints
    const relayHints = candidates
      .filter(url => !isLocalRelay(url))
      .filter(url => isContentRelay(url))
      .slice(0, 3)
    
    const nevent = nip19.neventEncode({
      id: highlight.id,
      relays: relayHints,
      author: highlight.pubkey,
      kind: 9802
    })
    
    return {
      portal: getNostrUrl(nevent),
      native: `nostr:${nevent}`
    }
  }
  
  const highlightLinks = getHighlightLinks()
  
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
      const targetRelays = getActiveRelayUrls(relayPool)
      
      
      await relayPool.publish(targetRelays, event)
      
      
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
    
    // Check if this highlight was only published to local relays
    let isLocalOnly = highlight.isLocalOnly
    const publishedRelays = highlight.publishedRelays || []
    
    // Fallback 1: Check if this highlight was marked for offline sync (flight mode)
    if (isLocalOnly === undefined) {
      if (isEventOfflineCreated(highlight.id)) {
        isLocalOnly = true
      }
    }
    
    // Fallback 2: If publishedRelays only contains local relays, it's local-only
    if (isLocalOnly === undefined && publishedRelays.length > 0) {
      const hasOnlyLocalRelays = publishedRelays.every(url => isLocalRelay(url))
      const hasRemoteRelays = publishedRelays.some(url => !isLocalRelay(url))
      if (hasOnlyLocalRelays && !hasRemoteRelays) {
        isLocalOnly = true
      }
    }
    
    
    // If isLocalOnly is true (from any fallback), show airplane icon
    if (isLocalOnly === true) {
      return {
        icon: faPlane,
        tooltip: publishedRelays.length > 0
          ? 'Local relays only - will sync when remote relays available'
          : 'Created in flight mode - will sync when remote relays available',
        spin: false
      }
    }
    
    // Show highlighter icon with relay info if available
    if (highlight.publishedRelays && highlight.publishedRelays.length > 0) {
      const relayNames = highlight.publishedRelays.map(url => 
        url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
      )
      return {
        icon: faHighlighter,
        tooltip: relayNames.join('\n'),
        spin: false
      }
    }
    
    if (highlight.seenOnRelays && highlight.seenOnRelays.length > 0) {
      const relayNames = highlight.seenOnRelays.map(url => 
        url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
      )
      return {
        icon: faHighlighter,
        tooltip: relayNames.join('\n'),
        spin: false
      }
    }
    
    // Fallback: show all relays we queried (where this was likely fetched from)
    const activeRelays = relayPool ? getActiveRelayUrls(relayPool) : []
    const relayNames = activeRelays.map(url => 
      url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
    )
    return {
      icon: faHighlighter,
      tooltip: relayNames.join('\n'),
      spin: false
    }
  }
  
  const relayIndicator = getRelayIndicatorInfo()
  
  // Check if current user can delete this highlight
  const canDelete = activeAccount && highlight.pubkey === activeAccount.pubkey
  
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
  
  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Reset delete confirm state when opening/closing menu
    if (!showMenu) {
      setShowDeleteConfirm(false)
    }
    setShowMenu(!showMenu)
  }
  
  const handleOpenPortal = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(highlightLinks.portal, '_blank', 'noopener,noreferrer')
    setShowMenu(false)
  }

  const handleOpenNative = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.location.href = highlightLinks.native
    setShowMenu(false)
  }
  
  const handleMenuDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    setShowDeleteConfirm(true)
  }
  
  const handleConfirmDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleConfirmDelete()
  }
  
  return (
    <>
    <div 
      ref={itemRef} 
      className={`highlight-item ${isSelected ? 'selected' : ''} ${highlight.level ? `level-${highlight.level}` : ''}`} 
      data-highlight-id={highlight.id}
      onClick={handleItemClick}
      style={{ cursor: (onHighlightClick || highlight.eventReference || highlight.urlReference) ? 'pointer' : 'default' }}
    >
      <div className="highlight-header">
        <CompactButton
          className="highlight-timestamp"
          title={new Date(highlight.created_at * 1000).toLocaleString()}
          onClick={(e) => {
            e.stopPropagation()
            // Navigate within app using same logic as handleItemClick
            if (highlight.eventReference) {
              const parts = highlight.eventReference.split(':')
              if (parts.length === 3 && parts[0] === '30023') {
                const [, pubkey, identifier] = parts
                const naddr = nip19.naddrEncode({
                  kind: 30023,
                  pubkey,
                  identifier
                })
                navigate(`/a/${naddr}`, { 
                  state: { 
                    highlightId: highlight.id,
                    openHighlights: true 
                  } 
                })
              }
            } else if (highlight.urlReference) {
              navigate(`/r/${encodeURIComponent(highlight.urlReference)}`, {
                state: {
                  highlightId: highlight.id,
                  openHighlights: true
                }
              })
            }
          }}
        >
          {formatDateCompact(highlight.created_at)}
        </CompactButton>
      </div>
      
      <CompactButton
        className="highlight-quote-button"
        icon={faQuoteLeft}
        title="Quote"
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* relay indicator lives in footer for consistent padding/alignment */}
      
      <div className="highlight-content">
        <blockquote className="highlight-text">
          {highlight.content}
        </blockquote>
        
        {showCitation && (
          <HighlightCitation
            highlight={highlight}
            relayPool={relayPool}
          />
        )}
        
        {highlight.comment && (
          <div className="highlight-comment">
            <FontAwesomeIcon icon={faComments} flip="horizontal" className="highlight-comment-icon" />
            <div className="highlight-comment-text">
              <CommentContent text={highlight.comment} />
            </div>
          </div>
        )}
        
        
        <div className="highlight-footer">
          <div className="highlight-footer-left">
            {relayIndicator && (
              <CompactButton
                className="highlight-relay-indicator"
                icon={relayIndicator.icon}
                spin={relayIndicator.spin}
                title={relayIndicator.tooltip}
                onClick={handleRebroadcast}
                disabled={!relayPool || !eventStore}
              />
            )}
            
            <span className="highlight-author">
              {getUserDisplayName()}
            </span>
          </div>
          
          <div className="highlight-menu-wrapper" ref={menuRef}>
            {showDeleteConfirm && canDelete && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'rgb(220 38 38)', fontWeight: 500 }}>Confirm?</span>
                <button
                  onClick={handleConfirmDeleteClick}
                  disabled={isDeleting}
                  title="Confirm deletion"
                  style={{ 
                    color: 'rgb(220 38 38)',
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgb(220 38 38)',
                    borderRadius: '4px',
                    padding: '0.375rem',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '33px',
                    minHeight: '33px',
                    transition: 'all 0.2s'
                  }}
                >
                  <FontAwesomeIcon icon={isDeleting ? faSpinner : faTrash} spin={isDeleting} />
                </button>
              </div>
            )}
            
            <CompactButton
              icon={faEllipsisH}
              onClick={handleMenuToggle}
              title="More options"
            />
            
            {showMenu && (
              <div className="highlight-menu">
                <button
                  className="highlight-menu-item"
                  onClick={handleOpenPortal}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  <span>Open with njump</span>
                </button>
                <button
                  className="highlight-menu-item"
                  onClick={handleOpenNative}
                >
                  <FontAwesomeIcon icon={faMobileAlt} />
                  <span>Open with Native App</span>
                </button>
                {canDelete && (
                  <button
                    className="highlight-menu-item highlight-menu-item-danger"
                    onClick={handleMenuDeleteClick}
                    disabled={isDeleting}
                  >
                    <FontAwesomeIcon icon={isDeleting ? faSpinner : faTrash} spin={isDeleting} />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

