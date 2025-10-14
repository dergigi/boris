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
  const currentDarkColor = settings.darkColorTheme ?? 'midnight'
  const currentLightColor = settings.lightColorTheme ?? 'paper-white'
  
  // Determine which color picker to show based on current theme
  const showDarkColors = currentTheme === 'dark' || currentTheme === 'system'
  const showLightColors = currentTheme === 'light' || currentTheme === 'system'

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

      {showDarkColors && (
        <div className="setting-group setting-inline">
          <label>Dark Color Theme</label>
          <div className="setting-buttons">
            <button
              onClick={() => onUpdate({ darkColorTheme: 'black' })}
              className={`font-size-btn ${currentDarkColor === 'black' ? 'active' : ''}`}
              title="Black"
            >
              Black
            </button>
            <button
              onClick={() => onUpdate({ darkColorTheme: 'midnight' })}
              className={`font-size-btn ${currentDarkColor === 'midnight' ? 'active' : ''}`}
              title="Midnight"
            >
              Midnight
            </button>
            <button
              onClick={() => onUpdate({ darkColorTheme: 'charcoal' })}
              className={`font-size-btn ${currentDarkColor === 'charcoal' ? 'active' : ''}`}
              title="Charcoal"
            >
              Charcoal
            </button>
          </div>
        </div>
      )}

      {showLightColors && (
        <div className="setting-group setting-inline">
          <label>Light Color Theme</label>
          <div className="setting-buttons">
            <button
              onClick={() => onUpdate({ lightColorTheme: 'paper-white' })}
              className={`font-size-btn ${currentLightColor === 'paper-white' ? 'active' : ''}`}
              title="Paper White"
            >
              Paper
            </button>
            <button
              onClick={() => onUpdate({ lightColorTheme: 'sepia' })}
              className={`font-size-btn ${currentLightColor === 'sepia' ? 'active' : ''}`}
              title="Sepia"
            >
              Sepia
            </button>
            <button
              onClick={() => onUpdate({ lightColorTheme: 'ivory' })}
              className={`font-size-btn ${currentLightColor === 'ivory' ? 'active' : ''}`}
              title="Ivory"
            >
              Ivory
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ThemeSettings
