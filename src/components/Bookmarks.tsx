import { useState, useEffect } from 'react'
import { Hooks } from 'applesauce-react'
import { NostrEvent } from 'nostr-tools'

interface Bookmark {
  id: string
  title: string
  url: string
  content: string
  created_at: number
  tags: string[][]
}

interface BookmarksProps {
  addressLoader: any
  onLogout: () => void
}

const Bookmarks: React.FC<BookmarksProps> = ({ addressLoader, onLogout }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const activeAccount = Hooks.useActiveAccount()

  useEffect(() => {
    if (addressLoader && activeAccount) {
      fetchBookmarks()
    }
  }, [addressLoader, activeAccount])

  const fetchBookmarks = async () => {
    if (!addressLoader || !activeAccount) return

    try {
      setLoading(true)
      
      // Use applesauce address loader to fetch bookmark lists (kind 10003)
      // This is the proper way according to NIP-51 and applesauce documentation
      const bookmarkList: Bookmark[] = []
      
      const subscription = addressLoader({
        kind: 10003, // Bookmark list according to NIP-51
        pubkey: activeAccount.pubkey,
        // No need to specify relays - the relay group handles this automatically
        // The relay group will query all configured relays and deduplicate events
      }).subscribe({
        next: (event: NostrEvent) => {
          const bookmarkData = parseBookmarkEvent(event)
          if (bookmarkData) {
            bookmarkList.push(bookmarkData)
          }
        },
        error: (error: any) => {
          console.error('Error fetching bookmarks:', error)
          setLoading(false)
        },
        complete: () => {
          setBookmarks(bookmarkList)
          setLoading(false)
        }
      })

      // Set timeout to prevent hanging
      setTimeout(() => {
        subscription.unsubscribe()
        if (bookmarkList.length === 0) {
          setBookmarks([])
          setLoading(false)
        }
      }, 5000)

    } catch (error) {
      console.error('Failed to fetch bookmarks:', error)
      setLoading(false)
    }
  }

  const parseBookmarkEvent = (event: NostrEvent): Bookmark | null => {
    try {
      // Parse the event content as JSON (bookmark list)
      const content = JSON.parse(event.content || '{}')
      
      if (content.bookmarks && Array.isArray(content.bookmarks)) {
        // Handle bookmark list format
        return {
          id: event.id,
          title: content.name || 'Untitled Bookmark List',
          url: '',
          content: event.content,
          created_at: event.created_at,
          tags: event.tags
        }
      }

      // Handle individual bookmark entries
      const urlTag = event.tags.find((tag: string[]) => tag[0] === 'r' && tag[1])
      const titleTag = event.tags.find((tag: string[]) => tag[0] === 'title' && tag[1])
      
      if (urlTag) {
        return {
          id: event.id,
          title: titleTag?.[1] || 'Untitled',
          url: urlTag[1],
          content: event.content,
          created_at: event.created_at,
          tags: event.tags
        }
      }

      return null
    } catch (error) {
      console.error('Error parsing bookmark event:', error)
      return null
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const formatUserDisplay = () => {
    if (!activeAccount) return 'Unknown User'
    
    // For now, just show the formatted public key
    // TODO: Implement profile fetching through applesauce system
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
    <div className="bookmarks-container">
      <div className="bookmarks-header">
        <div>
          <h2>Your Bookmarks ({bookmarks.length})</h2>
          {activeAccount && (
            <p className="user-info">Logged in as: {formatUserDisplay()}</p>
          )}
        </div>
        <button onClick={onLogout} className="logout-button">
          Logout
        </button>
      </div>
      
      {bookmarks.length === 0 ? (
        <div className="empty-state">
          <p>No bookmarks found.</p>
          <p>Add bookmarks using your nostr client to see them here.</p>
        </div>
      ) : (
        <div className="bookmarks-list">
          {bookmarks.map((bookmark) => (
            <div key={bookmark.id} className="bookmark-item">
              <h3>{bookmark.title}</h3>
              {bookmark.url && (
                <a 
                  href={bookmark.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bookmark-url"
                >
                  {bookmark.url}
                </a>
              )}
              {bookmark.content && (
                <p className="bookmark-content">{bookmark.content}</p>
              )}
              <div className="bookmark-meta">
                <span>Added: {formatDate(bookmark.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Bookmarks
