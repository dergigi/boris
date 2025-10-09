import React from 'react'
import { faList, faThLarge, faImage } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import IconButton from '../IconButton'

interface LayoutNavigationSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const LayoutNavigationSettings: React.FC<LayoutNavigationSettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="settings-section">
      <h3 className="section-title">Layout & Navigation</h3>
      
      <div className="setting-group setting-inline">
        <label>Default Bookmark View</label>
        <div className="setting-buttons">
          <IconButton 
            icon={faList} 
            onClick={() => onUpdate({ defaultViewMode: 'compact' })} 
            title="Compact list view" 
            ariaLabel="Compact list view" 
            variant={(settings.defaultViewMode || 'compact') === 'compact' ? 'primary' : 'ghost'} 
          />
          <IconButton 
            icon={faThLarge} 
            onClick={() => onUpdate({ defaultViewMode: 'cards' })} 
            title="Cards view" 
            ariaLabel="Cards view" 
            variant={settings.defaultViewMode === 'cards' ? 'primary' : 'ghost'} 
          />
          <IconButton 
            icon={faImage} 
            onClick={() => onUpdate({ defaultViewMode: 'large' })} 
            title="Large preview view" 
            ariaLabel="Large preview view" 
            variant={settings.defaultViewMode === 'large' ? 'primary' : 'ghost'} 
          />
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="collapseOnArticleOpen" className="checkbox-label">
          <input
            id="collapseOnArticleOpen"
            type="checkbox"
            checked={settings.collapseOnArticleOpen !== false}
            onChange={(e) => onUpdate({ collapseOnArticleOpen: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Collapse bookmark bar when opening an article</span>
        </label>
      </div>
    </div>
  )
}

export default LayoutNavigationSettings

