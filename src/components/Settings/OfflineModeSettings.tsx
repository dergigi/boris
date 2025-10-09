import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import { getImageCacheStats, clearImageCache } from '../../services/imageCacheService'

interface OfflineModeSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
  onClose?: () => void
}

const OfflineModeSettings: React.FC<OfflineModeSettingsProps> = ({ settings, onUpdate, onClose }) => {
  const navigate = useNavigate()
  const [cacheStats, setCacheStats] = useState(getImageCacheStats())

  const handleLinkClick = (url: string) => {
    if (onClose) onClose()
    navigate(`/r/${encodeURIComponent(url)}`)
  }

  const handleClearCache = () => {
    if (confirm('Are you sure you want to clear all cached images?')) {
      clearImageCache()
      setCacheStats(getImageCacheStats())
    }
  }

  // Update cache stats when settings change
  useEffect(() => {
    const updateStats = () => setCacheStats(getImageCacheStats())
    const interval = setInterval(updateStats, 2000) // Update every 2 seconds
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="settings-section">
      <h3 className="section-title">Flight Mode</h3>
      
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

      <div className="setting-group">
        <label htmlFor="rebroadcastToAllRelays" className="checkbox-label">
          <input
            id="rebroadcastToAllRelays"
            type="checkbox"
            checked={settings.rebroadcastToAllRelays ?? false}
            onChange={(e) => onUpdate({ rebroadcastToAllRelays: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Rebroadcast events while browsing</span>
        </label>
      </div>

      <div className="setting-group">
        <label htmlFor="enableImageCache" className="checkbox-label">
          <input
            id="enableImageCache"
            type="checkbox"
            checked={settings.enableImageCache ?? true}
            onChange={(e) => onUpdate({ enableImageCache: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Cache images for offline viewing</span>
        </label>
      </div>

      {(settings.enableImageCache ?? true) && (
        <>
          <div className="setting-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label htmlFor="imageCacheSizeMB" style={{ marginBottom: 0 }}>
              <span>Max cache size (MB):</span>
            </label>
            <input
              id="imageCacheSizeMB"
              type="number"
              min="10"
              max="500"
              value={settings.imageCacheSizeMB ?? 50}
              onChange={(e) => onUpdate({ imageCacheSizeMB: parseInt(e.target.value) || 50 })}
              style={{
                width: '80px',
                padding: '0.25rem 0.5rem',
                background: 'var(--surface-secondary)',
                border: '1px solid var(--border-color, #333)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ 
            marginTop: '0.5rem',
            marginLeft: '1.75rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>
              Current: {cacheStats.totalSizeMB.toFixed(2)} MB ({cacheStats.itemCount} images)
            </span>
            <button
              onClick={handleClearCache}
              title="Clear cache"
              style={{
                padding: '0.25rem 0.5rem',
                background: 'transparent',
                color: 'var(--danger, #ef4444)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        </>
      )}

      <div style={{ 
        marginTop: '1.5rem', 
        padding: '1rem',
        background: 'var(--surface-secondary)',
        borderRadius: '6px',
        fontSize: '0.9rem',
        lineHeight: '1.6'
      }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Boris works best with a local relay. Consider running{' '}
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
          . Don't know what relays are? Learn more{' '}
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
      </div>
    </div>
  )
}

export default OfflineModeSettings

