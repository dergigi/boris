import React from 'react'
import { useTextToSpeech } from '../hooks/useTextToSpeech'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faPause, faStop } from '@fortawesome/free-solid-svg-icons'

interface Props {
  text: string
  defaultLang?: string
  className?: string
}

const TTSControls: React.FC<Props> = ({ text, defaultLang, className }) => {
  const {
    supported, speaking, paused,
    speak, pause, resume, stop,
    rate, setRate
  } = useTextToSpeech({ defaultLang })

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
        style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
      >
        <FontAwesomeIcon icon={!speaking ? faPlay : (paused ? faPlay : faPause)} />
        <span style={{ marginLeft: 4, fontSize: '0.8rem' }}>{playLabel}</span>
      </button>
      <button
        type="button"
        className="article-menu-btn"
        onClick={stop}
        title="Stop"
        disabled={!speaking && !paused}
        style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
      >
        <FontAwesomeIcon icon={faStop} />
        <span style={{ marginLeft: 4, fontSize: '0.8rem' }}>Stop</span>
      </button>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#aaa', fontSize: '0.8rem' }}>
        Speed
        <select
          value={rate}
          onChange={e => setRate(Number(e.target.value))}
          style={{ background: 'transparent', color: 'inherit', border: '1px solid #444', borderRadius: 3, padding: '2px 4px', fontSize: '0.75rem' }}
        >
          <option value={0.8}>0.8x</option>
          <option value={1}>1x</option>
          <option value={1.2}>1.2x</option>
          <option value={1.4}>1.4x</option>
          <option value={1.6}>1.6x</option>
        </select>
      </label>
    </div>
  )
}

export default TTSControls

