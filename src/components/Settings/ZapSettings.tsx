import React from 'react'
import { UserSettings } from '../../services/settingsService'

interface ZapSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const ZapSettings: React.FC<ZapSettingsProps> = ({ settings, onUpdate }) => {
  const highlighterWeight = settings.zapSplitHighlighterWeight ?? 50
  const borisWeight = settings.zapSplitBorisWeight ?? 2.1
  const authorWeight = settings.zapSplitAuthorWeight ?? 50
  
  // Calculate actual percentages from weights
  const totalWeight = highlighterWeight + borisWeight + authorWeight
  const highlighterPercentage = totalWeight > 0 ? (highlighterWeight / totalWeight) * 100 : 0
  const borisPercentage = totalWeight > 0 ? (borisWeight / totalWeight) * 100 : 0
  const authorPercentage = totalWeight > 0 ? (authorWeight / totalWeight) * 100 : 0

  return (
    <div className="settings-section">
      <h3 className="section-title">Zap Splits</h3>
      
      <div className="setting-group">
        <label className="setting-label">Your Share</label>
        <div className="zap-split-container">
          <div className="zap-split-labels">
            <span className="zap-split-label">Weight: {highlighterWeight}</span>
            <span className="zap-split-label">({highlighterPercentage.toFixed(1)}%)</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={highlighterWeight}
            onChange={(e) => onUpdate({ zapSplitHighlighterWeight: parseInt(e.target.value) })}
            className="zap-split-slider"
          />
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">Author(s) Share</label>
        <div className="zap-split-container">
          <div className="zap-split-labels">
            <span className="zap-split-label">Weight: {authorWeight}</span>
            <span className="zap-split-label">({authorPercentage.toFixed(1)}%)</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={authorWeight}
            onChange={(e) => onUpdate({ zapSplitAuthorWeight: parseInt(e.target.value) })}
            className="zap-split-slider"
          />
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">Support Boris</label>
        <div className="zap-split-container">
          <div className="zap-split-labels">
            <span className="zap-split-label">Weight: {borisWeight.toFixed(1)}</span>
            <span className="zap-split-label">({borisPercentage.toFixed(1)}%)</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={borisWeight}
            onChange={(e) => onUpdate({ zapSplitBorisWeight: parseFloat(e.target.value) })}
            className="zap-split-slider"
          />
        </div>
      </div>

      <div className="zap-split-description">
        Weights determine zap splits when highlighting nostr-native content. 
        If the content has multiple authors, their share is divided proportionally.
      </div>
    </div>
  )
}

export default ZapSettings

