import React from 'react'
import { faList, faThLarge, faImage } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import IconButton from '../IconButton'

interface LayoutBehaviorSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const LayoutBehaviorSettings: React.FC<LayoutBehaviorSettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="settings-section">
      <h3 className="section-title">Layout & Behavior</h3>
      
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

      <div className="setting-group">
        <label htmlFor="sidebarCollapsed" className="checkbox-label">
          <input
            id="sidebarCollapsed"
            type="checkbox"
            checked={settings.sidebarCollapsed !== false}
            onChange={(e) => onUpdate({ sidebarCollapsed: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Start with bookmarks sidebar collapsed</span>
        </label>
      </div>

      <div className="setting-group">
        <label htmlFor="highlightsCollapsed" className="checkbox-label">
          <input
            id="highlightsCollapsed"
            type="checkbox"
            checked={settings.highlightsCollapsed !== false}
            onChange={(e) => onUpdate({ highlightsCollapsed: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Start with highlights panel collapsed</span>
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
        <label htmlFor="autoCollapseSidebarOnMobile" className="checkbox-label">
          <input
            id="autoCollapseSidebarOnMobile"
            type="checkbox"
            checked={settings.autoCollapseSidebarOnMobile !== false}
            onChange={(e) => onUpdate({ autoCollapseSidebarOnMobile: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Auto-collapse sidebar on small screens</span>
        </label>
      </div>

      <div className="setting-group">
        <label htmlFor="syncReadingPosition" className="checkbox-label">
          <input
            id="syncReadingPosition"
            type="checkbox"
            checked={settings.syncReadingPosition ?? false}
            onChange={(e) => onUpdate({ syncReadingPosition: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Sync reading position across devices</span>
        </label>
      </div>

      <div className="setting-group">
        <label htmlFor="autoMarkAsReadOnCompletion" className="checkbox-label">
          <input
            id="autoMarkAsReadOnCompletion"
            type="checkbox"
            checked={settings.autoMarkAsReadOnCompletion ?? false}
            onChange={(e) => onUpdate({ autoMarkAsReadOnCompletion: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Automatically mark as read at 100%</span>
        </label>
      </div>

      <div className="setting-group">
        <label htmlFor="hideBookmarksWithoutCreationDate" className="checkbox-label">
          <input
            id="hideBookmarksWithoutCreationDate"
            type="checkbox"
            checked={settings.hideBookmarksWithoutCreationDate ?? false}
            onChange={(e) => onUpdate({ hideBookmarksWithoutCreationDate: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Hide bookmarks missing a creation date</span>
        </label>
      </div>
    </div>
  )
}

export default LayoutBehaviorSettings

