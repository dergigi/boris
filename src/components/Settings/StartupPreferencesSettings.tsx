import React from 'react'
import { UserSettings } from '../../services/settingsService'

interface StartupPreferencesSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const StartupPreferencesSettings: React.FC<StartupPreferencesSettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="settings-section">
      <h3 className="section-title">Startup Preferences</h3>
      
      <div className="setting-group">
        <label htmlFor="sidebarCollapsed" className="checkbox-label">
          <input
            id="sidebarCollapsed"
            type="checkbox"
            checked={settings.sidebarCollapsed !== false}
            onChange={(e) => onUpdate({ sidebarCollapsed: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Start with bookmarks sidebar collapsed</span>
        </label>
      </div>

      <div className="setting-group">
        <label htmlFor="highlightsCollapsed" className="checkbox-label">
          <input
            id="highlightsCollapsed"
            type="checkbox"
            checked={settings.highlightsCollapsed !== false}
            onChange={(e) => onUpdate({ highlightsCollapsed: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Start with highlights panel collapsed</span>
        </label>
      </div>
    </div>
  )
}

export default StartupPreferencesSettings

