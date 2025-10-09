import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheckCircle, faCircle, faClock } from '@fortawesome/free-solid-svg-icons'
import { RelayStatus } from '../../services/relayStatusService'
import { formatDistanceToNow } from 'date-fns'

interface RelaySettingsProps {
  relayStatuses: RelayStatus[]
}

const RelaySettings: React.FC<RelaySettingsProps> = ({ relayStatuses }) => {
  const activeRelays = relayStatuses.filter(r => r.isInPool)
  const recentRelays = relayStatuses.filter(r => !r.isInPool)

  const formatRelayUrl = (url: string) => {
    return url.replace(/^wss?:\/\//, '')
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
      
      <div className="relay-summary" style={{ marginBottom: '1rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {activeRelays.length} active relay{activeRelays.length !== 1 ? 's' : ''}
          {recentRelays.length > 0 && 
            ` · ${recentRelays.length} recently seen`
          }
        </p>
      </div>

      {activeRelays.length > 0 && (
        <div className="relay-group" style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ 
            fontSize: '0.85rem', 
            fontWeight: 600, 
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Active
          </h4>
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
                    textOverflow: 'ellipsis'
                  }}>
                    {formatRelayUrl(relay.url)}
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
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Recently Seen
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
                    color: 'var(--text-tertiary, #6b7280)',
                    fontSize: '0.7rem'
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

