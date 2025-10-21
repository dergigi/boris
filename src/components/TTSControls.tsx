import React, { useMemo } from 'react'
import { useTextToSpeech } from '../hooks/useTextToSpeech'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faPause, faGauge } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../services/settingsService'
import { detect } from 'tinyld'

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
    speak, pause, resume,
    rate, setRate
  } = useTextToSpeech({ defaultLang, defaultRate: settings?.ttsDefaultSpeed })

  const canPlay = supported && text?.trim().length > 0

  const resolvedSystemLang = useMemo(() => {
    const mode = settings?.ttsLanguageMode
    if ((mode ? mode === 'system' : settings?.ttsUseSystemLanguage) === true) {
      return navigator?.language?.split('-')[0]
    }
    return undefined
  }, [settings?.ttsLanguageMode, settings?.ttsUseSystemLanguage])

  const detectContentLang = useMemo(() => {
    const mode = settings?.ttsLanguageMode
    if (mode) return mode === 'content'
    return settings?.ttsDetectContentLanguage !== false
  }, [settings?.ttsLanguageMode, settings?.ttsDetectContentLanguage])

  const specificLang = useMemo(() => {
    const mode = settings?.ttsLanguageMode
    // If mode is not 'system' or 'content', it's a specific language code
    if (mode && mode !== 'system' && mode !== 'content') {
      return mode
    }
    return undefined
  }, [settings?.ttsLanguageMode])

  const handlePlayPause = () => {
    if (!canPlay) return

    if (!speaking) {
      let langOverride: string | undefined
      
      // Priority: specific language > content detection > system language
      if (specificLang) {
        langOverride = specificLang
      } else if (detectContentLang && text) {
        try {
          const lang = detect(text)
          if (typeof lang === 'string' && lang.length >= 2) langOverride = lang.slice(0, 2)
        } catch (err) {
          // ignore detection errors
        }
      }
      if (!langOverride && resolvedSystemLang) {
        langOverride = resolvedSystemLang
      }
      speak(text, langOverride)
    } else if (paused) {
      resume()
    } else {
      pause()
    }
  }

  const handleCycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(rate)
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length
    const next = SPEED_OPTIONS[nextIndex]
    setRate(next)
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

