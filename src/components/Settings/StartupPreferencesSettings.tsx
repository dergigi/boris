import React from 'react'
import { faNetworkWired, faUserGroup, faUser } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import IconButton from '../IconButton'

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

      <div className="setting-group setting-inline">
        <label>Default Highlight Visibility</label>
        <div className="setting-buttons">
          <IconButton 
            icon={faNetworkWired} 
            onClick={() => onUpdate({ defaultHighlightVisibilityNostrverse: !(settings.defaultHighlightVisibilityNostrverse !== false) })} 
            title="Nostrverse highlights" 
            ariaLabel="Toggle nostrverse highlights by default" 
            variant={(settings.defaultHighlightVisibilityNostrverse !== false) ? 'primary' : 'ghost'} 
          />
          <IconButton 
            icon={faUserGroup} 
            onClick={() => onUpdate({ defaultHighlightVisibilityFriends: !(settings.defaultHighlightVisibilityFriends !== false) })} 
            title="Friends highlights" 
            ariaLabel="Toggle friends highlights by default" 
            variant={(settings.defaultHighlightVisibilityFriends !== false) ? 'primary' : 'ghost'} 
          />
          <IconButton 
            icon={faUser} 
            onClick={() => onUpdate({ defaultHighlightVisibilityMine: !(settings.defaultHighlightVisibilityMine !== false) })} 
            title="My highlights" 
            ariaLabel="Toggle my highlights by default" 
            variant={(settings.defaultHighlightVisibilityMine !== false) ? 'primary' : 'ghost'} 
          />
        </div>
      </div>
    </div>
  )
}

export default StartupPreferencesSettings

