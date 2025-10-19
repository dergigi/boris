import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faBookmark, faPenToSquare, faLink, faLayerGroup, faBars } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { IEventStore } from 'applesauce-core'
import { BlogPostSkeleton, HighlightSkeleton, BookmarkSkeleton } from './Skeletons'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { useNavigate, useParams } from 'react-router-dom'
import { Highlight } from '../types/highlights'
import { HighlightItem } from './HighlightItem'
import { highlightsController } from '../services/highlightsController'
import { writingsController } from '../services/writingsController'
import { fetchAllReads, ReadItem } from '../services/readsService'
import { fetchLinks } from '../services/linksService'
import { BlogPostPreview } from '../services/exploreService'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import AuthorCard from './AuthorCard'
import BlogPostCard from './BlogPostCard'
import { BookmarkItem } from './BookmarkItem'
import IconButton from './IconButton'
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
import { readingProgressController } from '../services/readingProgressController'

interface MeProps {
  relayPool: RelayPool
  eventStore: IEventStore
  activeTab?: TabType
  bookmarks: Bookmark[] // From centralized App.tsx state
  bookmarksLoading?: boolean // From centralized App.tsx state (reserved for future use)
}

type TabType = 'highlights' | 'reading-list' | 'reads' | 'links' | 'writings'

// Valid reading progress filters
const VALID_FILTERS: ReadingProgressFilterType[] = ['all', 'unopened', 'started', 'reading', 'completed', 'highlighted']

