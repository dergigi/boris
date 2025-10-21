import React from 'react'
import { faNetworkWired, faUserGroup, faUser } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import IconButton from '../IconButton'

interface ExploreSettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const ExploreSettings: React.FC<ExploreSettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="settings-section">
      <h3 className="section-title">Explore</h3>

      <div className="setting-group setting-inline">
        <label>Default Explore Scope</label>
        <div className="highlight-level-toggles">
          <IconButton
            icon={faNetworkWired}
            onClick={() => onUpdate({ defaultExploreScopeNostrverse: !(settings.defaultExploreScopeNostrverse !== false) })}
            title="Nostrverse content"
            ariaLabel="Toggle nostrverse content by default in explore"
            variant="ghost"
            style={{ 
              color: (settings.defaultExploreScopeNostrverse !== false) ? 'var(--highlight-color-nostrverse, #9333ea)' : undefined,
              opacity: (settings.defaultExploreScopeNostrverse !== false) ? 1 : 0.4
            }}
          />
          <IconButton
            icon={faUserGroup}
            onClick={() => onUpdate({ defaultExploreScopeFriends: !(settings.defaultExploreScopeFriends !== false) })}
            title="Friends content"
            ariaLabel="Toggle friends content by default in explore"
            variant="ghost"
            style={{ 
              color: (settings.defaultExploreScopeFriends !== false) ? 'var(--highlight-color-friends, #f97316)' : undefined,
              opacity: (settings.defaultExploreScopeFriends !== false) ? 1 : 0.4
            }}
          />
          <IconButton
            icon={faUser}
            onClick={() => onUpdate({ defaultExploreScopeMine: !(settings.defaultExploreScopeMine !== false) })}
            title="My content"
            ariaLabel="Toggle my content by default in explore"
            variant="ghost"
            style={{ 
              color: (settings.defaultExploreScopeMine !== false) ? 'var(--highlight-color-mine, #eab308)' : undefined,
              opacity: (settings.defaultExploreScopeMine !== false) ? 1 : 0.4
            }}
          />
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="hideBotArticlesByName" className="checkbox-label">
          <input
            id="hideBotArticlesByName"
            type="checkbox"
            checked={settings.hideBotArticlesByName !== false}
            onChange={(e) => onUpdate({ hideBotArticlesByName: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Hide articles from accounts whose name contains "bot"</span>
        </label>
        <div className="setting-hint">Examples: Unlocks Bot, Step Counter Bot, Bitcoin Magazine News Bot</div>
      </div>
    </div>
  )
}

export default ExploreSettings

