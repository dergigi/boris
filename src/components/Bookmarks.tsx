import React, { useState, useEffect } from 'react'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { Bookmark } from '../types/bookmarks'
import { BookmarkList } from './BookmarkList'
import { fetchBookmarks } from '../services/bookmarkService'

interface BookmarksProps {
  relayPool: RelayPool | null
  onLogout: () => void
}

const Bookmarks: React.FC<BookmarksProps> = ({ relayPool, onLogout }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const activeAccount = Hooks.useActiveAccount()
  
  // Use ProfileModel to get user profile information
  const profile = useEventModel(Models.ProfileModel, activeAccount ? [activeAccount.pubkey] : null)

  useEffect(() => {
    console.log('Bookmarks useEffect triggered')
    console.log('relayPool:', !!relayPool)
    console.log('activeAccount:', !!activeAccount)
    if (relayPool && activeAccount) {
      console.log('Starting to fetch bookmarks...')
      handleFetchBookmarks()
    } else {
      console.log('Not fetching bookmarks - missing dependencies')
    }
  }, [relayPool, activeAccount?.pubkey]) // Only depend on pubkey, not the entire activeAccount object

  const handleFetchBookmarks = async () => {
    console.log('🔍 fetchBookmarks called, loading:', loading)
    if (!relayPool || !activeAccount) {
      console.log('🔍 fetchBookmarks early return - relayPool:', !!relayPool, 'activeAccount:', !!activeAccount)
      return
    }

    // Set a timeout to ensure loading state gets reset
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout reached, resetting loading state')
      setLoading(false)
    }, 15000) // 15 second timeout

    await fetchBookmarks(relayPool, activeAccount, setBookmarks, setLoading, timeoutId)
  }



  const formatUserDisplay = () => {
    if (!activeAccount) return 'Unknown User'

    // Use profile data from ProfileModel if available
    if (profile?.name) {
      return profile.name
    }
    if (profile?.display_name) {
      return profile.display_name
    }
    if (profile?.nip05) {
      return profile.nip05
    }

    // Fallback to formatted public key
    return `${activeAccount.pubkey.slice(0, 8)}...${activeAccount.pubkey.slice(-8)}`
  }

  if (loading) {
    return (
      <div className="bookmarks-container">
        <div className="bookmarks-header">
          <div>
            <h2>Your Bookmarks</h2>
            {activeAccount && (
              <p className="user-info">Logged in as: {formatUserDisplay()}</p>
            )}
          </div>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
        <div className="loading">Loading bookmarks...</div>
      </div>
    )
  }

  return (
    <BookmarkList 
      bookmarks={bookmarks}
      activeAccount={activeAccount || null}
      onLogout={onLogout}
      formatUserDisplay={formatUserDisplay}
    />
  )
}

export default Bookmarks