const Me: React.FC<MeProps> = ({ 
  relayPool, 
  eventStore,
  activeTab: propActiveTab,
  bookmarks
}) => {
  const activeAccount = Hooks.useActiveAccount()
  const navigate = useNavigate()
  const { filter: urlFilter } = useParams<{ filter?: string }>()
  const [activeTab, setActiveTab] = useState<TabType>(propActiveTab || 'highlights')
  
  // Only for own profile
  const viewingPubkey = activeAccount?.pubkey
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [reads, setReads] = useState<ReadItem[]>([])
  const [, setReadsMap] = useState<Map<string, ReadItem>>(new Map())
  const [links, setLinks] = useState<ReadItem[]>([])
  const [, setLinksMap] = useState<Map<string, ReadItem>>(new Map())
  const [writings, setWritings] = useState<BlogPostPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set())
  
  // Get myHighlights directly from controller
  const [myHighlights, setMyHighlights] = useState<Highlight[]>([])
  const [myHighlightsLoading, setMyHighlightsLoading] = useState(false)
  
  // Get myWritings directly from controller
  const [myWritings, setMyWritings] = useState<BlogPostPreview[]>([])
  const [myWritingsLoading, setMyWritingsLoading] = useState(false)
  
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [bookmarkFilter, setBookmarkFilter] = useState<BookmarkFilterType>('all')
  const [groupingMode, setGroupingMode] = useState<'grouped' | 'flat'>(() => {
    const saved = localStorage.getItem('bookmarkGroupingMode')
    return saved === 'flat' ? 'flat' : 'grouped'
  })
  
  const toggleGroupingMode = () => {
    const newMode = groupingMode === 'grouped' ? 'flat' : 'grouped'
    setGroupingMode(newMode)
    localStorage.setItem('bookmarkGroupingMode', newMode)
  }
  
  // Initialize reading progress filter from URL param
  const initialFilter = urlFilter && VALID_FILTERS.includes(urlFilter as ReadingProgressFilterType) 
    ? (urlFilter as ReadingProgressFilterType) 
    : 'all'
  const [readingProgressFilter, setReadingProgressFilter] = useState<ReadingProgressFilterType>(initialFilter)
  
  // Reading progress state for writings tab (naddr -> progress 0-1)
  const [readingProgressMap, setReadingProgressMap] = useState<Map<string, number>>(new Map())

  // Subscribe to highlights controller
  useEffect(() => {
    // Get initial state immediately
    setMyHighlights(highlightsController.getHighlights())
    
    // Subscribe to updates
    const unsubHighlights = highlightsController.onHighlights(setMyHighlights)
    const unsubLoading = highlightsController.onLoading(setMyHighlightsLoading)
    return () => {
      unsubHighlights()
      unsubLoading()
    }
  }, [])

  // Subscribe to writings controller
  useEffect(() => {
    // Get initial state immediately
    setMyWritings(writingsController.getWritings())
    
    // Subscribe to updates
    const unsubWritings = writingsController.onWritings(setMyWritings)
    const unsubLoading = writingsController.onLoading(setMyWritingsLoading)
    return () => {
      unsubWritings()
      unsubLoading()
    }
  }, [])

  // Update local state when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab)
    }
  }, [propActiveTab])

  // Sync filter state with URL changes
  useEffect(() => {
    const filterFromUrl = urlFilter && VALID_FILTERS.includes(urlFilter as ReadingProgressFilterType) 
      ? (urlFilter as ReadingProgressFilterType) 
      : 'all'
    setReadingProgressFilter(filterFromUrl)
  }, [urlFilter])

  // Handler to change reading progress filter and update URL
  const handleReadingProgressFilterChange = (filter: ReadingProgressFilterType) => {
    setReadingProgressFilter(filter)
    if (activeTab === 'reads') {
      if (filter === 'all') {
        navigate('/me/reads', { replace: true })
      } else {
        navigate(`/me/reads/${filter}`, { replace: true })
      }
    }
  }
  
  // Subscribe to reading progress controller
  useEffect(() => {
    // Get initial state immediately
    setReadingProgressMap(readingProgressController.getProgressMap())
    
    // Subscribe to updates
    const unsubProgress = readingProgressController.onProgress(setReadingProgressMap)
    
    return () => {
      unsubProgress()
    }
  }, [])
  
  // Load reading progress data for writings tab
  useEffect(() => {
    if (!viewingPubkey) {
      return
    }
    
    readingProgressController.start({
      relayPool,
      eventStore,
      pubkey: viewingPubkey,
      force: refreshTrigger > 0
    })
  }, [viewingPubkey, relayPool, eventStore, refreshTrigger])

  // Tab-specific loading functions
  const loadHighlightsTab = async () => {
    if (!viewingPubkey) return
    
    // Highlights come from controller subscription (sync effect handles it)
    setLoadedTabs(prev => new Set(prev).add('highlights'))
    setLoading(false)
  }

  const loadWritingsTab = async () => {
    if (!viewingPubkey) return
    
    try {
      // Use centralized controller
      await writingsController.start({ 
        relayPool, 
        eventStore, 
        pubkey: viewingPubkey,
        force: refreshTrigger > 0
      })
      setLoadedTabs(prev => new Set(prev).add('writings'))
      setLoading(false)
    } catch (err) {
      console.error('Failed to load writings:', err)
      setLoading(false)
    }
  }

  const loadReadingListTab = async () => {
    if (!viewingPubkey || !activeAccount) return
    
    const hasBeenLoaded = loadedTabs.has('reading-list')
    
    try {
      if (!hasBeenLoaded) setLoading(true)
      // Bookmarks come from centralized loading in App.tsx
      setLoadedTabs(prev => new Set(prev).add('reading-list'))
    } catch (err) {
      console.error('Failed to load reading list:', err)
    } finally {
      if (!hasBeenLoaded) setLoading(false)
    }
  }

  const loadReadsTab = async () => {
    if (!viewingPubkey || !activeAccount) return
    
    const hasBeenLoaded = loadedTabs.has('reads')
    
    try {
      if (!hasBeenLoaded) setLoading(true)
      
      // Derive reads from bookmarks immediately (bookmarks come from centralized loading in App.tsx)
      const initialReads = deriveReadsFromBookmarks(bookmarks)
      const initialMap = new Map(initialReads.map(item => [item.id, item]))
      setReadsMap(initialMap)
      setReads(initialReads)
      setLoadedTabs(prev => new Set(prev).add('reads'))
      if (!hasBeenLoaded) setLoading(false)
      
      // Background enrichment: merge reading progress and mark-as-read
      // Only update items that are already in our map
      fetchAllReads(relayPool, viewingPubkey, bookmarks, (item) => {
        setReadsMap(prevMap => {
          // Only update if item exists in our current map
          if (!prevMap.has(item.id)) {
            return prevMap
          }
          
          const newMap = new Map(prevMap)
          const merged = mergeReadItem(newMap, item)
          if (merged) {
            // Update reads array after map is updated
            setReads(Array.from(newMap.values()))
            return newMap
          }
          return prevMap
        })
      }).catch(err => console.warn('Failed to enrich reads:', err))
      
    } catch (err) {
      console.error('Failed to load reads:', err)
      if (!hasBeenLoaded) setLoading(false)
    }
  }

  const loadLinksTab = async () => {
    if (!viewingPubkey || !activeAccount) return
    
    const hasBeenLoaded = loadedTabs.has('links')
    
    try {
      if (!hasBeenLoaded) setLoading(true)
      
      // Derive links from bookmarks immediately (bookmarks come from centralized loading in App.tsx)
      const initialLinks = deriveLinksFromBookmarks(bookmarks)
      const initialMap = new Map(initialLinks.map(item => [item.id, item]))
      setLinksMap(initialMap)
      setLinks(initialLinks)
      setLoadedTabs(prev => new Set(prev).add('links'))
      if (!hasBeenLoaded) setLoading(false)
      
      // Background enrichment: merge reading progress and mark-as-read
      // Only update items that are already in our map
      fetchLinks(relayPool, viewingPubkey, (item) => {
        setLinksMap(prevMap => {
          // Only update if item exists in our current map
          if (!prevMap.has(item.id)) return prevMap
          
          const newMap = new Map(prevMap)
          if (mergeReadItem(newMap, item)) {
            // Update links array after map is updated
            setLinks(Array.from(newMap.values()))
            return newMap
          }
          return prevMap
        })
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
    const cached = getCachedMeData(viewingPubkey)
    if (cached) {
      setHighlights(cached.highlights)
      // Bookmarks come from App.tsx centralized state, no local caching needed
      setReads(cached.reads || [])
      setLinks(cached.links || [])
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
  }, [activeTab, viewingPubkey, refreshTrigger, bookmarks])

  // Sync myHighlights from controller
  useEffect(() => {
    setHighlights(myHighlights)
  }, [myHighlights])

  // Sync myWritings from controller
  useEffect(() => {
    setWritings(myWritings)
  }, [myWritings])

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
      // Update cache when highlight is deleted
      if (viewingPubkey) {
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
    if (item.type === 'article') {
      // ID is already in naddr format
      return `/a/${item.id}`
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
  
  // Helper to get reading progress for a post
  const getWritingReadingProgress = (post: BlogPostPreview): number | undefined => {
    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1]
    if (!dTag) return undefined
    
    try {
      const naddr = nip19.naddrEncode({
        kind: 30023,
        pubkey: post.author,
        identifier: dTag
      })
      return readingProgressMap.get(naddr)
    } catch (err) {
      return undefined
    }
  }

  // Helper to get reading progress for a bookmark
  const getBookmarkReadingProgress = (bookmark: IndividualBookmark): number | undefined => {
    if (bookmark.kind === 30023) {
      const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1]
      if (!dTag) return undefined
      try {
        const naddr = nip19.naddrEncode({
          kind: 30023,
          pubkey: bookmark.pubkey,
          identifier: dTag
        })
        return readingProgressMap.get(naddr)
      } catch (err) {
        return undefined
      }
    }
    return undefined
  }

  // Merge and flatten all individual bookmarks
  const allIndividualBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
    .filter(hasContent)
  
  // Apply bookmark filter
  const filteredBookmarks = filterBookmarksByType(allIndividualBookmarks, bookmarkFilter)
  
  const groups = groupIndividualBookmarks(filteredBookmarks)

  // Enrich reads and links with reading progress from controller
  const readsWithProgress = reads.map(item => {
    if (item.type === 'article' && item.author) {
      const progress = readingProgressMap.get(item.id)
      if (progress !== undefined) {
        return { ...item, readingProgress: progress }
      }
    }
    return item
  })
  
  const linksWithProgress = links.map(item => {
    if (item.url) {
      const progress = readingProgressMap.get(item.url)
      if (progress !== undefined) {
        return { ...item, readingProgress: progress }
      }
    }
    return item
  })

  // Apply reading progress filter
  const filteredReads = filterByReadingProgress(readsWithProgress, readingProgressFilter, highlights)
  const filteredLinks = filterByReadingProgress(linksWithProgress, readingProgressFilter, highlights)
  const sections: Array<{ key: string; title: string; items: IndividualBookmark[] }> = 
    groupingMode === 'flat'
      ? [{ key: 'all', title: `All Bookmarks (${filteredBookmarks.length})`, items: filteredBookmarks }]
      : [
          { key: 'nip51-private', title: 'Private Bookmarks', items: groups.nip51Private },
          { key: 'nip51-public', title: 'My Bookmarks', items: groups.nip51Public },
          { key: 'amethyst-private', title: 'Private Lists', items: groups.amethystPrivate },
          { key: 'amethyst-public', title: 'My Lists', items: groups.amethystPublic },
          { key: 'web', title: 'Web Bookmarks', items: groups.standaloneWeb }
        ]

  // Show content progressively - no blocking error screens
  const hasData = highlights.length > 0 || bookmarks.length > 0 || reads.length > 0 || links.length > 0 || writings.length > 0
  const showSkeletons = (loading || myHighlightsLoading) && !hasData

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
        return highlights.length === 0 && !loading && !myHighlightsLoading ? (
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
              <div className="bookmarks-grid bookmarks-cards">
                {Array.from({ length: 6 }).map((_, i) => (
                  <BookmarkSkeleton key={i} viewMode="cards" />
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
                <div className="bookmarks-grid bookmarks-cards">
                  {section.items.map((individualBookmark, index) => (
                    <BookmarkItem
                      key={`${section.key}-${individualBookmark.id}-${index}`}
                      bookmark={individualBookmark}
                      index={index}
                      viewMode="cards"
                      onSelectUrl={handleSelectUrl}
                      readingProgress={getBookmarkReadingProgress(individualBookmark)}
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
                icon={groupingMode === 'grouped' ? faLayerGroup : faBars}
                onClick={toggleGroupingMode}
                title={groupingMode === 'grouped' ? 'Show flat chronological list' : 'Show grouped by source'}
                ariaLabel={groupingMode === 'grouped' ? 'Switch to flat view' : 'Switch to grouped view'}
                variant="ghost"
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
              onFilterChange={handleReadingProgressFilterChange}
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
              onFilterChange={handleReadingProgressFilterChange}
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
        return writings.length === 0 && !loading && !myWritingsLoading ? (
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
                readingProgress={getWritingReadingProgress(post)}
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
            onClick={() => navigate('/me/highlights')}
          >
            <FontAwesomeIcon icon={faHighlighter} />
            <span className="tab-label">Highlights</span>
          </button>
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
          <button
            className={`me-tab ${activeTab === 'writings' ? 'active' : ''}`}
            data-tab="writings"
            onClick={() => navigate('/me/writings')}
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

