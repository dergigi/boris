import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faRightFromBracket, faUser, faList, faThLarge, faImage, faGear } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import IconButton from './IconButton'
import { ViewMode } from './Bookmarks'

interface SidebarHeaderProps {
  onToggleCollapse: () => void
  onLogout: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onToggleCollapse, onLogout, viewMode, onViewModeChange }) => {
  const activeAccount = Hooks.useActiveAccount()
  const profile = useEventModel(Models.ProfileModel, activeAccount ? [activeAccount.pubkey] : null)

  const getProfileImage = () => {
    return profile?.picture || null
  }

  const getUserDisplayName = () => {
    if (!activeAccount) return 'Unknown User'
    if (profile?.name) return profile.name
    if (profile?.display_name) return profile.display_name
    if (profile?.nip05) return profile.nip05
    return `${activeAccount.pubkey.slice(0, 8)}...${activeAccount.pubkey.slice(-8)}`
  }

  const profileImage = getProfileImage()

  return (
    <>
      <div className="sidebar-header-bar">
        <button 
          onClick={onToggleCollapse}
          className="toggle-sidebar-btn"
          title="Collapse bookmarks sidebar"
          aria-label="Collapse bookmarks sidebar"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
        <div className="profile-avatar" title={getUserDisplayName()}>
          {profileImage ? (
            <img src={profileImage} alt={getUserDisplayName()} />
          ) : (
            <FontAwesomeIcon icon={faUser} />
          )}
        </div>
        <IconButton
          icon={faGear}
          onClick={() => console.log('Settings clicked')}
          title="Settings"
          ariaLabel="Settings"
          variant="ghost"
        />
        <IconButton
          icon={faRightFromBracket}
          onClick={onLogout}
          title="Logout"
          ariaLabel="Logout"
          variant="ghost"
        />
      </div>
      <div className="view-mode-controls">
        <IconButton
          icon={faList}
          onClick={() => onViewModeChange('compact')}
          title="Compact list view"
          ariaLabel="Compact list view"
          variant={viewMode === 'compact' ? 'primary' : 'ghost'}
        />
        <IconButton
          icon={faThLarge}
          onClick={() => onViewModeChange('cards')}
          title="Cards view"
          ariaLabel="Cards view"
          variant={viewMode === 'cards' ? 'primary' : 'ghost'}
        />
        <IconButton
          icon={faImage}
          onClick={() => onViewModeChange('large')}
          title="Large preview view"
          ariaLabel="Large preview view"
          variant={viewMode === 'large' ? 'primary' : 'ghost'}
        />
      </div>
    </>
  )
}

export default SidebarHeader

