import React, { useState, useEffect, useRef } from 'react'
import { faTimes, faUndo } from '@fortawesome/free-solid-svg-icons'
import { RelayPool } from 'applesauce-relay'
import { UserSettings } from '../services/settingsService'
import IconButton from './IconButton'
import { loadFont } from '../utils/fontLoader'
import ReadingDisplaySettings from './Settings/ReadingDisplaySettings'
import LayoutNavigationSettings from './Settings/LayoutNavigationSettings'
import StartupPreferencesSettings from './Settings/StartupPreferencesSettings'
import ZapSettings from './Settings/ZapSettings'
import RelaySettings from './Settings/RelaySettings'
import { useRelayStatus } from '../hooks/useRelayStatus'

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
  zapSplitHighlighterWeight: 50,
  zapSplitBorisWeight: 2.1,
  zapSplitAuthorWeight: 50,
}

interface SettingsProps {
  settings: UserSettings
  onSave: (settings: UserSettings) => Promise<void>
  onClose: () => void
  relayPool: RelayPool | null
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave, onClose, relayPool }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(() => {
    // Migrate old settings format to new weight-based format
    const migrated = { ...settings }
    const anySettings = migrated as Record<string, unknown>
    if ('zapSplitPercentage' in anySettings && !('zapSplitHighlighterWeight' in migrated)) {
      migrated.zapSplitHighlighterWeight = (anySettings.zapSplitPercentage as number) ?? 50
      migrated.zapSplitAuthorWeight = 100 - ((anySettings.zapSplitPercentage as number) ?? 50)
    }
    if ('borisSupportPercentage' in anySettings && !('zapSplitBorisWeight' in migrated)) {
      migrated.zapSplitBorisWeight = (anySettings.borisSupportPercentage as number) ?? 2.1
    }
    return migrated
  })
  const isInitialMount = useRef(true)
  const saveTimeoutRef = useRef<number | null>(null)
  const isLocallyUpdating = useRef(false)
  
  const relayStatuses = useRelayStatus({ relayPool })

  useEffect(() => {
    // Don't update from external settings if we're currently making local changes
    if (isLocallyUpdating.current) {
      return
    }
    
    const migrated = { ...settings }
    const anySettings = migrated as Record<string, unknown>
    if ('zapSplitPercentage' in anySettings && !('zapSplitHighlighterWeight' in migrated)) {
      migrated.zapSplitHighlighterWeight = (anySettings.zapSplitPercentage as number) ?? 50
      migrated.zapSplitAuthorWeight = 100 - ((anySettings.zapSplitPercentage as number) ?? 50)
    }
    if ('borisSupportPercentage' in anySettings && !('zapSplitBorisWeight' in migrated)) {
      migrated.zapSplitBorisWeight = (anySettings.borisSupportPercentage as number) ?? 2.1
    }
    setLocalSettings(migrated)
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
    
    // Mark that we're making local updates
    isLocallyUpdating.current = true
    
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Debounce the save to avoid rapid updates
    saveTimeoutRef.current = setTimeout(() => {
      onSave(localSettings).finally(() => {
        // Allow external updates again after a short delay
        setTimeout(() => {
          isLocallyUpdating.current = false
        }, 500)
      })
    }, 300)
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
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
        <RelaySettings relayStatuses={relayStatuses} />
      </div>
    </div>
  )
}

export default Settings
