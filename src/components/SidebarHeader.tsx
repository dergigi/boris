import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faRightFromBracket, faUserCircle, faGear, faHome, faPersonHiking, faHighlighter, faBookmark, faPenToSquare, faLink } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import IconButton from './IconButton'
import { faBooks } from '../icons/customIcons'
import { preloadImage } from '../hooks/useImageCache'

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
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  // Preload profile image for offline access
  useEffect(() => {
    if (profileImage) {
      preloadImage(profileImage)
    }
  }, [profileImage])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  const handleMenuItemClick = (action: () => void) => {
    setShowProfileMenu(false)
    // Close mobile sidebar when navigating on mobile
    if (isMobile) {
      onToggleCollapse()
    }
    action()
  }

  return (
    <>
      <div className="sidebar-header-bar">
        <div className="sidebar-header-left">
          {activeAccount && (
            <div className="profile-menu-wrapper" ref={menuRef}>
              <button
                className="profile-avatar-button" 
                title={getUserDisplayName()}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-label={`Profile: ${getUserDisplayName()}`}
              >
                {profileImage ? (
                  <img src={profileImage} alt={getUserDisplayName()} />
                ) : (
                  <FontAwesomeIcon icon={faUserCircle} />
                )}
              </button>
              {showProfileMenu && (
                <div className="profile-dropdown-menu">
                  <button
                    className="profile-menu-item"
                    onClick={() => handleMenuItemClick(() => navigate('/my/highlights'))}
                  >
                    <FontAwesomeIcon icon={faHighlighter} />
                    <span>My Highlights</span>
                  </button>
                  <button
                    className="profile-menu-item"
                    onClick={() => handleMenuItemClick(() => navigate('/my/bookmarks'))}
                  >
                    <FontAwesomeIcon icon={faBookmark} />
                    <span>My Bookmarks</span>
                  </button>
                  <button
                    className="profile-menu-item"
                    onClick={() => handleMenuItemClick(() => navigate('/my/reads'))}
                  >
                    <FontAwesomeIcon icon={faBooks} />
                    <span>My Reads</span>
                  </button>
                  <button
                    className="profile-menu-item"
                    onClick={() => handleMenuItemClick(() => navigate('/my/links'))}
                  >
                    <FontAwesomeIcon icon={faLink} />
                    <span>My Links</span>
                  </button>
                  <button
                    className="profile-menu-item"
                    onClick={() => handleMenuItemClick(() => navigate('/my/writings'))}
                  >
                    <FontAwesomeIcon icon={faPenToSquare} />
                    <span>My Writings</span>
                  </button>
                  <div className="profile-menu-separator"></div>
                  <button
                    className="profile-menu-item"
                    onClick={() => handleMenuItemClick(onLogout)}
                  >
                    <FontAwesomeIcon icon={faRightFromBracket} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
          <IconButton
            icon={faHome}
            onClick={() => {
              if (isMobile) {
                onToggleCollapse()
              }
              navigate('/')
            }}
            title="Home"
            ariaLabel="Home"
            variant="ghost"
          />
        </div>
        <div className="sidebar-header-right">
          <IconButton
            icon={faPersonHiking}
            onClick={() => {
              if (isMobile) {
                onToggleCollapse()
              }
              navigate('/explore')
            }}
            title="Explore"
            ariaLabel="Explore"
            variant="ghost"
          />
          <IconButton
            icon={faGear}
            onClick={() => {
              if (isMobile) {
                onToggleCollapse()
              }
              onOpenSettings()
            }}
            title="Settings"
            ariaLabel="Settings"
            variant="ghost"
          />
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

