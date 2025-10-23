import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { createWebBookmark } from '../services/webBookmarkService'
import { getActiveRelayUrls } from '../services/relayManager'
import { useToast } from '../hooks/useToast'

interface ShareTargetHandlerProps {
  relayPool: RelayPool
}

/**
 * Handles incoming shared URLs from the Web Share Target API.
 * Auto-saves the shared URL as a web bookmark (NIP-B0).
 */
export default function ShareTargetHandler({ relayPool }: ShareTargetHandlerProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const activeAccount = Hooks.useActiveAccount()
  const { showToast } = useToast()
  const [processing, setProcessing] = useState(false)
  const [waitingForLogin, setWaitingForLogin] = useState(false)

  useEffect(() => {
    const handleSharedContent = async () => {
      // Parse query parameters
      const params = new URLSearchParams(location.search)
      const link = params.get('link')
      const title = params.get('title')
      const text = params.get('text')

      // Validate we have a URL
      if (!link) {
        showToast('No URL to save')
        navigate('/')
        return
      }

      // If no active account, wait for login
      if (!activeAccount) {
        setWaitingForLogin(true)
        showToast('Please log in to save this bookmark')
        return
      }

      // We have account and URL, proceed with saving
      if (!processing) {
        setProcessing(true)
        try {
          await createWebBookmark(
            link,
            title || undefined,
            text || undefined,
            undefined,
            activeAccount,
            relayPool,
            getActiveRelayUrls(relayPool)
          )
          showToast('Bookmark saved!')
          navigate('/my/links')
        } catch (err) {
          console.error('Failed to save shared bookmark:', err)
          showToast('Failed to save bookmark')
          navigate('/')
        } finally {
          setProcessing(false)
        }
      }
    }

    handleSharedContent()
  }, [activeAccount, location.search, navigate, relayPool, showToast, processing])

  // Show waiting for login state
  if (waitingForLogin && !activeAccount) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="text-4xl mb-4" />
          <p className="text-lg">Waiting for login...</p>
        </div>
      </div>
    )
  }

  // Show processing state
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl mb-4" />
        <p className="text-lg">Saving bookmark...</p>
      </div>
    </div>
  )
}

