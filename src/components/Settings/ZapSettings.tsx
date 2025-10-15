import React from 'react'
import { UserSettings } from '../../services/settingsService'
import { useIsMobile } from '../../hooks/useMediaQuery'

interface ZapSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const ZapSettings: React.FC<ZapSettingsProps> = ({ settings, onUpdate }) => {
  const isMobile = useIsMobile()
  const highlighterWeight = settings.zapSplitHighlighterWeight ?? 50
  const borisWeight = settings.zapSplitBorisWeight ?? 2.1
  const authorWeight = settings.zapSplitAuthorWeight ?? 50
  
  // Calculate actual percentages from weights
  const totalWeight = highlighterWeight + borisWeight + authorWeight
  const highlighterPercentage = totalWeight > 0 ? (highlighterWeight / totalWeight) * 100 : 0
  const borisPercentage = totalWeight > 0 ? (borisWeight / totalWeight) * 100 : 0
  const authorPercentage = totalWeight > 0 ? (authorWeight / totalWeight) * 100 : 0

  const presets = {
    default: { highlighter: 50, boris: 2.1, author: 50 },
    generous: { highlighter: 5, boris: 10, author: 75 },
    selfless: { highlighter: 1, boris: 19, author: 80 },
    boris: { highlighter: 10, boris: 80, author: 10 },
  }

  const isPresetActive = (preset: { highlighter: number; boris: number; author: number }) => {
    return highlighterWeight === preset.highlighter &&
           borisWeight === preset.boris &&
           authorWeight === preset.author
  }

  const applyPreset = (preset: { highlighter: number; boris: number; author: number }) => {
    onUpdate({
      zapSplitHighlighterWeight: preset.highlighter,
      zapSplitBorisWeight: preset.boris,
      zapSplitAuthorWeight: preset.author,
    })
  }

  return (
    <div className="settings-section">
      <h3 className="section-title">Zap Splits</h3>
      
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'stretch' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div className="setting-group">
            <label className="setting-label">Presets</label>
            <div className="zap-preset-buttons">
              <button
                onClick={() => applyPreset(presets.default)}
                className={`zap-preset-btn ${isPresetActive(presets.default) ? 'active' : ''}`}
                title="You: 49%, Author: 49%, Boris: 2%"
              >
                Default
              </button>
              <button
                onClick={() => applyPreset(presets.generous)}
                className={`zap-preset-btn ${isPresetActive(presets.generous) ? 'active' : ''}`}
                title="You: 6%, Author: 83%, Boris: 11%"
              >
                Generous
              </button>
              <button
                onClick={() => applyPreset(presets.selfless)}
                className={`zap-preset-btn ${isPresetActive(presets.selfless) ? 'active' : ''}`}
                title="You: 1%, Author: 80%, Boris: 19%"
              >
                Selfless
              </button>
              <button
                onClick={() => applyPreset(presets.boris)}
                className={`zap-preset-btn ${isPresetActive(presets.boris) ? 'active' : ''}`}
                title="You: 10%, Author: 10%, Boris: 80%"
              >
                Boris 🧡
              </button>
            </div>
          </div>
          
          <div className="setting-group">
            <div className="zap-split-container">
              <div className="zap-split-labels">
                <span className="zap-split-label">Your Share: {highlighterWeight}</span>
                <span className="zap-split-label">({highlighterPercentage.toFixed(1)}%)</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={highlighterWeight}
                onChange={(e) => onUpdate({ zapSplitHighlighterWeight: parseInt(e.target.value) })}
                className="zap-split-slider"
                list="highlighter-ticks"
              />
              <datalist id="highlighter-ticks">
                <option value="50" label="50%"></option>
              </datalist>
            </div>
          </div>

          <div className="setting-group">
            <div className="zap-split-container">
              <div className="zap-split-labels">
                <span className="zap-split-label">Author's Share: {authorWeight}</span>
                <span className="zap-split-label">({authorPercentage.toFixed(1)}%)</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={authorWeight}
                onChange={(e) => onUpdate({ zapSplitAuthorWeight: parseInt(e.target.value) })}
                className="zap-split-slider"
                list="author-ticks"
              />
              <datalist id="author-ticks">
                <option value="50" label="50%"></option>
              </datalist>
            </div>
          </div>

          <div className="setting-group">
            <div className="zap-split-container">
              <div className="zap-split-labels">
                <span className="zap-split-label">Boris' Share: {borisWeight.toFixed(1)}</span>
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
                list="boris-ticks"
              />
              <datalist id="boris-ticks">
                <option value="5" label="5"></option>
              </datalist>
            </div>
          </div>

          <p className="setting-description" style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Weights determine zap splits when highlighting nostr-native content. 
            If the content has multiple authors, their share is divided proportionally.
          </p>
        </div>

        {!isMobile && (
          <img 
            src="/zaps.svg" 
            alt="Zap Splits" 
            style={{ width: '30%', height: 'auto', flexShrink: 0, opacity: 0.8 }}
          />
        )}
      </div>
    </div>
  )
}

export default ZapSettings

