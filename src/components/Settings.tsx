import React, { useState, useEffect, useRef } from 'react'
import { faTimes, faUndo } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../services/settingsService'
import IconButton from './IconButton'
import { loadFont } from '../utils/fontLoader'
import ReadingDisplaySettings from './Settings/ReadingDisplaySettings'
import LayoutNavigationSettings from './Settings/LayoutNavigationSettings'
import StartupPreferencesSettings from './Settings/StartupPreferencesSettings'
import ZapSettings from './Settings/ZapSettings'

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
  defaultHighlightVisibilityNostrverse: true,
  defaultHighlightVisibilityFriends: true,
  defaultHighlightVisibilityMine: true,
  zapSplitPercentage: 50,
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
    fonts.forEach(font => {
      loadFont(font).catch(err => console.warn('Failed to preload font:', font, err))
    })
  }, [])

  useEffect(() => {
    const fontToLoad = localSettings.readingFont || 'source-serif-4'
    loadFont(fontToLoad).catch(err => console.warn('Failed to load preview font:', fontToLoad, err))
  }, [localSettings.readingFont])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    onSave(localSettings)
  }, [localSettings, onSave])

  const handleResetToDefaults = () => {
    if (confirm('Reset all settings to defaults?')) {
      setLocalSettings(DEFAULT_SETTINGS)
    }
  }

  const handleUpdate = (updates: Partial<UserSettings>) => {
    setLocalSettings({ ...localSettings, ...updates })
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
        <ReadingDisplaySettings settings={localSettings} onUpdate={handleUpdate} />
        <LayoutNavigationSettings settings={localSettings} onUpdate={handleUpdate} />
        <StartupPreferencesSettings settings={localSettings} onUpdate={handleUpdate} />
        <ZapSettings settings={localSettings} onUpdate={handleUpdate} />
      </div>
    </div>
  )
}

export default Settings
