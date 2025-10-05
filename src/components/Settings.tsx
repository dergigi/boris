import React, { useState, useEffect, useRef } from 'react'
import { faTimes, faList, faThLarge, faImage } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../services/settingsService'
import IconButton from './IconButton'
import { loadFont, getFontFamily } from '../utils/fontLoader'

interface SettingsProps {
  settings: UserSettings
  onSave: (settings: UserSettings) => Promise<void>
  onClose: () => void
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings)
  const isInitialMount = useRef(true)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  useEffect(() => {
    // Preload all fonts for the dropdown
    const fonts = ['inter', 'lora', 'merriweather', 'open-sans', 'roboto', 'source-serif-4', 'crimson-text', 'libre-baskerville', 'pt-serif']
    fonts.forEach(font => loadFont(font))
  }, [])

  useEffect(() => {
    // Load font for preview when it changes
    if (localSettings.readingFont) {
      loadFont(localSettings.readingFont)
    }
  }, [localSettings.readingFont])

  // Auto-save settings whenever they change (except on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    
    onSave(localSettings)
  }, [localSettings, onSave])

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
            
            <div className="setting-group setting-inline">
              <label htmlFor="readingFont">Reading Font</label>
              <select
                id="readingFont"
                value={localSettings.readingFont || 'system'}
                onChange={(e) => setLocalSettings({ ...localSettings, readingFont: e.target.value })}
                className="setting-select font-select"
              >
                <option value="system" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>System Default</option>
                <option value="inter" style={{ fontFamily: 'Inter, sans-serif' }}>Inter</option>
                <option value="lora" style={{ fontFamily: 'Lora, serif' }}>Lora</option>
                <option value="merriweather" style={{ fontFamily: 'Merriweather, serif' }}>Merriweather</option>
                <option value="open-sans" style={{ fontFamily: 'Open Sans, sans-serif' }}>Open Sans</option>
                <option value="roboto" style={{ fontFamily: 'Roboto, sans-serif' }}>Roboto</option>
                <option value="source-serif-4" style={{ fontFamily: 'Source Serif 4, serif' }}>Source Serif 4</option>
                <option value="crimson-text" style={{ fontFamily: 'Crimson Text, serif' }}>Crimson Text</option>
                <option value="libre-baskerville" style={{ fontFamily: 'Libre Baskerville, serif' }}>Libre Baskerville</option>
                <option value="pt-serif" style={{ fontFamily: 'PT Serif, serif' }}>PT Serif</option>
              </select>
            </div>

            <div className="setting-group setting-inline">
              <label>Font Size</label>
              <div className="setting-buttons">
                {[14, 16, 18, 20, 22].map(size => (
                  <button
                    key={size}
                    onClick={() => setLocalSettings({ ...localSettings, fontSize: size })}
                    className={`font-size-btn ${(localSettings.fontSize || 16) === size ? 'active' : ''}`}
                    title={`${size}px`}
                    style={{ fontSize: `${size - 2}px` }}
                  >
                    A
                  </button>
                ))}
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
                <span>Show highlights</span>
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
    </div>
  )
}

export default Settings
