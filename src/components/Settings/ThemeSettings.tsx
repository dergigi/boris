import React from 'react'
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import IconButton from '../IconButton'

interface ThemeSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ settings, onUpdate }) => {
  const currentTheme = settings.theme ?? 'system'

  return (
    <div className="settings-section">
      <h3 className="section-title">Theme</h3>
      
      <div className="setting-group setting-inline">
        <label>Appearance</label>
        <div className="setting-buttons">
          <IconButton 
            icon={faSun} 
            onClick={() => onUpdate({ theme: 'light' })} 
            title="Light theme" 
            ariaLabel="Light theme" 
            variant={currentTheme === 'light' ? 'primary' : 'ghost'} 
          />
          <IconButton 
            icon={faMoon} 
            onClick={() => onUpdate({ theme: 'dark' })} 
            title="Dark theme" 
            ariaLabel="Dark theme" 
            variant={currentTheme === 'dark' ? 'primary' : 'ghost'} 
          />
          <IconButton 
            icon={faDesktop} 
            onClick={() => onUpdate({ theme: 'system' })} 
            title="Use system preference" 
            ariaLabel="Use system preference" 
            variant={currentTheme === 'system' ? 'primary' : 'ghost'} 
          />
        </div>
      </div>
    </div>
  )
}

export default ThemeSettings

