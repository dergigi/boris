import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { faDownload, faCheckCircle, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { usePWAInstall } from '../../hooks/usePWAInstall'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { UserSettings } from '../../services/settingsService'
import { getImageCacheStatsAsync, clearImageCache } from '../../services/imageCacheService'
import IconButton from '../IconButton'

interface PWASettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
  onClose?: () => void
}

const PWASettings: React.FC<PWASettingsProps> = ({ settings, onUpdate, onClose }) => {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { isInstallable, isInstalled, installApp } = usePWAInstall()
  const [cacheStats, setCacheStats] = useState<{
    totalSizeMB: number
    itemCount: number
    items: Array<{ url: string, sizeMB: number }>
  }>({ totalSizeMB: 0, itemCount: 0, items: [] })

  const handleInstall = async () => {
    if (isInstalled) return
    const success = await installApp()
    if (success) {
      console.log('App installed successfully')
    }
  }

  const handleLinkClick = (url: string) => {
    if (onClose) onClose()
    navigate(`/r/${encodeURIComponent(url)}`)
  }

  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear all cached images?')) {
      await clearImageCache()
      const stats = await getImageCacheStatsAsync()
      setCacheStats(stats)
    }
  }

  // Update cache stats periodically
  useEffect(() => {
    const updateStats = async () => {
      const stats = await getImageCacheStatsAsync()
      setCacheStats(stats)
    }
    
    updateStats() // Initial load
    const interval = setInterval(updateStats, 3000) // Update every 3 seconds
    return () => clearInterval(interval)
  }, [])

  if (!isInstallable && !isInstalled) {
    return null
  }

  return (
    <div className="settings-section">
      <h3 className="section-title">PWA & Flight Mode</h3>
      
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'stretch' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* PWA Install Section */}
          <div className="setting-group">
            <p className="setting-description" style={{ marginTop: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Install Boris on your device for a native app experience.
            </p>
            <p className="setting-description" style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              <strong>Note:</strong> Boris works best with a local relay. Consider running{' '}
              <a 
                href="https://github.com/greenart7c3/Citrine?tab=readme-ov-file#download" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'var(--accent, #8b5cf6)' }}
              >
                Citrine
              </a>
              {' or '}
              <a 
                href="https://github.com/CodyTseng/nostr-relay-tray/releases" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'var(--accent, #8b5cf6)' }}
              >
                nostr-relay-tray
              </a>
              {' '}to bring full offline functionality to Boris. Don't know what relays are? Learn more{' '}
              <a 
                onClick={(e) => {
                  e.preventDefault()
                  handleLinkClick('https://nostr.how/en/relays')
                }}
                style={{ color: 'var(--accent, #8b5cf6)', cursor: 'pointer' }}
              >
                here
              </a>
              {' and '}
              <a 
                onClick={(e) => {
                  e.preventDefault()
                  handleLinkClick('https://davidebtc186.substack.com/p/the-importance-of-hosting-your-own')
                }}
                style={{ color: 'var(--accent, #8b5cf6)', cursor: 'pointer' }}
              >
                here
              </a>
              .
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

          {/* Flight Mode Section */}
          <div className="setting-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <label htmlFor="enableImageCache" className="checkbox-label" style={{ marginBottom: 0 }}>
              <input
                id="enableImageCache"
                type="checkbox"
                checked={settings.enableImageCache ?? true}
                onChange={(e) => onUpdate({ enableImageCache: e.target.checked })}
                className="setting-checkbox"
              />
              <span>Use local image cache</span>
            </label>

            {(settings.enableImageCache ?? true) && (
              <div style={{ 
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  ( {cacheStats.totalSizeMB.toFixed(1)} MB / 
                  <input
                    id="imageCacheSizeMB"
                    type="number"
                    min="10"
                    max="500"
                    value={settings.imageCacheSizeMB ?? 210}
                    onChange={(e) => onUpdate({ imageCacheSizeMB: parseInt(e.target.value) || 210 })}
                    style={{
                      width: '50px',
                      padding: '0.15rem 0.35rem',
                      background: 'var(--surface-secondary)',
                      border: '1px solid var(--border-color, #333)',
                      borderRadius: '4px',
                      color: 'inherit',
                      fontSize: 'inherit',
                      fontFamily: 'inherit',
                      textAlign: 'center'
                    }}
                  />
                  MB used )
                </span>
                <IconButton
                  icon={faTrash}
                  onClick={handleClearCache}
                  title="Clear cache"
                  variant="ghost"
                  size={28}
                />
              </div>
            )}
          </div>

          <div className="setting-group">
            <label htmlFor="useLocalRelayAsCache" className="checkbox-label">
              <input
                id="useLocalRelayAsCache"
                type="checkbox"
                checked={settings.useLocalRelayAsCache ?? true}
                onChange={(e) => onUpdate({ useLocalRelayAsCache: e.target.checked })}
                className="setting-checkbox"
              />
              <span>Use local relays as cache</span>
            </label>
          </div>
        </div>

        {!isMobile && (
          <img 
            src="/pwa.svg" 
            alt="Progressive Web App" 
            style={{ width: '30%', height: 'auto', flexShrink: 0, opacity: 0.8 }}
          />
        )}
      </div>
    </div>
  )
}

export default PWASettings

