import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import { getImageCacheStats, clearImageCache } from '../../services/imageCacheService'
import IconButton from '../IconButton'

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
                value={settings.imageCacheSizeMB ?? 50}
                onChange={(e) => onUpdate({ imageCacheSizeMB: parseInt(e.target.value) || 50 })}
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

