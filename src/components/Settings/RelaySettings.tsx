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
  const activeRelays = relayStatuses.filter(r => r.isInPool)
  const recentRelays = relayStatuses.filter(r => !r.isInPool)

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

  return (
    <div className="settings-section">
      <h3>Relays</h3>

      {activeRelays.length > 0 && (
        <div className="relay-group" style={{ marginBottom: '1.5rem' }}>
          <div className="relay-list">
            {activeRelays.map((relay) => (
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
                  marginBottom: '0.5rem'
                }}
              >
                <FontAwesomeIcon 
                  icon={faCheckCircle} 
                  style={{ 
                    color: 'var(--success, #22c55e)',
                    fontSize: '1rem'
                  }} 
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    {formatRelayUrl(relay.url)}
                    {isLocalRelay(relay.url) && (
                      <span 
                        title="Local relay"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.15rem 0.4rem',
                          background: 'rgba(245, 158, 11, 0.15)',
                          borderRadius: '4px',
                          color: '#f59e0b',
                          fontSize: '0.75rem',
                          flexShrink: 0
                        }}
                      >
                        <FontAwesomeIcon icon={faPlane} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentRelays.length > 0 && (
        <div className="relay-group">
          <h4 style={{ 
            fontSize: '0.85rem', 
            fontWeight: 600, 
            color: '#ef4444',
            marginBottom: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Offline
          </h4>
          <div className="relay-list">
            {recentRelays.map((relay) => (
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
                  opacity: 0.7
                }}
              >
                <FontAwesomeIcon 
                  icon={faCircle} 
                  style={{ 
                    color: '#ef4444',
                    fontSize: '0.7rem'
                  }} 
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    {formatRelayUrl(relay.url)}
                    {isLocalRelay(relay.url) && (
                      <span 
                        title="Local relay"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.15rem 0.4rem',
                          background: 'rgba(245, 158, 11, 0.15)',
                          borderRadius: '4px',
                          color: '#f59e0b',
                          fontSize: '0.75rem',
                          flexShrink: 0
                        }}
                      >
                        <FontAwesomeIcon icon={faPlane} />
                      </span>
                    )}
                  </div>
                </div>
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
              </div>
            ))}
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

