import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationCircle, faHighlighter, faBookmark, faBook } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { fetchHighlights } from '../services/highlightService'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchReadArticles, ReadArticle } from '../services/libraryService'
import { Bookmark } from '../types/bookmarks'
import AuthorCard from './AuthorCard'

interface MeProps {
  relayPool: RelayPool
}

type TabType = 'highlights' | 'reading-list' | 'library'

const Me: React.FC<MeProps> = ({ relayPool }) => {
  const activeAccount = Hooks.useActiveAccount()
  const [activeTab, setActiveTab] = useState<TabType>('highlights')
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [readArticles, setReadArticles] = useState<ReadArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!activeAccount) {
        setError('Please log in to view your data')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Fetch highlights and read articles
        const [userHighlights, userReadArticles] = await Promise.all([
          fetchHighlights(relayPool, activeAccount.pubkey),
          fetchReadArticles(relayPool, activeAccount.pubkey)
        ])

        setHighlights(userHighlights)
        setReadArticles(userReadArticles)

        // Fetch bookmarks using callback pattern
        try {
          await fetchBookmarks(relayPool, activeAccount, setBookmarks)
        } catch (err) {
          console.warn('Failed to load bookmarks:', err)
          setBookmarks([])
        }
      } catch (err) {
        console.error('Failed to load data:', err)
        setError('Failed to load data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [relayPool, activeAccount])

  const handleHighlightDelete = (highlightId: string) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId))
  }

  if (loading) {
    return (
      <div className="explore-container">
        <div className="explore-loading">
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="explore-container">
        <div className="explore-error">
          <FontAwesomeIcon icon={faExclamationCircle} size="2x" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'highlights':
        return highlights.length === 0 ? (
          <div className="explore-error">
            <p>No highlights yet. Start highlighting content to see them here!</p>
          </div>
        ) : (
          <div className="highlights-list me-highlights-list">
            {highlights.map((highlight) => (
              <HighlightItem
                key={highlight.id}
                highlight={{ ...highlight, level: 'mine' }}
                relayPool={relayPool}
                onHighlightDelete={handleHighlightDelete}
              />
            ))}
          </div>
        )

      case 'reading-list':
        return bookmarks.length === 0 ? (
          <div className="explore-error">
            <p>No bookmarks yet. Bookmark articles to see them here!</p>
          </div>
        ) : (
          <div className="bookmarks-list">
            {bookmarks.map((bookmark) => (
              <div key={bookmark.id} className="bookmark-item">
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                  <h3>{bookmark.title || 'Untitled'}</h3>
                  {bookmark.content && <p>{bookmark.content.slice(0, 150)}...</p>}
                </a>
              </div>
            ))}
          </div>
        )

      case 'library':
        return readArticles.length === 0 ? (
          <div className="explore-error">
            <p>No read articles yet. Mark articles as read to see them here!</p>
          </div>
        ) : (
          <div className="library-list">
            {readArticles.map((article) => (
              <div key={article.reactionId} className="library-item">
                <p>
                  {article.url ? (
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                      {article.url}
                    </a>
                  ) : (
                    `Event: ${article.eventId?.slice(0, 12)}...`
                  )}
                </p>
                <small>
                  Marked as read: {new Date(article.markedAt * 1000).toLocaleDateString()}
                </small>
              </div>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="explore-container">
      <div className="explore-header">
        {activeAccount && <AuthorCard authorPubkey={activeAccount.pubkey} />}
        
        <div className="me-tabs">
          <button
            className={`me-tab ${activeTab === 'highlights' ? 'active' : ''}`}
            onClick={() => setActiveTab('highlights')}
          >
            <FontAwesomeIcon icon={faHighlighter} />
            Highlights ({highlights.length})
          </button>
          <button
            className={`me-tab ${activeTab === 'reading-list' ? 'active' : ''}`}
            onClick={() => setActiveTab('reading-list')}
          >
            <FontAwesomeIcon icon={faBookmark} />
            Reading List ({bookmarks.length})
          </button>
          <button
            className={`me-tab ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <FontAwesomeIcon icon={faBook} />
            Library ({readArticles.length})
          </button>
        </div>
      </div>

      <div className="me-tab-content">
        {renderTabContent()}
      </div>
    </div>
  )
}

export default Me

