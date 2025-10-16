import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faBookmark, faList, faThLarge, faImage, faPenToSquare, faLink } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { BlogPostSkeleton, HighlightSkeleton, BookmarkSkeleton } from './Skeletons'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { useNavigate } from 'react-router-dom'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { fetchHighlights } from '../services/highlightService'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchAllReads, ReadItem } from '../services/readsService'
import { fetchLinks } from '../services/linksService'
import { BlogPostPreview, fetchBlogPostsFromAuthors } from '../services/exploreService'
import { RELAYS } from '../config/relays'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import AuthorCard from './AuthorCard'
import BlogPostCard from './BlogPostCard'
import { BookmarkItem } from './BookmarkItem'
import IconButton from './IconButton'
import { ViewMode } from './Bookmarks'
import { getCachedMeData, updateCachedHighlights } from '../services/meCache'
import { faBooks } from '../icons/customIcons'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'
import { groupIndividualBookmarks, hasContent } from '../utils/bookmarkUtils'
import BookmarkFilters, { BookmarkFilterType } from './BookmarkFilters'
import { filterBookmarksByType } from '../utils/bookmarkTypeClassifier'
import ReadingProgressFilters, { ReadingProgressFilterType } from './ReadingProgressFilters'
import { filterByReadingProgress } from '../utils/readingProgressUtils'
import { deriveReadsFromBookmarks } from '../utils/readsFromBookmarks'
import { deriveLinksFromBookmarks } from '../utils/linksFromBookmarks'
import { mergeReadItem } from '../utils/readItemMerge'

interface MeProps {
  relayPool: RelayPool
  activeTab?: TabType
  pubkey?: string // Optional pubkey for viewing other users' profiles
}

type TabType = 'highlights' | 'reading-list' | 'reads' | 'links' | 'writings'

