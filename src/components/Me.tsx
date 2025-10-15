import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faHighlighter, faBookmark, faList, faThLarge, faImage, faPenToSquare } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { BlogPostSkeleton, HighlightSkeleton, BookmarkSkeleton } from './Skeletons'
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
import { getCachedMeData, setCachedMeData, updateCachedHighlights } from '../services/meCache'
import { faBooks } from '../icons/customIcons'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'
import { groupIndividualBookmarks, hasContent } from '../utils/bookmarkUtils'

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
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
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
        setLoading(false)
        return
      }

      try {
        setLoading(true)

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
        // No blocking error - user can pull-to-refresh
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [relayPool, viewingPubkey, isOwnProfile, activeAccount, refreshTrigger])

  // Pull-to-refresh
  const { isRefreshing, pullPosition } = usePullToRefresh({
    onRefresh: () => {
      setRefreshTrigger(prev => prev + 1)
    },
    maximumPullLength: 240,
    refreshThreshold: 80,
    isDisabled: !viewingPubkey
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

  // Merge and flatten all individual bookmarks
  const allIndividualBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
    .filter(hasContent)
  const groups = groupIndividualBookmarks(allIndividualBookmarks)
  const sections: Array<{ key: string; title: string; items: IndividualBookmark[] }> = [
    { key: 'private', title: 'Private bookmarks', items: groups.privateItems },
    { key: 'public', title: 'Public bookmarks', items: groups.publicItems },
    { key: 'web', title: 'Web bookmarks', items: groups.web },
    { key: 'amethyst', title: 'Amethyst-style bookmarks', items: groups.amethyst }
  ]

  // Show content progressively - no blocking error screens
  const hasData = highlights.length > 0 || bookmarks.length > 0 || readArticles.length > 0 || writings.length > 0
  const showSkeletons = loading && !hasData

  const renderTabContent = () => {
    switch (activeTab) {
      case 'highlights':
        if (showSkeletons) {
          return (
            <div className="explore-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <HighlightSkeleton key={i} />
              ))}
            </div>
          )
        }
        return highlights.length === 0 ? (
          <div className="explore-empty" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>
              {isOwnProfile 
                ? 'No highlights yet. Pull to refresh!'
                : 'No highlights yet. Pull to refresh!'}
            </p>
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
        if (showSkeletons) {
          return (
            <div className="bookmarks-list">
              <div className={`bookmarks-grid bookmarks-${viewMode}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <BookmarkSkeleton key={i} viewMode={viewMode} />
                ))}
              </div>
            </div>
          )
        }
        return allIndividualBookmarks.length === 0 ? (
          <div className="explore-empty" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No bookmarks yet. Pull to refresh!</p>
          </div>
        ) : (
          <div className="bookmarks-list">
            {sections.filter(s => s.items.length > 0).map(section => (
              <div key={section.key} className="bookmarks-section">
                <h3 className="bookmarks-section-title">{section.title}</h3>
                <div className={`bookmarks-grid bookmarks-${viewMode}`}>
                  {section.items.map((individualBookmark, index) => (
                    <BookmarkItem
                      key={`${section.key}-${individualBookmark.id}-${index}`}
                      bookmark={individualBookmark}
                      index={index}
                      viewMode={viewMode}
                      onSelectUrl={handleSelectUrl}
                    />
                  ))}
                </div>
              </div>
            ))}
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
        if (showSkeletons) {
          return (
            <div className="explore-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <BlogPostSkeleton key={i} />
              ))}
            </div>
          )
        }
        return readArticles.length === 0 ? (
          <div className="explore-empty" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No read articles yet. Pull to refresh!</p>
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
        if (showSkeletons) {
          return (
            <div className="explore-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <BlogPostSkeleton key={i} />
              ))}
            </div>
          )
        }
        return writings.length === 0 ? (
          <div className="explore-empty" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>
              {isOwnProfile 
                ? 'No articles written yet. Pull to refresh!'
                : 'No articles written yet. Pull to refresh!'}
            </p>
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
    <div className="explore-container">
      <RefreshIndicator
        isRefreshing={isRefreshing}
        pullPosition={pullPosition}
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
          </button>
          {isOwnProfile && (
            <>
              <button
                className={`me-tab ${activeTab === 'reading-list' ? 'active' : ''}`}
                data-tab="reading-list"
                onClick={() => navigate('/me/reading-list')}
              >
                <FontAwesomeIcon icon={faBookmark} />
                <span className="tab-label">Bookmarks</span>
              </button>
              <button
                className={`me-tab ${activeTab === 'archive' ? 'active' : ''}`}
                data-tab="archive"
                onClick={() => navigate('/me/archive')}
              >
                <FontAwesomeIcon icon={faBooks} />
                <span className="tab-label">Archive</span>
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

