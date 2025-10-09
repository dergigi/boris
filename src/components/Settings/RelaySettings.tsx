import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheckCircle, faCircle, faClock, faPlane, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { RelayStatus } from '../../services/relayStatusService'
import { formatDistanceToNow } from 'date-fns'
import { isLocalRelay } from '../../utils/helpers'
import { UserSettings } from '../../services/settingsService'

interface RelaySettingsProps {
  relayStatuses: RelayStatus[]
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
  onClose?: () => void
}

const RelaySettings: React.FC<RelaySettingsProps> = ({ relayStatuses, settings, onUpdate, onClose }) => {
  const navigate = useNavigate()
  const activeRelays = relayStatuses.filter(r => r.isInPool)
  const recentRelays = relayStatuses.filter(r => !r.isInPool)

  const handleLinkClick = (url: string) => {
    if (onClose) onClose()
    navigate(`/r/${encodeURIComponent(url)}`)
  }

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

      <div className="settings-group">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={settings.useLocalRelayAsCache ?? true}
            onChange={(e) => onUpdate({ useLocalRelayAsCache: e.target.checked })}
          />
          <div className="settings-label-content">
            <div className="settings-label-title">
              <FontAwesomeIcon icon={faPlane} style={{ marginRight: '0.5rem', color: '#f59e0b' }} />
              Use local relay(s) as cache
            </div>
            <div className="settings-label-description">
              Rebroadcast articles, bookmarks, and highlights to your local relays when fetched
            </div>
          </div>
        </label>
      </div>

      <div className="settings-group">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={settings.rebroadcastToAllRelays ?? false}
            onChange={(e) => onUpdate({ rebroadcastToAllRelays: e.target.checked })}
          />
          <div className="settings-label-content">
            <div className="settings-label-title">
              <FontAwesomeIcon icon={faGlobe} style={{ marginRight: '0.5rem', color: '#646cff' }} />
              Rebroadcast events to all relays
            </div>
            <div className="settings-label-description">
              Rebroadcast articles, bookmarks, and highlights to all your relays to help propagate content
            </div>
          </div>
        </label>
      </div>

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

