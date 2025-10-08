import React from 'react'
import { UserSettings } from '../../services/settingsService'

interface ZapSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const ZapSettings: React.FC<ZapSettingsProps> = ({ settings, onUpdate }) => {
  const highlighterPercentage = settings.zapSplitPercentage ?? 50
  const borisPercentage = settings.borisSupportPercentage ?? 2.1
  const authorPercentage = Math.max(0, 100 - highlighterPercentage - borisPercentage)

  return (
    <div className="settings-section">
      <h3 className="section-title">Zap Splits</h3>
      
      <div className="setting-group">
        <label className="setting-label">Split Percentage for Highlights</label>
        <div className="zap-split-container">
          <div className="zap-split-labels">
            <span className="zap-split-label">You: {highlighterPercentage}%</span>
            <span className="zap-split-label">Author(s): {authorPercentage.toFixed(1)}%</span>
            <span className="zap-split-label">Boris: {borisPercentage}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={highlighterPercentage}
            onChange={(e) => onUpdate({ zapSplitPercentage: parseInt(e.target.value) })}
            className="zap-split-slider"
          />
          <div className="zap-split-description">
            When you highlight nostr-native content, zaps will be split between you (curator) and the author(s). 
            If the content has multiple authors, their share is divided proportionally.
          </div>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">Support Boris</label>
        <div className="zap-split-container">
          <div className="zap-split-labels">
            <span className="zap-split-label">{borisPercentage.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={borisPercentage}
            onChange={(e) => onUpdate({ borisSupportPercentage: parseFloat(e.target.value) })}
            className="zap-split-slider"
          />
          <div className="zap-split-description">
            Optional: Include a small percentage for Boris development and maintenance.
          </div>
        </div>
      </div>
    </div>
  )
}

export default ZapSettings

