import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationCircle, faHighlighter, faBookmark, faBook } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { fetchHighlights } from '../services/highlightService'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchReadArticlesWithData } from '../services/libraryService'
import { BlogPostPreview } from '../services/exploreService'
import { Bookmark } from '../types/bookmarks'
import AuthorCard from './AuthorCard'
import BlogPostCard from './BlogPostCard'

interface MeProps {
  relayPool: RelayPool
}

type TabType = 'highlights' | 'reading-list' | 'archive'

const Me: React.FC<MeProps> = ({ relayPool }) => {
  const activeAccount = Hooks.useActiveAccount()
  const [activeTab, setActiveTab] = useState<TabType>('highlights')
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [readArticles, setReadArticles] = useState<BlogPostPreview[]>([])
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
          fetchReadArticlesWithData(relayPool, activeAccount.pubkey)
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

  const getPostUrl = (post: BlogPostPreview) => {
    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
    const naddr = nip19.naddrEncode({
      kind: 30023,
      pubkey: post.author,
      identifier: dTag
    })
    return `/a/${naddr}`
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

      case 'archive':
        return readArticles.length === 0 ? (
          <div className="explore-error">
            <p>No read articles yet. Mark articles as read to see them here!</p>
          </div>
        ) : (
          <div className="explore-grid">
            {readArticles.map((post) => (
              <BlogPostCard
                key={post.event.id}
                post={post}
                href={getPostUrl(post)}
              />
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
            data-tab="highlights"
            onClick={() => setActiveTab('highlights')}
          >
            <FontAwesomeIcon icon={faHighlighter} />
            Highlights ({highlights.length})
          </button>
          <button
            className={`me-tab ${activeTab === 'reading-list' ? 'active' : ''}`}
            data-tab="reading-list"
            onClick={() => setActiveTab('reading-list')}
          >
            <FontAwesomeIcon icon={faBookmark} />
            Reading List ({bookmarks.length})
          </button>
          <button
            className={`me-tab ${activeTab === 'archive' ? 'active' : ''}`}
            data-tab="archive"
            onClick={() => setActiveTab('archive')}
          >
            <FontAwesomeIcon icon={faBook} />
            Archive ({readArticles.length})
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

