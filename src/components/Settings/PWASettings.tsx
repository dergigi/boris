import React from 'react'
import { faDownload, faCheckCircle, faMobileAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { usePWAInstall } from '../../hooks/usePWAInstall'

const PWASettings: React.FC = () => {
  const { isInstallable, isInstalled, installApp } = usePWAInstall()

  const handleInstall = async () => {
    if (isInstalled) return
    const success = await installApp()
    if (success) {
      console.log('App installed successfully')
    }
  }

  if (!isInstallable && !isInstalled) {
    return null
  }

  return (
    <div className="settings-section">
      <h3 className="section-title">App</h3>
      <div className="setting-group" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ flex: 1 }}>
          <div className="setting-info">
            <FontAwesomeIcon icon={faMobileAlt} style={{ marginRight: '8px' }} />
            <span>Install Boris as a PWA</span>
          </div>
          <p className="setting-description" style={{ marginTop: '0.5rem', marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Install Boris on your device for a native app experience with offline support.
          </p>
          <button
            onClick={handleInstall}
            className="zap-preset-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={isInstalled}
          >
            <FontAwesomeIcon icon={isInstalled ? faCheckCircle : faDownload} />
            {isInstalled ? 'Installed' : 'Install App'}
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

