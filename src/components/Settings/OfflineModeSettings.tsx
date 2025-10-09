import React from 'react'
import { UserSettings } from '../../services/settingsService'

interface OfflineModeSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const OfflineModeSettings: React.FC<OfflineModeSettingsProps> = ({ settings, onUpdate }) => {
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
          <span>Use local relay(s) as cache</span>
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
    </div>
  )
}

export default OfflineModeSettings

