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
        <h3>Progressive Web App</h3>
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
      <h3>Progressive Web App</h3>
      <div className="setting-item">
        <div className="setting-info">
          <FontAwesomeIcon icon={faMobileAlt} style={{ marginRight: '8px' }} />
          <span>Install Boris as an app</span>
        </div>
        <p className="setting-description">
          Install Boris on your device for a native app experience with offline support.
        </p>
        <button
          onClick={handleInstall}
          className="install-button"
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <FontAwesomeIcon icon={faDownload} />
          Install App
        </button>
      </div>
    </div>
  )
}

export default PWASettings

