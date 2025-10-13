import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationCircle, faHighlighter, faBookmark, faList, faThLarge, faImage, faPenToSquare } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { useNavigate } from 'react-router-dom'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { fetchHighlights } from '../services/highlightService'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchReadArticlesWithData } from '../services/libraryService'
import { BlogPostPreview, fetchBlogPostsFromAuthors } from '../services/exploreService'
import { RELAYS } from '../config/relays'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import AuthorCard from './AuthorCard'
import BlogPostCard from './BlogPostCard'
import { BookmarkItem } from './BookmarkItem'
import IconButton from './IconButton'
import { ViewMode } from './Bookmarks'
import { extractUrlsFromContent } from '../services/bookmarkHelpers'
import { getCachedMeData, setCachedMeData, updateCachedHighlights } from '../services/meCache'
import { faBooks } from '../icons/customIcons'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import PullToRefreshIndicator from './PullToRefreshIndicator'

interface MeProps {
  relayPool: RelayPool
  activeTab?: TabType
  pubkey?: string // Optional pubkey for viewing other users' profiles
}

type TabType = 'highlights' | 'reading-list' | 'archive' | 'writings'

const Me: React.FC<MeProps> = ({ relayPool, activeTab: propActiveTab, pubkey: propPubkey }) => {
  const activeAccount = Hooks.useActiveAccount()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>(propActiveTab || 'highlights')
  
  // Use provided pubkey or fall back to active account
  const viewingPubkey = propPubkey || activeAccount?.pubkey
  const isOwnProfile = !propPubkey || (activeAccount?.pubkey === propPubkey)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [readArticles, setReadArticles] = useState<BlogPostPreview[]>([])
  const [writings, setWritings] = useState<BlogPostPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const meContainerRef = useRef<HTMLDivElement>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Update local state when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab)
    }
  }, [propActiveTab])

  useEffect(() => {
    const loadData = async () => {
      if (!viewingPubkey) {
        setError(isOwnProfile ? 'Please log in to view your data' : 'Invalid profile')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Seed from cache if available to avoid empty flash (own profile only)
        if (isOwnProfile) {
          const cached = getCachedMeData(viewingPubkey)
          if (cached) {
            setHighlights(cached.highlights)
            setBookmarks(cached.bookmarks)
            setReadArticles(cached.readArticles)
          }
        }

        // Fetch highlights and writings (public data)
        const [userHighlights, userWritings] = await Promise.all([
          fetchHighlights(relayPool, viewingPubkey),
          fetchBlogPostsFromAuthors(relayPool, [viewingPubkey], RELAYS)
        ])

        setHighlights(userHighlights)
        setWritings(userWritings)

        // Only fetch private data for own profile
        if (isOwnProfile && activeAccount) {
          const userReadArticles = await fetchReadArticlesWithData(relayPool, viewingPubkey)
          setReadArticles(userReadArticles)

          // Fetch bookmarks using callback pattern
          let fetchedBookmarks: Bookmark[] = []
          try {
            await fetchBookmarks(relayPool, activeAccount, (newBookmarks) => {
              fetchedBookmarks = newBookmarks
              setBookmarks(newBookmarks)
            })
          } catch (err) {
            console.warn('Failed to load bookmarks:', err)
            setBookmarks([])
          }

          // Update cache with all fetched data
          setCachedMeData(viewingPubkey, userHighlights, fetchedBookmarks, userReadArticles)
        } else {
          setBookmarks([])
          setReadArticles([])
        }
      } catch (err) {
        console.error('Failed to load data:', err)
        setError('Failed to load data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [relayPool, viewingPubkey, isOwnProfile, activeAccount, refreshTrigger])

  // Pull-to-refresh
  const pullToRefreshState = usePullToRefresh(meContainerRef, {
    onRefresh: () => {
      setRefreshTrigger(prev => prev + 1)
    },
    isRefreshing: loading
  })

  const handleHighlightDelete = (highlightId: string) => {
    setHighlights(prev => {
      const updated = prev.filter(h => h.id !== highlightId)
      // Update cache when highlight is deleted (own profile only)
      if (isOwnProfile && viewingPubkey) {
        updateCachedHighlights(viewingPubkey, updated)
      }
      return updated
    })
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

  // Helper to check if a bookmark has either content or a URL (same logic as BookmarkList)
  const hasContentOrUrl = (ib: IndividualBookmark) => {
    const hasContent = ib.content && ib.content.trim().length > 0
    
    let hasUrl = false
    if (ib.kind === 39701) {
      const dTag = ib.tags?.find((t: string[]) => t[0] === 'd')?.[1]
      hasUrl = !!dTag && dTag.trim().length > 0
    } else {
      const urls = extractUrlsFromContent(ib.content || '')
      hasUrl = urls.length > 0
    }
    
    if (ib.kind === 30023) return true
    return hasContent || hasUrl
  }

  const handleSelectUrl = (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => {
    if (bookmark && bookmark.kind === 30023) {
      // For kind:30023 articles, navigate to the article route
      const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1] || ''
      if (dTag && bookmark.pubkey) {
        const pointer = {
          identifier: dTag,
          kind: 30023,
          pubkey: bookmark.pubkey,
        }
        const naddr = nip19.naddrEncode(pointer)
        navigate(`/a/${naddr}`)
      }
    } else if (url) {
      // For regular URLs, navigate to the reader route
      navigate(`/r/${encodeURIComponent(url)}`)
    }
  }

  // Merge and flatten all individual bookmarks (same logic as BookmarkList)
  const allIndividualBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
    .filter(hasContentOrUrl)
    .sort((a, b) => ((b.added_at || 0) - (a.added_at || 0)) || ((b.created_at || 0) - (a.created_at || 0)))

  // Only show full loading screen if we don't have any data yet
  const hasData = highlights.length > 0 || bookmarks.length > 0 || readArticles.length > 0 || writings.length > 0
  
  if (loading && !hasData) {
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
        return allIndividualBookmarks.length === 0 ? (
          <div className="explore-error">
            <p>No bookmarks yet. Bookmark articles to see them here!</p>
          </div>
        ) : (
          <div className="bookmarks-list">
            <div className={`bookmarks-grid bookmarks-${viewMode}`}>
              {allIndividualBookmarks.map((individualBookmark, index) => (
                <BookmarkItem
                  key={`${individualBookmark.id}-${index}`}
                  bookmark={individualBookmark}
                  index={index}
                  viewMode={viewMode}
                  onSelectUrl={handleSelectUrl}
                />
              ))}
            </div>
            <div className="view-mode-controls" style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '1rem',
              marginTop: '1rem',
              borderTop: '1px solid var(--border-color)'
            }}>
              <IconButton
                icon={faList}
                onClick={() => setViewMode('compact')}
                title="Compact list view"
                ariaLabel="Compact list view"
                variant={viewMode === 'compact' ? 'primary' : 'ghost'}
              />
              <IconButton
                icon={faThLarge}
                onClick={() => setViewMode('cards')}
                title="Cards view"
                ariaLabel="Cards view"
                variant={viewMode === 'cards' ? 'primary' : 'ghost'}
              />
              <IconButton
                icon={faImage}
                onClick={() => setViewMode('large')}
                title="Large preview view"
                ariaLabel="Large preview view"
                variant={viewMode === 'large' ? 'primary' : 'ghost'}
              />
            </div>
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

      case 'writings':
        return writings.length === 0 ? (
          <div className="explore-error">
            <p>No articles written yet. Publish your first article to see it here!</p>
          </div>
        ) : (
          <div className="explore-grid">
            {writings.map((post) => (
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
    <div 
      ref={meContainerRef}
      className={`explore-container pull-to-refresh-container ${pullToRefreshState.isPulling ? 'is-pulling' : ''}`}
    >
      <PullToRefreshIndicator
        isPulling={pullToRefreshState.isPulling}
        pullDistance={pullToRefreshState.pullDistance}
        canRefresh={pullToRefreshState.canRefresh}
        isRefreshing={loading && pullToRefreshState.canRefresh}
      />
      <div className="explore-header">
        {viewingPubkey && <AuthorCard authorPubkey={viewingPubkey} clickable={false} />}
        
        {loading && hasData && (
          <div className="explore-loading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
            <FontAwesomeIcon icon={faSpinner} spin />
          </div>
        )}
        
        <div className="me-tabs">
          <button
            className={`me-tab ${activeTab === 'highlights' ? 'active' : ''}`}
            data-tab="highlights"
            onClick={() => navigate(isOwnProfile ? '/me/highlights' : `/p/${propPubkey && nip19.npubEncode(propPubkey)}`)}
          >
            <FontAwesomeIcon icon={faHighlighter} />
            <span className="tab-label">Highlights</span>
            <span className="tab-count">({highlights.length})</span>
          </button>
          {isOwnProfile && (
            <>
              <button
                className={`me-tab ${activeTab === 'reading-list' ? 'active' : ''}`}
                data-tab="reading-list"
                onClick={() => navigate('/me/reading-list')}
              >
                <FontAwesomeIcon icon={faBookmark} />
                <span className="tab-label">Reading List</span>
                <span className="tab-count">({allIndividualBookmarks.length})</span>
              </button>
              <button
                className={`me-tab ${activeTab === 'archive' ? 'active' : ''}`}
                data-tab="archive"
                onClick={() => navigate('/me/archive')}
              >
                <FontAwesomeIcon icon={faBooks} />
                <span className="tab-label">Archive</span>
                <span className="tab-count">({readArticles.length})</span>
              </button>
            </>
          )}
          <button
            className={`me-tab ${activeTab === 'writings' ? 'active' : ''}`}
            data-tab="writings"
            onClick={() => navigate(isOwnProfile ? '/me/writings' : `/p/${propPubkey && nip19.npubEncode(propPubkey)}/writings`)}
          >
            <FontAwesomeIcon icon={faPenToSquare} />
            <span className="tab-label">Writings</span>
            <span className="tab-count">({writings.length})</span>
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

