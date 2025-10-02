import React, { useState, useEffect } from 'react'
import { Hooks } from 'applesauce-react'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { NostrEvent } from 'nostr-tools'

interface Bookmark {
  id: string
  title: string
  url: string
  content: string
  created_at: number
  tags: string[][]
  bookmarkCount?: number
  eventReferences?: string[]
  articleReferences?: string[]
  urlReferences?: string[]
}

interface BookmarksProps {
  addressLoader: ((params: { kind: number; pubkey: string; relays?: string[] }) => {
    subscribe: (observer: {
      next: (event: NostrEvent) => void;
      error: (error: unknown) => void;
      complete: () => void;
    }) => { unsubscribe: () => void };
  }) | null
  onLogout: () => void
}

const Bookmarks: React.FC<BookmarksProps> = ({ addressLoader, onLogout }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const activeAccount = Hooks.useActiveAccount()
  
  // Use ProfileModel to get user profile information
  const profile = useEventModel(Models.ProfileModel, activeAccount ? [activeAccount.pubkey] : null)

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
            error: (error: unknown) => {
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
      // According to NIP-51, bookmark lists (kind 10003) contain:
      // - "e" tags for event references (the actual bookmarks)
      // - "a" tags for article references
      // - "r" tags for URL references
      
      const eventTags = event.tags.filter((tag: string[]) => tag[0] === 'e')
      const articleTags = event.tags.filter((tag: string[]) => tag[0] === 'a')
      const urlTags = event.tags.filter((tag: string[]) => tag[0] === 'r')
      
      // Get the title from content or use a default
      const title = event.content || `Bookmark List (${eventTags.length + articleTags.length + urlTags.length} items)`
      
      return {
        id: event.id,
        title: title,
        url: '', // Bookmark lists don't have a single URL
        content: event.content,
        created_at: event.created_at,
        tags: event.tags,
        // Add metadata about the bookmark list
        bookmarkCount: eventTags.length + articleTags.length + urlTags.length,
        eventReferences: eventTags.map(tag => tag[1]),
        articleReferences: articleTags.map(tag => tag[1]),
        urlReferences: urlTags.map(tag => tag[1])
      }
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
              {bookmark.bookmarkCount && (
                <p className="bookmark-count">
                  {bookmark.bookmarkCount} bookmarks in this list
                </p>
              )}
              {bookmark.urlReferences && bookmark.urlReferences.length > 0 && (
                <div className="bookmark-urls">
                  <h4>URLs:</h4>
                  {bookmark.urlReferences.map((url, index) => (
                    <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="bookmark-url">
                      {url}
                    </a>
                  ))}
                </div>
              )}
              {bookmark.eventReferences && bookmark.eventReferences.length > 0 && (
                <div className="bookmark-events">
                  <h4>Event References ({bookmark.eventReferences.length}):</h4>
                  <div className="event-ids">
                    {bookmark.eventReferences.slice(0, 3).map((eventId, index) => (
                      <span key={index} className="event-id">
                        {eventId.slice(0, 8)}...{eventId.slice(-8)}
                      </span>
                    ))}
                    {bookmark.eventReferences.length > 3 && (
                      <span className="more-events">... and {bookmark.eventReferences.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}
              {bookmark.content && (
                <p className="bookmark-content">{bookmark.content}</p>
              )}
              <div className="bookmark-meta">
                <span>Created: {formatDate(bookmark.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Bookmarks
