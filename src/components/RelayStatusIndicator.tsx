import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlane, faGlobe, faCircle, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { RelayPool } from 'applesauce-relay'
import { useRelayStatus } from '../hooks/useRelayStatus'
import { isLocalRelay } from '../utils/helpers'

interface RelayStatusIndicatorProps {
  relayPool: RelayPool | null
}

export const RelayStatusIndicator: React.FC<RelayStatusIndicatorProps> = ({ relayPool }) => {
  // Poll frequently for responsive offline indicator (5s instead of default 20s)
  const relayStatuses = useRelayStatus({ relayPool, pollingInterval: 5000 })
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectingStartTime] = useState(Date.now())
  
  if (!relayPool) return null
  
  // Get currently connected relays
  const connectedRelays = relayStatuses.filter(r => r.isInPool)
  const connectedUrls = connectedRelays.map(r => r.url)
  
  // Determine connection status
  const hasLocalRelay = connectedUrls.some(url => isLocalRelay(url))
  const hasRemoteRelay = connectedUrls.some(url => !isLocalRelay(url))
  const localOnlyMode = hasLocalRelay && !hasRemoteRelay
  const offlineMode = connectedUrls.length === 0
  
  // Show "Connecting" for minimum duration (15s) to avoid flashing states
  useEffect(() => {
    const MIN_CONNECTING_DURATION = 15000 // 15 seconds minimum
    const elapsedTime = Date.now() - connectingStartTime
    
    if (connectedUrls.length > 0 && elapsedTime >= MIN_CONNECTING_DURATION) {
      // Connected and minimum time passed - stop showing connecting state
      setIsConnecting(false)
    } else if (connectedUrls.length > 0) {
      // Connected but haven't shown connecting long enough
      const remainingTime = MIN_CONNECTING_DURATION - elapsedTime
      const timeout = setTimeout(() => {
        setIsConnecting(false)
      }, remainingTime)
      return () => clearTimeout(timeout)
    } else if (elapsedTime >= MIN_CONNECTING_DURATION) {
      // No connections and minimum time passed - show offline
      setIsConnecting(false)
    }
    // If no connections and time hasn't passed, keep showing connecting
  }, [connectedUrls.length, connectingStartTime])
  
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
  }, [offlineMode, localOnlyMode, connectedUrls.length, relayStatuses.length, hasLocalRelay, hasRemoteRelay, isConnecting])
  
  // Don't show indicator when fully connected (but show when connecting)
  if (!localOnlyMode && !offlineMode && !isConnecting) return null
  
  return (
    <div className="relay-status-indicator" title={
      isConnecting
        ? 'Connecting to relays...'
        : offlineMode 
          ? 'Offline - No relays connected'
          : 'Local Relays Only - Highlights will be marked as local'
    }>
      <div className="relay-status-icon">
        <FontAwesomeIcon icon={isConnecting ? faSpinner : offlineMode ? faCircle : faPlane} spin={isConnecting} />
      </div>
      <div className="relay-status-text">
        {isConnecting ? (
          <span className="relay-status-title">Connecting</span>
        ) : offlineMode ? (
          <>
            <span className="relay-status-title">Offline</span>
            <span className="relay-status-subtitle">No relays connected</span>
          </>
        ) : (
          <>
            <span className="relay-status-title">Flight Mode</span>
            <span className="relay-status-subtitle">{connectedUrls.length} local relay{connectedUrls.length !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>
      {!offlineMode && !isConnecting && (
        <div className="relay-status-pulse">
          <FontAwesomeIcon icon={faGlobe} className="pulse-icon" />
        </div>
      )}
    </div>
  )
}

