import React from 'react'
import { UserSettings } from '../../services/settingsService'

interface TTSSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const SPEED_OPTIONS = [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.1, 2.4, 2.8, 3]

const TTSSettings: React.FC<TTSSettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="settings-section">
      <h3 className="section-title">Text-to-Speech</h3>
      
      <div className="setting-group setting-inline">
        <label htmlFor="ttsDefaultSpeed" className="setting-label">Default Playback Speed</label>
        <div className="setting-control">
          <div className="setting-buttons">
            {SPEED_OPTIONS.map(speed => (
              <button
                key={speed}
                onClick={() => onUpdate({ ttsDefaultSpeed: speed })}
                className={`speed-btn ${(settings.ttsDefaultSpeed || 2.1) === speed ? 'active' : ''}`}
                title={`${speed}x speed`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TTSSettings
