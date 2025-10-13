import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlane, faGlobe, faCircle, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { RelayPool } from 'applesauce-relay'
import { useRelayStatus } from '../hooks/useRelayStatus'
import { isLocalRelay } from '../utils/helpers'
import { useIsMobile } from '../hooks/useMediaQuery'

interface RelayStatusIndicatorProps {
  relayPool: RelayPool | null
  showOnMobile?: boolean // Control visibility based on scroll
}

export const RelayStatusIndicator: React.FC<RelayStatusIndicatorProps> = ({ 
  relayPool,
  showOnMobile = true
}) => {
  // Poll frequently for responsive offline indicator (5s instead of default 20s)
  const relayStatuses = useRelayStatus({ relayPool, pollingInterval: 5000 })
  const [isConnecting, setIsConnecting] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const isMobile = useIsMobile()
  
  if (!relayPool) return null
  
  // Get currently connected relays
  const connectedRelays = relayStatuses.filter(r => r.isInPool)
  const connectedUrls = connectedRelays.map(r => r.url)
  
  // Determine connection status
  const hasLocalRelay = connectedUrls.some(url => isLocalRelay(url))
  const hasRemoteRelay = connectedUrls.some(url => !isLocalRelay(url))
  const localOnlyMode = hasLocalRelay && !hasRemoteRelay
  const offlineMode = connectedUrls.length === 0
  
  // Show "Connecting" for first few seconds or until relays connect
  useEffect(() => {
    if (connectedUrls.length > 0) {
      // Connected! Stop showing connecting state
      setIsConnecting(false)
    } else {
      // No connections yet - show connecting for 8 seconds
      setIsConnecting(true)
      const timeout = setTimeout(() => {
        setIsConnecting(false)
      }, 8000)
      return () => clearTimeout(timeout)
    }
  }, [connectedUrls.length])
  
  // Debug logging
  useEffect(() => {
    console.log('🔌 Relay Status Indicator:', {
      mode: isConnecting ? 'CONNECTING' : offlineMode ? 'OFFLINE' : localOnlyMode ? 'LOCAL_ONLY' : 'ONLINE',
      totalStatuses: relayStatuses.length,
      connectedCount: connectedUrls.length,
      connectedUrls: connectedUrls.map(u => u.replace(/^wss?:\/\//, '')),
      hasLocalRelay,
      hasRemoteRelay,
      isConnecting
    })
  }, [offlineMode, localOnlyMode, connectedUrls, relayStatuses.length, hasLocalRelay, hasRemoteRelay, isConnecting])
  
  // Don't show indicator when fully connected (but show when connecting)
  if (!localOnlyMode && !offlineMode && !isConnecting) return null
  
  const handleClick = () => {
    if (isMobile) {
      setIsExpanded(!isExpanded)
    }
  }

  const showDetails = !isMobile || isExpanded
  
  return (
    <div 
      className={`relay-status-indicator ${isConnecting ? 'connecting' : ''} ${isMobile ? 'mobile' : ''} ${isExpanded ? 'expanded' : ''} ${isMobile && !showOnMobile ? 'hidden' : 'visible'}`}
      title={
        !isMobile ? (
          isConnecting
            ? 'Connecting to relays...'
            : offlineMode 
              ? 'Offline - No relays connected'
              : 'Local Relays Only - Highlights will be marked as local'
        ) : undefined
      }
      onClick={handleClick}
      style={{ 
        position: 'fixed',
        bottom: '32px',
        left: '32px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: showDetails ? '0.75rem 1rem' : '0.75rem',
        backgroundColor: 'rgba(39, 39, 42, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgb(82, 82, 91)',
        borderRadius: '12px',
        color: 'rgb(228, 228, 231)',
        fontSize: '0.875rem',
        fontWeight: 500,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        cursor: isMobile ? 'pointer' : 'default',
        opacity: isMobile && !showOnMobile ? 0 : 1,
        visibility: isMobile && !showOnMobile ? 'hidden' : 'visible',
        transition: 'all 0.3s ease',
        userSelect: 'none'
      }}
    >
      <div className="relay-status-icon">
        <FontAwesomeIcon icon={isConnecting ? faSpinner : offlineMode ? faCircle : faPlane} spin={isConnecting} />
      </div>
      {showDetails && (
        <>
          <div 
            className="relay-status-text"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.125rem'
            }}
          >
            {isConnecting ? (
              <span className="relay-status-title">Connecting</span>
            ) : offlineMode ? (
              <>
                <span className="relay-status-title">Offline</span>
                <span 
                  className="relay-status-subtitle"
                  style={{
                    fontSize: '0.75rem',
                    opacity: 0.7,
                    fontWeight: 400
                  }}
                >
                  No relays connected
                </span>
              </>
            ) : (
              <>
                <span className="relay-status-title">Flight Mode</span>
                <span 
                  className="relay-status-subtitle"
                  style={{
                    fontSize: '0.75rem',
                    opacity: 0.7,
                    fontWeight: 400
                  }}
                >
                  {connectedUrls.length} local relay{connectedUrls.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          {!offlineMode && !isConnecting && (
            <div className="relay-status-pulse">
              <FontAwesomeIcon icon={faGlobe} className="pulse-icon" />
            </div>
          )}
        </>
      )}
    </div>
  )
}

