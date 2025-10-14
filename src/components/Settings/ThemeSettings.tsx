import React from 'react'
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import IconButton from '../IconButton'

type DarkColorTheme = 'black' | 'midnight' | 'charcoal'
type LightColorTheme = 'paper-white' | 'sepia' | 'ivory'

interface ThemeSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ settings, onUpdate }) => {
  const currentTheme = settings.theme ?? 'system'
  const currentDarkColor = settings.darkColorTheme ?? 'midnight'
  const currentLightColor = settings.lightColorTheme ?? 'sepia'
  
  // Determine which color picker to show based on current theme
  const showDarkColors = currentTheme === 'dark' || currentTheme === 'system'
  const showLightColors = currentTheme === 'light' || currentTheme === 'system'

  // Color definitions for swatches
  const darkColors = {
    black: '#000000',
    midnight: '#18181b',
    charcoal: '#1c1c1e'
  }

  const lightColors = {
    'paper-white': '#ffffff',
    sepia: '#f4f1ea',
    ivory: '#fffff0'
  }

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
          <label>Dark Theme</label>
          <div className="color-picker">
            {Object.entries(darkColors).map(([key, color]) => (
              <div
                key={key}
                className={`color-swatch ${currentDarkColor === key ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => onUpdate({ darkColorTheme: key as DarkColorTheme })}
                title={key.charAt(0).toUpperCase() + key.slice(1)}
              />
            ))}
          </div>
        </div>
      )}

      {showLightColors && (
        <div className="setting-group setting-inline">
          <label>Light Theme</label>
          <div className="color-picker">
            {Object.entries(lightColors).map(([key, color]) => (
              <div
                key={key}
                className={`color-swatch ${currentLightColor === key ? 'active' : ''}`}
                style={{ 
                  backgroundColor: color,
                  border: color === '#ffffff' ? '2px solid #e5e7eb' : '1px solid #e5e7eb'
                }}
                onClick={() => onUpdate({ lightColorTheme: key as LightColorTheme })}
                title={key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ThemeSettings
