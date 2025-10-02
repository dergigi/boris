import React from 'react'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import IconButton from './IconButton'

interface UserHeaderProps {
  onLogout: () => void
}

const UserHeader: React.FC<UserHeaderProps> = ({ onLogout }) => {
  const activeAccount = Hooks.useActiveAccount()
  const profile = useEventModel(Models.ProfileModel, activeAccount ? [activeAccount.pubkey] : null)

  const formatUserDisplay = () => {
    if (!activeAccount) return 'Unknown User'

    if (profile?.name) {
      return profile.name
    }
    if (profile?.display_name) {
      return profile.display_name
    }
    if (profile?.nip05) {
      return profile.nip05
    }

    return `${activeAccount.pubkey.slice(0, 8)}...${activeAccount.pubkey.slice(-8)}`
  }

  return (
    <div className="app-header">
      <p className="user-info">Logged in as: {formatUserDisplay()}</p>
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

export default UserHeader

