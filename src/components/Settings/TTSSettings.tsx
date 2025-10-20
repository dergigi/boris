import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGauge } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'

interface TTSSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const SPEED_OPTIONS = [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.1, 2.4, 2.8, 3]

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
    </div>
  )
}

export default TTSSettings
