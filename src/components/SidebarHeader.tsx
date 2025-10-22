import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faRightFromBracket, faUserCircle, faGear, faHome, faNewspaper } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import IconButton from './IconButton'

interface SidebarHeaderProps {
  onToggleCollapse: () => void
  onLogout: () => void
  onOpenSettings: () => void
  isMobile?: boolean
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onToggleCollapse, onLogout, onOpenSettings, isMobile = false }) => {
  const navigate = useNavigate()
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
        {activeAccount && (
          <button
            className="profile-avatar-button" 
            title={getUserDisplayName()}
            onClick={() => navigate('/me')}
            aria-label={`Profile: ${getUserDisplayName()}`}
          >
            {profileImage ? (
              <img src={profileImage} alt={getUserDisplayName()} />
            ) : (
              <FontAwesomeIcon icon={faUserCircle} />
            )}
          </button>
        )}
        <div className="sidebar-header-right">
          <IconButton
            icon={faHome}
            onClick={() => navigate('/')}
            title="Home"
            ariaLabel="Home"
            variant="ghost"
          />
          <IconButton
            icon={faNewspaper}
            onClick={() => navigate('/explore')}
            title="Explore"
            ariaLabel="Explore"
            variant="ghost"
          />
          <IconButton
            icon={faGear}
            onClick={onOpenSettings}
            title="Settings"
            ariaLabel="Settings"
            variant="ghost"
          />
          {activeAccount && (
            <IconButton
              icon={faRightFromBracket}
              onClick={onLogout}
              title="Logout"
              ariaLabel="Logout"
              variant="ghost"
            />
          )}
          {!isMobile && (
            <button 
              onClick={onToggleCollapse}
              className="toggle-sidebar-btn"
              title="Collapse bookmarks sidebar"
              aria-label="Collapse bookmarks sidebar"
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default SidebarHeader