const Me: React.FC<MeProps> = ({ relayPool, activeTab: propActiveTab, pubkey: propPubkey }) => {
  const activeAccount = Hooks.useActiveAccount()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>(propActiveTab || 'highlights')
  
  // Use provided pubkey or fall back to active account
  const viewingPubkey = propPubkey || activeAccount?.pubkey
  const isOwnProfile = !propPubkey || (activeAccount?.pubkey === propPubkey)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [reads, setReads] = useState<ReadItem[]>([])
  const [readsMap, setReadsMap] = useState<Map<string, ReadItem>>(new Map())
  const [links, setLinks] = useState<ReadItem[]>([])
  const [linksMap, setLinksMap] = useState<Map<string, ReadItem>>(new Map())
  const [writings, setWritings] = useState<BlogPostPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [bookmarkFilter, setBookmarkFilter] = useState<BookmarkFilterType>('all')
  const [readingProgressFilter, setReadingProgressFilter] = useState<ReadingProgressFilterType>('all')

  // Update local state when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab)
    }
  }, [propActiveTab])

  // Tab-specific loading functions
  const loadHighlightsTab = async () => {
    if (!viewingPubkey) return
    
    // Only show loading skeleton if tab hasn't been loaded yet
    const hasBeenLoaded = loadedTabs.has('highlights')
    
    try {
      if (!hasBeenLoaded) setLoading(true)
      const userHighlights = await fetchHighlights(relayPool, viewingPubkey)
      setHighlights(userHighlights)
      setLoadedTabs(prev => new Set(prev).add('highlights'))
    } catch (err) {
      console.error('Failed to load highlights:', err)
    } finally {
      if (!hasBeenLoaded) setLoading(false)
    }
  }

  const loadWritingsTab = async () => {
    if (!viewingPubkey) return
    
    const hasBeenLoaded = loadedTabs.has('writings')
    
    try {
      if (!hasBeenLoaded) setLoading(true)
      const userWritings = await fetchBlogPostsFromAuthors(relayPool, [viewingPubkey], RELAYS)
      setWritings(userWritings)
      setLoadedTabs(prev => new Set(prev).add('writings'))
    } catch (err) {
      console.error('Failed to load writings:', err)
    } finally {
      if (!hasBeenLoaded) setLoading(false)
    }
  }

  const loadReadingListTab = async () => {
    if (!viewingPubkey || !isOwnProfile || !activeAccount) return
    
    const hasBeenLoaded = loadedTabs.has('reading-list')
    
    try {
      if (!hasBeenLoaded) setLoading(true)
      try {
        await fetchBookmarks(relayPool, activeAccount, (newBookmarks) => {
          setBookmarks(newBookmarks)
        })
      } catch (err) {
        console.warn('Failed to load bookmarks:', err)
        setBookmarks([])
      }
      setLoadedTabs(prev => new Set(prev).add('reading-list'))
    } catch (err) {
      console.error('Failed to load reading list:', err)
    } finally {
      if (!hasBeenLoaded) setLoading(false)
    }
  }

  const loadReadsTab = async () => {
    if (!viewingPubkey || !isOwnProfile || !activeAccount) return
    
    const hasBeenLoaded = loadedTabs.has('reads')
    
    try {
      if (!hasBeenLoaded) setLoading(true)
      
      // Ensure bookmarks are loaded
      let fetchedBookmarks: Bookmark[] = bookmarks
      if (bookmarks.length === 0) {
        try {
          await fetchBookmarks(relayPool, activeAccount, (newBookmarks) => {
            fetchedBookmarks = newBookmarks
            setBookmarks(newBookmarks)
          })
        } catch (err) {
          console.warn('Failed to load bookmarks:', err)
          fetchedBookmarks = []
        }
      }

      // Derive reads from bookmarks immediately
      const initialReads = deriveReadsFromBookmarks(fetchedBookmarks)
      const tempMap = new Map(initialReads.map(item => [item.id, item]))
      setReadsMap(tempMap)
      setReads(initialReads)
      setLoadedTabs(prev => new Set(prev).add('reads'))
      if (!hasBeenLoaded) setLoading(false)
      
      // Background enrichment: merge reading progress and mark-as-read
      // Only update items that are already in our map
      fetchAllReads(relayPool, viewingPubkey, fetchedBookmarks, (item) => {
        if (tempMap.has(item.id) && mergeReadItem(tempMap, item)) {
          setReadsMap(new Map(tempMap))
          setReads(Array.from(tempMap.values()))
        }
      }).catch(err => console.warn('Failed to enrich reads:', err))
      
    } catch (err) {
      console.error('Failed to load reads:', err)
      if (!hasBeenLoaded) setLoading(false)
    }
  }

  const loadLinksTab = async () => {
    if (!viewingPubkey || !isOwnProfile || !activeAccount) return
    
    const hasBeenLoaded = loadedTabs.has('links')
    
    try {
      if (!hasBeenLoaded) setLoading(true)
      
      // Ensure bookmarks are loaded
      let fetchedBookmarks: Bookmark[] = bookmarks
      if (bookmarks.length === 0) {
        try {
          await fetchBookmarks(relayPool, activeAccount, (newBookmarks) => {
            fetchedBookmarks = newBookmarks
            setBookmarks(newBookmarks)
          })
        } catch (err) {
          console.warn('Failed to load bookmarks:', err)
          fetchedBookmarks = []
        }
      }

      // Derive links from bookmarks immediately
      const initialLinks = deriveLinksFromBookmarks(fetchedBookmarks)
      const tempMap = new Map(initialLinks.map(item => [item.id, item]))
      setLinksMap(tempMap)
      setLinks(initialLinks)
      setLoadedTabs(prev => new Set(prev).add('links'))
      if (!hasBeenLoaded) setLoading(false)
      
      // Background enrichment: merge reading progress and mark-as-read
      // Only update items that are already in our map
      fetchLinks(relayPool, viewingPubkey, (item) => {
        if (tempMap.has(item.id) && mergeReadItem(tempMap, item)) {
          setLinksMap(new Map(tempMap))
          setLinks(Array.from(tempMap.values()))
        }
      }).catch(err => console.warn('Failed to enrich links:', err))
      
    } catch (err) {
      console.error('Failed to load links:', err)
      if (!hasBeenLoaded) setLoading(false)
    }
  }

  // Load active tab data
  useEffect(() => {
    if (!viewingPubkey || !activeTab) {
      setLoading(false)
      return
    }

    // Load cached data immediately if available
    if (isOwnProfile) {
      const cached = getCachedMeData(viewingPubkey)
      if (cached) {
        setHighlights(cached.highlights)
        setBookmarks(cached.bookmarks)
        setReads(cached.reads || [])
        setLinks(cached.links || [])
      }
    }

    // Load data for active tab (refresh in background if already loaded)
    switch (activeTab) {
      case 'highlights':
        loadHighlightsTab()
        break
      case 'writings':
        loadWritingsTab()
        break
      case 'reading-list':
        loadReadingListTab()
        break
      case 'reads':
        loadReadsTab()
        break
      case 'links':
        loadLinksTab()
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, viewingPubkey, refreshTrigger])


  // Pull-to-refresh - reload active tab without clearing state
  const { isRefreshing, pullPosition } = usePullToRefresh({
    onRefresh: () => {
      // Just trigger refresh - loaders will merge new data
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

  const getReadItemUrl = (item: ReadItem) => {
    if (item.type === 'article' && item.event) {
      const dTag = item.event.tags.find(t => t[0] === 'd')?.[1] || ''
      const naddr = nip19.naddrEncode({
        kind: 30023,
        pubkey: item.event.pubkey,
        identifier: dTag
      })
      return `/a/${naddr}`
    } else if (item.url) {
      return `/r/${encodeURIComponent(item.url)}`
    }
    return '#'
  }

  const convertReadItemToBlogPostPreview = (item: ReadItem): BlogPostPreview => {
    if (item.event) {
      return {
        event: item.event,
        title: item.title || 'Untitled',
        summary: item.summary,
        image: item.image,
        published: item.published,
        author: item.author || item.event.pubkey
      }
    }
    
    // Create a mock event for external URLs
    const mockEvent = {
      id: item.id,
      pubkey: item.author || '',
      created_at: item.readingTimestamp || Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [] as string[][],
      content: item.title || item.url || 'Untitled',
      sig: ''
    } as const
    
    return {
      event: mockEvent as unknown as import('nostr-tools').NostrEvent,
      title: item.title || item.url || 'Untitled',
      summary: item.summary,
      image: item.image,
      published: item.published,
      author: item.author || ''
    }
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
  
  // Apply bookmark filter
  const filteredBookmarks = filterBookmarksByType(allIndividualBookmarks, bookmarkFilter)
  
  const groups = groupIndividualBookmarks(filteredBookmarks)

  // Apply reading progress filter
  const filteredReads = filterByReadingProgress(reads, readingProgressFilter)
  const filteredLinks = filterByReadingProgress(links, readingProgressFilter)
  const sections: Array<{ key: string; title: string; items: IndividualBookmark[] }> = [
    { key: 'private', title: 'Private Bookmarks', items: groups.privateItems },
    { key: 'public', title: 'Public Bookmarks', items: groups.publicItems },
    { key: 'web', title: 'Web Bookmarks', items: groups.web },
    { key: 'amethyst', title: 'Legacy Bookmarks', items: groups.amethyst }
  ]

  // Show content progressively - no blocking error screens
  const hasData = highlights.length > 0 || bookmarks.length > 0 || reads.length > 0 || links.length > 0 || writings.length > 0
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
        return highlights.length === 0 && !loading ? (
          <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            No highlights yet.
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
        return allIndividualBookmarks.length === 0 && !loading ? (
          <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            No bookmarks yet.
          </div>
        ) : (
          <div className="bookmarks-list">
            {allIndividualBookmarks.length > 0 && (
              <BookmarkFilters
                selectedFilter={bookmarkFilter}
                onFilterChange={setBookmarkFilter}
              />
            )}
            {filteredBookmarks.length === 0 ? (
              <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                No bookmarks match this filter.
              </div>
            ) : (
              sections.filter(s => s.items.length > 0).map(section => (
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
            )))}
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

      case 'reads':
        // Show loading skeletons only while initially loading
        if (loading && !loadedTabs.has('reads')) {
          return (
            <div className="explore-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <BlogPostSkeleton key={i} />
              ))}
            </div>
          )
        }
        
        // Show empty state if loaded but no reads
        if (reads.length === 0 && loadedTabs.has('reads')) {
          return (
            <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
              No articles read yet.
            </div>
          )
        }
        
        // Show reads with filters
        return (
          <>
            <ReadingProgressFilters
              selectedFilter={readingProgressFilter}
              onFilterChange={setReadingProgressFilter}
            />
            {filteredReads.length === 0 ? (
              <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                No articles match this filter.
              </div>
            ) : (
              <div className="explore-grid">
              {filteredReads.map((item) => (
                <BlogPostCard
                  key={item.id}
                  post={convertReadItemToBlogPostPreview(item)}
                  href={getReadItemUrl(item)}
                  readingProgress={item.readingProgress}
                />
              ))}
              </div>
            )}
          </>
        )

      case 'links':
        // Show loading skeletons only while initially loading
        if (loading && !loadedTabs.has('links')) {
          return (
            <div className="explore-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <BlogPostSkeleton key={i} />
              ))}
            </div>
          )
        }
        
        // Show empty state if loaded but no links
        if (links.length === 0 && loadedTabs.has('links')) {
          return (
            <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
              No links with reading progress yet.
            </div>
          )
        }
        
        // Show links with filters
        return (
          <>
            <ReadingProgressFilters
              selectedFilter={readingProgressFilter}
              onFilterChange={setReadingProgressFilter}
            />
            {filteredLinks.length === 0 ? (
              <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                No links match this filter.
              </div>
            ) : (
              <div className="explore-grid">
              {filteredLinks.map((item) => (
                <BlogPostCard
                  key={item.id}
                  post={convertReadItemToBlogPostPreview(item)}
                  href={getReadItemUrl(item)}
                  readingProgress={item.readingProgress}
                />
              ))}
              </div>
            )}
          </>
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
        return writings.length === 0 && !loading ? (
          <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            No articles written yet.
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
                className={`me-tab ${activeTab === 'reads' ? 'active' : ''}`}
                data-tab="reads"
                onClick={() => navigate('/me/reads')}
              >
                <FontAwesomeIcon icon={faBooks} />
                <span className="tab-label">Reads</span>
              </button>
              <button
                className={`me-tab ${activeTab === 'links' ? 'active' : ''}`}
                data-tab="links"
                onClick={() => navigate('/me/links')}
              >
                <FontAwesomeIcon icon={faLink} />
                <span className="tab-label">Links</span>
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

