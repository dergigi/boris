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
            onChange={e => {
              const value = e.target.value
              onUpdate({ 
                ttsLanguageMode: value,
                ttsUseSystemLanguage: value === 'system',
                ttsDetectContentLanguage: value === 'content'
              })
            }}
            className="setting-select"
          >
            <option value="system">System Language</option>
            <option value="content">Content (auto-detect)</option>
            <option disabled>────────────</option>
            <option value="en">English</option>
            <option value="zh">Mandarin Chinese</option>
            <option value="es">Spanish</option>
            <option value="hi">Hindi</option>
            <option value="ar">Arabic</option>
            <option value="fr">French</option>
            <option value="pt">Portuguese</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
            <option value="ru">Russian</option>
          </select>
        </div>
      </div>

      <div className="setting-group">
        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
          {EXAMPLE_TEXT}
        </div>
        <TTSControls text={EXAMPLE_TEXT} settings={settings} />
      </div>
    </div>
  )
}

export default TTSSettings
