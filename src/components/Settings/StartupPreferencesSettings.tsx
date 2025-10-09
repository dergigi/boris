import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faNetworkWired, faUserGroup, faUser } from '@fortawesome/free-solid-svg-icons'
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

      <div className="setting-group setting-inline">
        <label>Default Highlight Visibility</label>
        <div className="highlight-level-toggles">
          <button
            onClick={() => onUpdate({ defaultHighlightVisibilityNostrverse: !(settings.defaultHighlightVisibilityNostrverse !== false) })}
            className={`level-toggle-btn ${(settings.defaultHighlightVisibilityNostrverse !== false) ? 'active' : ''}`}
            title="Nostrverse highlights"
            aria-label="Toggle nostrverse highlights by default"
            style={{ color: (settings.defaultHighlightVisibilityNostrverse !== false) ? 'var(--highlight-color-nostrverse, #9333ea)' : undefined }}
          >
            <FontAwesomeIcon icon={faNetworkWired} />
          </button>
          <button
            onClick={() => onUpdate({ defaultHighlightVisibilityFriends: !(settings.defaultHighlightVisibilityFriends !== false) })}
            className={`level-toggle-btn ${(settings.defaultHighlightVisibilityFriends !== false) ? 'active' : ''}`}
            title="Friends highlights"
            aria-label="Toggle friends highlights by default"
            style={{ color: (settings.defaultHighlightVisibilityFriends !== false) ? 'var(--highlight-color-friends, #f97316)' : undefined }}
          >
            <FontAwesomeIcon icon={faUserGroup} />
          </button>
          <button
            onClick={() => onUpdate({ defaultHighlightVisibilityMine: !(settings.defaultHighlightVisibilityMine !== false) })}
            className={`level-toggle-btn ${(settings.defaultHighlightVisibilityMine !== false) ? 'active' : ''}`}
            title="My highlights"
            aria-label="Toggle my highlights by default"
            style={{ color: (settings.defaultHighlightVisibilityMine !== false) ? 'var(--highlight-color-mine, #eab308)' : undefined }}
          >
            <FontAwesomeIcon icon={faUser} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default StartupPreferencesSettings

