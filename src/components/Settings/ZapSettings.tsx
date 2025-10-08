import React from 'react'
import { UserSettings } from '../../services/settingsService'

interface ZapSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const ZapSettings: React.FC<ZapSettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="settings-section">
      <h3 className="section-title">Zap Splits</h3>
      
      <div className="setting-group">
        <label className="setting-label">Split Percentage for Highlights</label>
        <div className="zap-split-container">
          <div className="zap-split-labels">
            <span className="zap-split-label">You: {settings.zapSplitPercentage ?? 50}%</span>
            <span className="zap-split-label">Author(s): {100 - (settings.zapSplitPercentage ?? 50)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.zapSplitPercentage ?? 50}
            onChange={(e) => onUpdate({ zapSplitPercentage: parseInt(e.target.value) })}
            className="zap-split-slider"
          />
          <div className="zap-split-description">
            When you highlight nostr-native content, zaps will be split between you (curator) and the author(s). 
            If the content has multiple authors, their share is divided proportionally.
          </div>
        </div>
      </div>
    </div>
  )
}

export default ZapSettings

