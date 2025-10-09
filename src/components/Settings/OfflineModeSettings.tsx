import React from 'react'
import { useNavigate } from 'react-router-dom'
import { UserSettings } from '../../services/settingsService'

interface OfflineModeSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
  onClose?: () => void
}

const OfflineModeSettings: React.FC<OfflineModeSettingsProps> = ({ settings, onUpdate, onClose }) => {
  const navigate = useNavigate()

  const handleLinkClick = (url: string) => {
    if (onClose) onClose()
    navigate(`/r/${encodeURIComponent(url)}`)
  }

  return (
    <div className="settings-section">
      <h3 className="section-title">Offline Mode</h3>
      
      <div className="setting-group">
        <label htmlFor="useLocalRelayAsCache" className="checkbox-label">
          <input
            id="useLocalRelayAsCache"
            type="checkbox"
            checked={settings.useLocalRelayAsCache ?? true}
            onChange={(e) => onUpdate({ useLocalRelayAsCache: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Use local relays as cache</span>
        </label>
      </div>

      <div className="setting-group">
        <label htmlFor="rebroadcastToAllRelays" className="checkbox-label">
          <input
            id="rebroadcastToAllRelays"
            type="checkbox"
            checked={settings.rebroadcastToAllRelays ?? false}
            onChange={(e) => onUpdate({ rebroadcastToAllRelays: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Rebroadcast events to all relays</span>
        </label>
      </div>

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

export default OfflineModeSettings

