import React, { useState, useEffect, useRef } from 'react'
import { faTimes, faUndo } from '@fortawesome/free-solid-svg-icons'
import { RelayPool } from 'applesauce-relay'
import { UserSettings } from '../services/settingsService'
import IconButton from './IconButton'
import { loadFont } from '../utils/fontLoader'
import ThemeSettings from './Settings/ThemeSettings'
import ReadingDisplaySettings from './Settings/ReadingDisplaySettings'
import MediaDisplaySettings from './Settings/MediaDisplaySettings'
import ExploreSettings from './Settings/ExploreSettings'
import LayoutBehaviorSettings from './Settings/LayoutBehaviorSettings'
import ZapSettings from './Settings/ZapSettings'
import RelaySettings from './Settings/RelaySettings'
import PWASettings from './Settings/PWASettings'
import TTSSettings from './Settings/TTSSettings'
import { useRelayStatus } from '../hooks/useRelayStatus'
import VersionFooter from './VersionFooter'

const DEFAULT_SETTINGS: UserSettings = {
  collapseOnArticleOpen: true,
  defaultViewMode: 'compact',
  showHighlights: true,
  sidebarCollapsed: true,
  highlightsCollapsed: true,
  readingFont: 'source-serif-4',
  fontSize: 21,
  highlightStyle: 'marker',
  highlightColor: '#fde047',
  highlightColorNostrverse: '#9333ea',
  highlightColorFriends: '#f97316',
  highlightColorMine: '#fde047',
  defaultHighlightVisibilityNostrverse: true,
  defaultHighlightVisibilityFriends: true,
  defaultHighlightVisibilityMine: true,
  defaultExploreScopeNostrverse: false,
  defaultExploreScopeFriends: true,
  defaultExploreScopeMine: false,
  zapSplitHighlighterWeight: 50,
  zapSplitBorisWeight: 2.1,
  zapSplitAuthorWeight: 50,
  useLocalRelayAsCache: true,
  rebroadcastToAllRelays: false,
  paragraphAlignment: 'justify',
  fullWidthImages: true,
  renderVideoLinksAsEmbeds: true,
  syncReadingPosition: true,
  autoMarkAsReadOnCompletion: false,
  hideBookmarksWithoutCreationDate: true,
  ttsDefaultSpeed: 2.1,
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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLocallyUpdating = useRef(false)
  
  // Poll for relay status updates
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
        <ThemeSettings settings={localSettings} onUpdate={handleUpdate} />
        <ReadingDisplaySettings settings={localSettings} onUpdate={handleUpdate} />
        <MediaDisplaySettings settings={localSettings} onUpdate={handleUpdate} />
        <ExploreSettings settings={localSettings} onUpdate={handleUpdate} />
        <ZapSettings settings={localSettings} onUpdate={handleUpdate} />
        <TTSSettings settings={localSettings} onUpdate={handleUpdate} />
        <LayoutBehaviorSettings settings={localSettings} onUpdate={handleUpdate} />
        <PWASettings settings={localSettings} onUpdate={handleUpdate} onClose={onClose} />
        <RelaySettings relayStatuses={relayStatuses} onClose={onClose} />
      </div>
      <VersionFooter />
    </div>
  )
}

export default Settings
