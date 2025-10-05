import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSave, faList, faThLarge, faImage } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../services/settingsService'
import IconButton from './IconButton'

interface SettingsProps {
  settings: UserSettings
  onSave: (settings: UserSettings) => Promise<void>
  onClose: () => void
  isSaving: boolean
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave, onClose, isSaving }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const handleSave = async () => {
    await onSave(localSettings)
  }

  return (
    <div className="settings-view">
      <div className="settings-header-bar">
        <h2>Settings</h2>
        <IconButton
          icon={faTimes}
          onClick={onClose}
          title="Close settings"
          ariaLabel="Close settings"
          variant="ghost"
        />
      </div>

      <div className="settings-content">
          <div className="setting-group">
            <label htmlFor="collapseOnArticleOpen" className="checkbox-label">
              <input
                id="collapseOnArticleOpen"
                type="checkbox"
                checked={localSettings.collapseOnArticleOpen !== false}
                onChange={(e) => setLocalSettings({ ...localSettings, collapseOnArticleOpen: e.target.checked })}
                className="setting-checkbox"
              />
              <span>Collapse bookmark bar when opening an article</span>
            </label>
          </div>

          <div className="setting-group">
            <label>Default View Mode</label>
            <div className="view-mode-controls">
              <IconButton
                icon={faList}
                onClick={() => setLocalSettings({ ...localSettings, defaultViewMode: 'compact' })}
                title="Compact list view"
                ariaLabel="Compact list view"
                variant={(localSettings.defaultViewMode || 'compact') === 'compact' ? 'primary' : 'ghost'}
              />
              <IconButton
                icon={faThLarge}
                onClick={() => setLocalSettings({ ...localSettings, defaultViewMode: 'cards' })}
                title="Cards view"
                ariaLabel="Cards view"
                variant={localSettings.defaultViewMode === 'cards' ? 'primary' : 'ghost'}
              />
              <IconButton
                icon={faImage}
                onClick={() => setLocalSettings({ ...localSettings, defaultViewMode: 'large' })}
                title="Large preview view"
                ariaLabel="Large preview view"
                variant={localSettings.defaultViewMode === 'large' ? 'primary' : 'ghost'}
              />
            </div>
          </div>

          <div className="setting-group">
            <label htmlFor="showUnderlines" className="checkbox-label">
              <input
                id="showUnderlines"
                type="checkbox"
                checked={localSettings.showUnderlines !== false}
                onChange={(e) => setLocalSettings({ ...localSettings, showUnderlines: e.target.checked })}
                className="setting-checkbox"
              />
              <span>Show highlight underlines</span>
            </label>
          </div>

          <div className="setting-group">
            <label htmlFor="sidebarCollapsed" className="checkbox-label">
              <input
                id="sidebarCollapsed"
                type="checkbox"
                checked={localSettings.sidebarCollapsed === true}
                onChange={(e) => setLocalSettings({ ...localSettings, sidebarCollapsed: e.target.checked })}
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
                checked={localSettings.highlightsCollapsed === true}
                onChange={(e) => setLocalSettings({ ...localSettings, highlightsCollapsed: e.target.checked })}
                className="setting-checkbox"
              />
              <span>Start with highlights panel collapsed</span>
            </label>
          </div>
      </div>

      <div className="settings-footer">
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          <FontAwesomeIcon icon={faSave} />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

export default Settings
