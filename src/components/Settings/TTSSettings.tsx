import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGauge, faPlay, faPause } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import { useTextToSpeech } from '../../hooks/useTextToSpeech'
import { detect } from 'tinyld'

interface TTSSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const SPEED_OPTIONS = [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.1, 2.4, 2.8, 3]
const EXAMPLE_TEXT = "Welcome to Boris. Text-to-speech brings your highlights and articles to life. Adjust the playback speed and language settings to your preference."

const TTSSettings: React.FC<TTSSettingsProps> = ({ settings, onUpdate }) => {
  const currentSpeed = settings.ttsDefaultSpeed || 2.1
  const [isTestSpeaking, setIsTestSpeaking] = useState(false)
  
  const { supported, speaking, paused, speak, pause, resume, stop } = useTextToSpeech({ 
    defaultRate: currentSpeed 
  })

  const handleCycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(currentSpeed)
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length
    onUpdate({ ttsDefaultSpeed: SPEED_OPTIONS[nextIndex] })
  }

  const handleTestPlayPause = () => {
    if (!isTestSpeaking && !speaking) {
      let langOverride: string | undefined
      
      // Determine language based on settings
      const mode = settings?.ttsLanguageMode
      if (mode === 'system' || settings?.ttsUseSystemLanguage) {
        langOverride = navigator?.language?.split('-')[0]
      } else {
        try {
          const detected = detect(EXAMPLE_TEXT)
          if (typeof detected === 'string' && detected.length >= 2) {
            langOverride = detected.slice(0, 2)
          }
        } catch (err) {
          console.debug('[tts][detect] failed', err)
        }
      }
      
      setIsTestSpeaking(true)
      speak(EXAMPLE_TEXT, langOverride)
    } else if (paused) {
      resume()
    } else {
      pause()
    }
  }

  const handleStopTest = () => {
    stop()
    setIsTestSpeaking(false)
  }

  // Stop test speaking when settings change
  React.useEffect(() => {
    if (isTestSpeaking && !speaking) {
      setIsTestSpeaking(false)
    }
  }, [speaking, isTestSpeaking])

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

      {supported && (
        <div className="setting-group">
          <label>Test Example</label>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {EXAMPLE_TEXT}
          </div>
          <div className="setting-buttons">
            <button
              type="button"
              className="article-menu-btn"
              onClick={handleTestPlayPause}
              title={isTestSpeaking ? (paused ? 'Resume' : 'Pause') : 'Play'}
            >
              <FontAwesomeIcon icon={isTestSpeaking && !paused ? faPause : faPlay} />
              <span>{isTestSpeaking ? (paused ? 'Resume' : 'Pause') : 'Play'}</span>
            </button>
            {isTestSpeaking && (
              <button
                type="button"
                className="article-menu-btn"
                onClick={handleStopTest}
                title="Stop"
                style={{ color: 'var(--color-text)' }}
              >
                ⏹
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TTSSettings
