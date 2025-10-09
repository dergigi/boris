import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlane, faGlobe, faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'

interface RelayRebroadcastSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const RelayRebroadcastSettings: React.FC<RelayRebroadcastSettingsProps> = ({
  settings,
  onUpdate
}) => {
  return (
    <div className="settings-section">
      <h3>Relay Rebroadcast</h3>
      
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
              Rebroadcast articles, bookmarks, and highlights to your local relays when fetched.
              Helps keep your data available offline.
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
              Rebroadcast articles, bookmarks, and highlights to all your relays.
              Helps propagate content across the nostr network.
            </div>
          </div>
        </label>
      </div>

      <div className="settings-info-box">
        <FontAwesomeIcon icon={faInfoCircle} style={{ marginRight: '0.5rem' }} />
        <div>
          <strong>Why rebroadcast?</strong> Rebroadcasting helps preserve content and makes it available 
          on more relays. Local caching ensures you can access your bookmarks and highlights even when offline.
        </div>
      </div>
    </div>
  )
}

export default RelayRebroadcastSettings

