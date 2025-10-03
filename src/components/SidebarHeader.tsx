import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faRightFromBracket, faUser } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import IconButton from './IconButton'

interface SidebarHeaderProps {
  onToggleCollapse: () => void
  onLogout: () => void
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onToggleCollapse, onLogout }) => {
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
        icon={faRightFromBracket}
        onClick={onLogout}
        title="Logout"
        ariaLabel="Logout"
        variant="ghost"
      />
    </div>
  )
}

export default SidebarHeader

