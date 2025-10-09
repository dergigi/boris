import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlane, faGlobe, faCircle } from '@fortawesome/free-solid-svg-icons'
import { RelayPool } from 'applesauce-relay'
import { useRelayStatus } from '../hooks/useRelayStatus'
import { isLocalRelay } from '../utils/helpers'

interface RelayStatusIndicatorProps {
  relayPool: RelayPool | null
}

export const RelayStatusIndicator: React.FC<RelayStatusIndicatorProps> = ({ relayPool }) => {
  // Poll frequently for responsive local-only detection
  const relayStatuses = useRelayStatus({ relayPool, pollingInterval: 2000 })
  
  if (!relayPool) return null
  
  // Get currently connected relays
  const connectedRelays = relayStatuses.filter(r => r.isInPool)
  const connectedUrls = connectedRelays.map(r => r.url)
  
  // Determine connection status
  const hasLocalRelay = connectedUrls.some(url => isLocalRelay(url))
  const hasRemoteRelay = connectedUrls.some(url => !isLocalRelay(url))
  const localOnlyMode = hasLocalRelay && !hasRemoteRelay
  const offlineMode = connectedUrls.length === 0
  
  // Debug logging
  React.useEffect(() => {
    if (localOnlyMode || offlineMode) {
      console.log('✈️ Relay Status Indicator:', {
        mode: offlineMode ? 'OFFLINE' : 'LOCAL_ONLY',
        connectedUrls,
        hasLocalRelay,
        hasRemoteRelay
      })
    }
  }, [localOnlyMode, offlineMode, connectedUrls.length])
  
  // Don't show indicator when fully connected
  if (!localOnlyMode && !offlineMode) return null
  
  return (
    <div className="relay-status-indicator" title={
      offlineMode 
        ? 'Offline - No relays connected'
        : 'Local Relays Only - Highlights will be marked as local'
    }>
      <div className="relay-status-icon">
        <FontAwesomeIcon icon={offlineMode ? faCircle : faPlane} />
      </div>
      <div className="relay-status-text">
        {offlineMode ? (
          <>
            <span className="relay-status-title">Offline</span>
            <span className="relay-status-subtitle">No relays connected</span>
          </>
        ) : (
          <>
            <span className="relay-status-title">Local Only</span>
            <span className="relay-status-subtitle">{connectedUrls.length} local relay{connectedUrls.length !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>
      {!offlineMode && (
        <div className="relay-status-pulse">
          <FontAwesomeIcon icon={faGlobe} className="pulse-icon" />
        </div>
      )}
    </div>
  )
}

