import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faRightFromBracket, faRightToBracket, faUser, faList, faThLarge, faImage, faGear, faRotate } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { Accounts } from 'applesauce-accounts'
import IconButton from './IconButton'
import { ViewMode } from './Bookmarks'

interface SidebarHeaderProps {
  onToggleCollapse: () => void
  onLogout: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onOpenSettings: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onToggleCollapse, onLogout, viewMode, onViewModeChange, onOpenSettings, onRefresh, isRefreshing }) => {
  const [isConnecting, setIsConnecting] = useState(false)
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
      alert('Login failed. Please install a nostr browser extension and try again.')
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
        <button 
          onClick={onToggleCollapse}
          className="toggle-sidebar-btn"
          title="Collapse bookmarks sidebar"
          aria-label="Collapse bookmarks sidebar"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
        {onRefresh && (
          <IconButton
            icon={faRotate}
            onClick={onRefresh}
            title="Refresh bookmarks"
            ariaLabel="Refresh bookmarks"
            variant="ghost"
            disabled={isRefreshing}
            spin={isRefreshing}
          />
        )}
        <IconButton
          icon={faGear}
          onClick={onOpenSettings}
          title="Settings"
          ariaLabel="Settings"
          variant="ghost"
        />
        <div className="profile-avatar" title={getUserDisplayName()}>
          {profileImage ? (
            <img src={profileImage} alt={getUserDisplayName()} />
          ) : (
            <FontAwesomeIcon icon={faUser} />
          )}
        </div>
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

