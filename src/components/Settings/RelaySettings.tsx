import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheckCircle, faCircle, faClock } from '@fortawesome/free-solid-svg-icons'
import { RelayStatus } from '../../services/relayStatusService'
import { formatDistanceToNow } from 'date-fns'

interface RelaySettingsProps {
  relayStatuses: RelayStatus[]
  onClose?: () => void
}

const RelaySettings: React.FC<RelaySettingsProps> = ({ relayStatuses, onClose }) => {
  const navigate = useNavigate()
  const activeRelays = relayStatuses.filter(r => r.isInPool)
  const recentRelays = relayStatuses.filter(r => !r.isInPool)

  const handleLinkClick = (url: string) => {
    if (onClose) onClose()
    navigate(`/r/${encodeURIComponent(url)}`)
  }

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

      <div style={{ 
        marginTop: '1.5rem', 
        padding: '1rem',
        background: 'var(--surface-secondary)',
        borderRadius: '6px',
        fontSize: '0.9rem',
        lineHeight: '1.6'
      }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Boris works best with a local relay. Consider running{' '}
          <a 
            href="https://github.com/greenart7c3/Citrine?tab=readme-ov-file#download" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'var(--accent, #8b5cf6)' }}
          >
            Citrine
          </a>
          {' or '}
          <a 
            href="https://github.com/CodyTseng/nostr-relay-tray/releases" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'var(--accent, #8b5cf6)' }}
          >
            nostr-relay-tray
          </a>
          . Don't know what relays are? Learn more{' '}
          <a 
            onClick={(e) => {
              e.preventDefault()
              handleLinkClick('https://nostr.how/en/relays')
            }}
            style={{ color: 'var(--accent, #8b5cf6)', cursor: 'pointer' }}
          >
            here
          </a>
          {' and '}
          <a 
            onClick={(e) => {
              e.preventDefault()
              handleLinkClick('https://davidebtc186.substack.com/p/the-importance-of-hosting-your-own')
            }}
            style={{ color: 'var(--accent, #8b5cf6)', cursor: 'pointer' }}
          >
            here
          </a>
          .
        </p>
      </div>
    </div>
  )
}

export default RelaySettings

