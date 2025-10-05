import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSave, faList, faThLarge, faImage } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../services/settingsService'
import IconButton from './IconButton'
import { loadFont, getFontFamily } from '../utils/fontLoader'

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

  useEffect(() => {
    // Load font for preview when it changes
    if (localSettings.readingFont) {
      loadFont(localSettings.readingFont)
    }
  }, [localSettings.readingFont])

  const handleSave = async () => {
    await onSave(localSettings)
  }

  const previewFontFamily = getFontFamily(localSettings.readingFont)

  return (
    <div className="settings-view">
      <div className="settings-header">
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
          <div className="settings-section">
            <h3 className="section-title">Reading & Display</h3>
            
            <div className="setting-group">
              <label htmlFor="readingFont">Reading Font</label>
              <select
                id="readingFont"
                value={localSettings.readingFont || 'system'}
                onChange={(e) => setLocalSettings({ ...localSettings, readingFont: e.target.value })}
                className="setting-select"
              >
                <option value="system">System Default</option>
                <option value="inter">Inter</option>
                <option value="lora">Lora</option>
                <option value="merriweather">Merriweather</option>
                <option value="open-sans">Open Sans</option>
                <option value="roboto">Roboto</option>
                <option value="source-serif-4">Source Serif 4</option>
                <option value="crimson-text">Crimson Text</option>
                <option value="libre-baskerville">Libre Baskerville</option>
                <option value="pt-serif">PT Serif</option>
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="fontSize">Font Size</label>
              <select
                id="fontSize"
                value={localSettings.fontSize || 16}
                onChange={(e) => setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) })}
                className="setting-select"
              >
                <option value="12">12px (Very Small)</option>
                <option value="14">14px (Small)</option>
                <option value="16">16px (Medium)</option>
                <option value="18">18px (Large)</option>
                <option value="20">20px (Very Large)</option>
                <option value="22">22px (Extra Large)</option>
              </select>
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

            <div className="setting-preview">
              <div className="preview-label">Preview</div>
              <div 
                className="preview-content" 
                style={{ 
                  fontFamily: previewFontFamily,
                  fontSize: `${localSettings.fontSize || 16}px`
                }}
              >
                <h3>The Quick Brown Fox</h3>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. <span className={localSettings.showUnderlines !== false ? "content-highlight" : ""}>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span> Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
                <p>
                  Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="section-title">Layout & Navigation</h3>
            
            <div className="setting-group setting-inline">
              <label>Default View Mode</label>
              <div className="setting-buttons">
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
          </div>

          <div className="settings-section">
            <h3 className="section-title">Startup Preferences</h3>
            
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
