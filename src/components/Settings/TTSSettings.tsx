import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGauge } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import TTSControls from '../TTSControls'

interface TTSSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const SPEED_OPTIONS = [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.1, 2.4, 2.8, 3]
const EXAMPLE_TEXT = "Boris aims to be a calm reader app with clean typography, beautiful design, and a focus on readability. Boris does not and will never have ads, trackers, paywalls, subscriptions, or any other distractions."

const TTSSettings: React.FC<TTSSettingsProps> = ({ settings, onUpdate }) => {
  const currentSpeed = settings.ttsDefaultSpeed || 2.1

  const handleCycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(currentSpeed)
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length
    onUpdate({ ttsDefaultSpeed: SPEED_OPTIONS[nextIndex] })
  }

  return (
    <div className="settings-section">
      <h3 className="section-title">Text-to-Speech</h3>
      
      <div className="setting-group setting-inline">
        <label>Default Playback Speed</label>
        <div className="setting-buttons">
          <button
            type="button"
            className="article-menu-btn"
            onClick={handleCycleSpeed}
            title="Cycle speed"
          >
            <FontAwesomeIcon icon={faGauge} />
            <span>{currentSpeed}x</span>
          </button>
        </div>
      </div>

      <div className="setting-group setting-inline">
        <label>Speaker language</label>
        <div className="setting-control">
          <select
            value={settings.ttsLanguageMode || 'content'}
            onChange={e => onUpdate({ ttsLanguageMode: (e.target.value as 'system' | 'content'), ttsUseSystemLanguage: e.target.value === 'system', ttsDetectContentLanguage: e.target.value !== 'system' })}
            className="setting-select"
          >
            <option value="system">System Language</option>
            <option value="content">Content (auto-detect)</option>
          </select>
        </div>
      </div>

      <div className="setting-group">
        <label>Test Example</label>
        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
          {EXAMPLE_TEXT}
        </div>
        <TTSControls text={EXAMPLE_TEXT} settings={settings} />
      </div>
    </div>
  )
}

export default TTSSettings
