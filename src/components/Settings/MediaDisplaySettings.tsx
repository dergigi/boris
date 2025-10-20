import React from 'react'
import { UserSettings } from '../../services/settingsService'

interface MediaDisplaySettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const MediaDisplaySettings: React.FC<MediaDisplaySettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="settings-section">
      <h3 className="section-title">Media Display</h3>
      
      <div className="setting-group">
        <label htmlFor="fullWidthImages" className="checkbox-label">
          <input
            id="fullWidthImages"
            type="checkbox"
            checked={settings.fullWidthImages === true}
            onChange={(e) => onUpdate({ fullWidthImages: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Full-width images in articles</span>
        </label>
      </div>

      <div className="setting-group">
        <label htmlFor="renderVideoLinksAsEmbeds" className="checkbox-label">
          <input
            id="renderVideoLinksAsEmbeds"
            type="checkbox"
            checked={settings.renderVideoLinksAsEmbeds === true}
            onChange={(e) => onUpdate({ renderVideoLinksAsEmbeds: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Render video links as embeds</span>
        </label>
      </div>
    </div>
  )
}

export default MediaDisplaySettings
