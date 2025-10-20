import React from 'react'
import { useTextToSpeech } from '../hooks/useTextToSpeech'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faPause, faGauge } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../services/settingsService'

interface Props {
  text: string
  defaultLang?: string
  className?: string
  settings?: UserSettings
}

const SPEED_OPTIONS = [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.1, 2.4, 2.8, 3]

const TTSControls: React.FC<Props> = ({ text, defaultLang, className, settings }) => {
  const {
    supported, speaking, paused,
    speak, pause, resume, stop,
    rate, setRate
  } = useTextToSpeech({ defaultLang, defaultRate: settings?.ttsDefaultSpeed })

  const canPlay = supported && text?.trim().length > 0

  const handlePlayPause = () => {
    if (!canPlay) return
    if (!speaking) {
      speak(text, defaultLang)
    } else if (paused) {
      resume()
    } else {
      pause()
    }
  }

  const handleCycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(rate)
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length
    setRate(SPEED_OPTIONS[nextIndex])
  }

  const playLabel = !speaking ? 'Listen' : (paused ? 'Resume' : 'Pause')

  if (!supported) return null

  return (
    <div className={className || 'tts-controls'} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <button
        type="button"
        className="article-menu-btn"
        onClick={handlePlayPause}
        title={playLabel}
        disabled={!canPlay}
      >
        <FontAwesomeIcon icon={!speaking ? faPlay : (paused ? faPlay : faPause)} />
        <span>{playLabel}</span>
      </button>
      <button
        type="button"
        className="article-menu-btn"
        onClick={handleCycleSpeed}
        title="Cycle speed"
      >
        <FontAwesomeIcon icon={faGauge} />
        <span>{rate}x</span>
      </button>
    </div>
  )
}

export default TTSControls

