import React, { useState, useEffect, useRef } from 'react'
import { faTimes, faList, faThLarge, faImage, faUnderline, faHighlighter, faUndo } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../services/settingsService'
import IconButton from './IconButton'
import ColorPicker from './ColorPicker'
import FontSelector from './FontSelector'
import { loadFont, getFontFamily } from '../utils/fontLoader'
import { hexToRgb } from '../utils/colorHelpers'

const DEFAULT_SETTINGS: UserSettings = {
  collapseOnArticleOpen: true,
  defaultViewMode: 'compact',
  showHighlights: true,
  sidebarCollapsed: true,
  highlightsCollapsed: true,
  readingFont: 'source-serif-4',
  fontSize: 18,
  highlightStyle: 'marker',
  highlightColor: '#ffff00',
  highlightColorNostrverse: '#9333ea',
  highlightColorFriends: '#f97316',
  highlightColorMine: '#ffff00',
}

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
    const fontToLoad = localSettings.readingFont || 'source-serif-4'
    loadFont(fontToLoad)
  }, [localSettings.readingFont])

  // Auto-save settings whenever they change (except on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    
    onSave(localSettings)
  }, [localSettings, onSave])

  const previewFontFamily = getFontFamily(localSettings.readingFont || 'source-serif-4')

  const handleResetToDefaults = () => {
    if (confirm('Reset all settings to defaults?')) {
      setLocalSettings(DEFAULT_SETTINGS)
    }
  }

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Settings</h2>
        <div className="settings-header-actions">
          <IconButton
            icon={faUndo}
            onClick={handleResetToDefaults}
            title="Reset to defaults"
            ariaLabel="Reset to defaults"
            variant="ghost"
          />
          <IconButton
            icon={faTimes}
            onClick={onClose}
            title="Close settings"
            ariaLabel="Close settings"
            variant="ghost"
          />
        </div>
      </div>

      <div className="settings-content">
          <div className="settings-section">
            <h3 className="section-title">Reading & Display</h3>
            
            <div className="setting-group setting-inline">
              <label htmlFor="readingFont">Reading Font</label>
              <FontSelector
                value={localSettings.readingFont || 'source-serif-4'}
                onChange={(font) => setLocalSettings({ ...localSettings, readingFont: font })}
              />
            </div>

            <div className="setting-group setting-inline">
              <label>Font Size</label>
              <div className="setting-buttons">
                {[14, 16, 18, 20, 22].map(size => (
                  <button
                    key={size}
                    onClick={() => setLocalSettings({ ...localSettings, fontSize: size })}
                    className={`font-size-btn ${(localSettings.fontSize || 18) === size ? 'active' : ''}`}
                    title={`${size}px`}
                    style={{ fontSize: `${size - 2}px` }}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="showHighlights" className="checkbox-label">
                <input
                  id="showHighlights"
                  type="checkbox"
                  checked={localSettings.showHighlights !== false}
                  onChange={(e) => setLocalSettings({ ...localSettings, showHighlights: e.target.checked })}
                  className="setting-checkbox"
                />
                <span>Show highlights</span>
              </label>
            </div>

            <div className="setting-group setting-inline">
              <label>Highlight Style</label>
              <div className="setting-buttons">
                <IconButton 
                  icon={faHighlighter} 
                  onClick={() => setLocalSettings({ ...localSettings, highlightStyle: 'marker' })} 
                  title="Text marker style" 
                  ariaLabel="Text marker style" 
                  variant={(localSettings.highlightStyle || 'marker') === 'marker' ? 'primary' : 'ghost'} 
                />
                <IconButton 
                  icon={faUnderline} 
                  onClick={() => setLocalSettings({ ...localSettings, highlightStyle: 'underline' })} 
                  title="Underline style" 
                  ariaLabel="Underline style" 
                  variant={localSettings.highlightStyle === 'underline' ? 'primary' : 'ghost'} 
                />
              </div>
            </div>


            <div className="setting-group setting-inline">
              <label className="setting-label">My Highlights</label>
              <div className="setting-control">
                <ColorPicker
                  selectedColor={localSettings.highlightColorMine || '#ffff00'}
                  onColorChange={(color) => setLocalSettings({ ...localSettings, highlightColorMine: color })}
                />
              </div>
            </div>

            <div className="setting-group setting-inline">
              <label className="setting-label">Friends Highlights</label>
              <div className="setting-control">
                <ColorPicker
                  selectedColor={localSettings.highlightColorFriends || '#f97316'}
                  onColorChange={(color) => setLocalSettings({ ...localSettings, highlightColorFriends: color })}
                />
              </div>
            </div>

            <div className="setting-group setting-inline">
              <label className="setting-label">Nostrverse Highlights</label>
              <div className="setting-control">
                <ColorPicker
                  selectedColor={localSettings.highlightColorNostrverse || '#9333ea'}
                  onColorChange={(color) => setLocalSettings({ ...localSettings, highlightColorNostrverse: color })}
                />
              </div>
            </div>

            <div className="setting-preview">
              <div className="preview-label">Preview</div>
              <div 
                className="preview-content" 
                style={{ 
                  fontFamily: previewFontFamily,
                  fontSize: `${localSettings.fontSize || 18}px`,
                  '--highlight-rgb': hexToRgb(localSettings.highlightColor || '#ffff00')
                } as React.CSSProperties}
              >
                <h3>The Quick Brown Fox</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. <span className={localSettings.showHighlights !== false ? `content-highlight-${localSettings.highlightStyle || 'marker'} level-mine` : ""}>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span> Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
                <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. <span className={localSettings.showHighlights !== false ? `content-highlight-${localSettings.highlightStyle || 'marker'} level-friends` : ""}>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</span> Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
                <p>Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. <span className={localSettings.showHighlights !== false ? `content-highlight-${localSettings.highlightStyle || 'marker'} level-nostrverse` : ""}>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</span> Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.</p>
                <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="section-title">Layout & Navigation</h3>
            
            <div className="setting-group setting-inline">
              <label>Default View Mode</label>
              <div className="setting-buttons">
                <IconButton icon={faList} onClick={() => setLocalSettings({ ...localSettings, defaultViewMode: 'compact' })} title="Compact list view" ariaLabel="Compact list view" variant={(localSettings.defaultViewMode || 'compact') === 'compact' ? 'primary' : 'ghost'} />
                <IconButton icon={faThLarge} onClick={() => setLocalSettings({ ...localSettings, defaultViewMode: 'cards' })} title="Cards view" ariaLabel="Cards view" variant={localSettings.defaultViewMode === 'cards' ? 'primary' : 'ghost'} />
                <IconButton icon={faImage} onClick={() => setLocalSettings({ ...localSettings, defaultViewMode: 'large' })} title="Large preview view" ariaLabel="Large preview view" variant={localSettings.defaultViewMode === 'large' ? 'primary' : 'ghost'} />
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
                  checked={localSettings.sidebarCollapsed !== false}
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
                  checked={localSettings.highlightsCollapsed !== false}
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
