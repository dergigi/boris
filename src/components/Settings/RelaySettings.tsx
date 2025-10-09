import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheckCircle, faCircle, faClock, faPlane } from '@fortawesome/free-solid-svg-icons'
import { RelayStatus } from '../../services/relayStatusService'
import { formatDistanceToNow } from 'date-fns'
import { isLocalRelay } from '../../utils/helpers'

interface RelaySettingsProps {
  relayStatuses: RelayStatus[]
  onClose?: () => void
}

const RelaySettings: React.FC<RelaySettingsProps> = ({ relayStatuses }) => {
  const formatRelayUrl = (url: string) => {
    return url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
  }

  const formatLastSeen = (timestamp: number) => {
    try {
      return formatDistanceToNow(timestamp, { addSuffix: true })
    } catch {
      return 'just now'
    }
  }

  // Sort relays: local relays first, then by connection status, then by URL
  const sortedRelays = [...relayStatuses].sort((a, b) => {
    const aIsLocal = isLocalRelay(a.url)
    const bIsLocal = isLocalRelay(b.url)
    
    // Local relays always first
    if (aIsLocal && !bIsLocal) return -1
    if (!aIsLocal && bIsLocal) return 1
    
    // Within local or remote groups, connected before disconnected
    if (a.isInPool !== b.isInPool) return a.isInPool ? -1 : 1
    
    // Finally sort by URL
    return a.url.localeCompare(b.url)
  })

  const getRelayIcon = (relay: RelayStatus) => {
    const isLocal = isLocalRelay(relay.url)
    const isConnected = relay.isInPool
    
    if (isLocal) {
      return {
        icon: faPlane,
        color: isConnected ? '#22c55e' : '#ef4444',
        size: '1rem'
      }
    } else {
      if (isConnected) {
        return {
          icon: faCheckCircle,
          color: '#22c55e',
          size: '1rem'
        }
      } else {
        return {
          icon: faCircle,
          color: '#ef4444',
          size: '0.7rem'
        }
      }
    }
  }

  return (
    <div className="settings-section">
      <h3>Relays</h3>

      {sortedRelays.length > 0 && (
        <div className="relay-group">
          <div className="relay-list">
            {sortedRelays.map((relay) => {
              const iconConfig = getRelayIcon(relay)
              const isDisconnected = !relay.isInPool
              
              return (
                <div 
                  key={relay.url} 
                  className="relay-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: 'var(--surface-secondary)',
                    borderRadius: '6px',
                    marginBottom: '0.5rem',
                    opacity: isDisconnected ? 0.7 : 1
                  }}
                >
                  <FontAwesomeIcon 
                    icon={iconConfig.icon} 
                    style={{ 
                      color: iconConfig.color,
                      fontSize: iconConfig.size
                    }} 
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {formatRelayUrl(relay.url)}
                    </div>
                  </div>
                  {isDisconnected && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap'
                    }}>
                      <FontAwesomeIcon icon={faClock} />
                      {formatLastSeen(relay.lastSeen)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {relayStatuses.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          No relay connections found
        </p>
      )}
    </div>
  )
}

export default RelaySettings

