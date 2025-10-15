import React from 'react'
import { faDownload, faCheckCircle, faMobileAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { usePWAInstall } from '../../hooks/usePWAInstall'

const PWASettings: React.FC = () => {
  const { isInstallable, isInstalled, installApp } = usePWAInstall()

  const handleInstall = async () => {
    const success = await installApp()
    if (success) {
      console.log('App installed successfully')
    }
  }

  if (isInstalled) {
    return (
      <div className="settings-section">
        <h3 className="section-title">Boris as an App</h3>
        <div className="setting-item">
          <div className="setting-info">
            <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#22c55e', marginRight: '8px' }} />
            <span>Boris is installed as an app</span>
          </div>
          <p className="setting-description">
            You can launch Boris from your home screen or app drawer.
          </p>
        </div>
      </div>
    )
  }

  if (!isInstallable) {
    return null
  }

  return (
    <div className="settings-section">
      <h3 className="section-title">Boris as an App</h3>
      <div className="setting-group" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ flex: 1 }}>
          <div className="setting-info">
            <FontAwesomeIcon icon={faMobileAlt} style={{ marginRight: '8px' }} />
            <span>Install Boris as an app</span>
          </div>
          <p className="setting-description" style={{ marginTop: '0.5rem', marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Install Boris on your device for a native app experience with offline support.
          </p>
          <button
            onClick={handleInstall}
            className="zap-preset-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FontAwesomeIcon icon={faDownload} />
            Install App
          </button>
        </div>
        <img 
          src="/pwa.svg" 
          alt="Progressive Web App" 
          style={{ width: '120px', height: 'auto', flexShrink: 0, opacity: 0.8 }}
        />
      </div>
    </div>
  )
}

export default PWASettings

