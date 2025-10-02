import { useState, useEffect, useContext } from 'react'
import { EventStoreContext } from 'applesauce-react'
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
  onLogout: () => void
}

const Bookmarks: React.FC<BookmarksProps> = ({ onLogout }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const eventStore = useContext(EventStoreContext)

  useEffect(() => {
    if (eventStore) {
      fetchBookmarks()
    }
  }, [eventStore])

  const fetchBookmarks = async () => {
    if (!eventStore) return

    try {
      setLoading(true)
      
      // Get public key from nostr extension
      const publicKey = await window.nostr?.getPublicKey()
      if (!publicKey) {
        throw new Error('No public key available')
      }
      
      // Fetch bookmarks according to NIP-51
      // Kind 10003: bookmark lists
      // Kind 30003: parameterized replaceable events (bookmark lists with d-tag)
      const events = eventStore.getByFilters([
        {
          kinds: [10003, 30003],
          authors: [publicKey]
        }
      ])

      const bookmarkList: Bookmark[] = []
      
      for (const event of events) {
        // Parse bookmark data from event content and tags
        const bookmarkData = parseBookmarkEvent(event)
        if (bookmarkData) {
          bookmarkList.push(bookmarkData)
        }
      }

      setBookmarks(bookmarkList)
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error)
    } finally {
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

  if (loading) {
    return (
      <div className="bookmarks-container">
        <div className="bookmarks-header">
          <h2>Your Bookmarks</h2>
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
        <h2>Your Bookmarks ({bookmarks.length})</h2>
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
