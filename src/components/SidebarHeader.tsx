import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faRightFromBracket, faRightToBracket, faUserCircle, faGear, faRotate, faHome, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { Accounts } from 'applesauce-accounts'
import { RelayPool } from 'applesauce-relay'
import IconButton from './IconButton'
import AddBookmarkModal from './AddBookmarkModal'
import { createWebBookmark } from '../services/webBookmarkService'
import { RELAYS } from '../config/relays'

interface SidebarHeaderProps {
  onToggleCollapse: () => void
  onLogout: () => void
  onOpenSettings: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
  relayPool: RelayPool | null
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onToggleCollapse, onLogout, onOpenSettings, onRefresh, isRefreshing, relayPool }) => {
  const [isConnecting, setIsConnecting] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
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

  const handleSaveBookmark = async (url: string, title?: string, description?: string, tags?: string[]) => {
    if (!activeAccount || !relayPool) {
      throw new Error('Please login to create bookmarks')
    }

    await createWebBookmark(url, title, description, tags, activeAccount, relayPool, RELAYS)
    
    // Refresh bookmarks after creating
    if (onRefresh) {
      onRefresh()
    }
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
        <div className="sidebar-header-right">
        <div 
          className="profile-avatar" 
          title={activeAccount ? getUserDisplayName() : "Login"}
          onClick={!activeAccount ? (isConnecting ? () => {} : handleLogin) : undefined}
          style={{ cursor: !activeAccount ? 'pointer' : 'default' }}
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
        {activeAccount && (
          <IconButton
            icon={faPlus}
            onClick={() => setShowAddModal(true)}
            title="Add bookmark"
            ariaLabel="Add bookmark"
            variant="ghost"
          />
        )}
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
      {showAddModal && (
        <AddBookmarkModal
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveBookmark}
        />
      )}
    </>
  )
}

export default SidebarHeader

