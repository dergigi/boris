import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faRightFromBracket, faRightToBracket, faUserCircle, faGear, faHome, faNewspaper, faTimes } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { Accounts } from 'applesauce-accounts'
import IconButton from './IconButton'

interface SidebarHeaderProps {
  onToggleCollapse: () => void
  onLogout: () => void
  onOpenSettings: () => void
  isMobile?: boolean
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onToggleCollapse, onLogout, onOpenSettings, isMobile = false }) => {
  const [isConnecting, setIsConnecting] = useState(false)
  const navigate = useNavigate()
  const activeAccount = Hooks.useActiveAccount()
  const accountManager = Hooks.useAccountManager()
  const profile = useEventModel(Models.ProfileModel, activeAccount ? [activeAccount.pubkey] : null)

  const handleLogin = async () => {
    try {
      setIsConnecting(true)
      const account = await Accounts.ExtensionAccount.fromExtension()
      accountManager.addAccount(account)
      accountManager.setActive(account)
    } catch (error) {
      console.error('Login failed:', error)
      alert('Login failed. Please install a nostr browser extension and try again.\n\nIf you aren\'t on nostr yet, start here: https://nstart.me/')
    } finally {
      setIsConnecting(false)
    }
  }

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
        {isMobile ? (
          <IconButton
            icon={faTimes}
            onClick={onToggleCollapse}
            title="Close sidebar"
            ariaLabel="Close sidebar"
            variant="ghost"
            className="mobile-close-btn"
          />
        ) : (
          <button 
            onClick={onToggleCollapse}
            className="toggle-sidebar-btn"
            title="Collapse bookmarks sidebar"
            aria-label="Collapse bookmarks sidebar"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        )}
        <div className="sidebar-header-right">
        <div 
          className="profile-avatar" 
          title={activeAccount ? getUserDisplayName() : "Login"}
          onClick={
            activeAccount 
              ? () => navigate('/me')
              : (isConnecting ? () => {} : handleLogin)
          }
          style={{ cursor: 'pointer' }}
        >
          {profileImage ? (
            <img src={profileImage} alt={getUserDisplayName()} />
          ) : (
            <FontAwesomeIcon icon={faUserCircle} />
          )}
        </div>
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
        {activeAccount ? (
          <IconButton
            icon={faRightFromBracket}
            onClick={onLogout}
            title="Logout"
            ariaLabel="Logout"
            variant="ghost"
          />
        ) : (
          <IconButton
            icon={faRightToBracket}
            onClick={isConnecting ? () => {} : handleLogin}
            title={isConnecting ? "Connecting..." : "Login"}
            ariaLabel="Login"
            variant="ghost"
          />
        )}
        </div>
      </div>
    </>
  )
}

export default SidebarHeader

