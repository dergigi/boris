import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faBookmark, faList, faThLarge, faImage, faRotate, faHeart, faPlus, faLayerGroup, faBars } from '@fortawesome/free-solid-svg-icons'
import { formatDistanceToNow } from 'date-fns'
import { RelayPool } from 'applesauce-relay'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import { BookmarkItem } from './BookmarkItem'
import SidebarHeader from './SidebarHeader'
import IconButton from './IconButton'
import CompactButton from './CompactButton'
import { ViewMode } from './Bookmarks'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'
import { BookmarkSkeleton } from './Skeletons'
import { groupIndividualBookmarks, hasContent, getBookmarkSets, getBookmarksWithoutSet, hasCreationDate } from '../utils/bookmarkUtils'
import { UserSettings } from '../services/settingsService'
import AddBookmarkModal from './AddBookmarkModal'
import { createWebBookmark } from '../services/webBookmarkService'
import { Hooks } from 'applesauce-react'
import { getActiveRelayUrls } from '../services/relayManager'
import BookmarkFilters, { BookmarkFilterType } from './BookmarkFilters'
import { filterBookmarksByType } from '../utils/bookmarkTypeClassifier'
import LoginOptions from './LoginOptions'
import { useEffect } from 'react'
import { readingProgressController } from '../services/readingProgressController'
import { nip19 } from 'nostr-tools'
import { extractUrlsFromContent } from '../services/bookmarkHelpers'

interface BookmarkListProps {
  bookmarks: Bookmark[]
  onSelectUrl?: (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onLogout: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  selectedUrl?: string
  onOpenSettings: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
  lastFetchTime?: number | null
  loading?: boolean
  relayPool: RelayPool | null
  isMobile?: boolean
  settings?: UserSettings
}

export const BookmarkList: React.FC<BookmarkListProps> = ({
  bookmarks,
  onSelectUrl,
  isCollapsed,
  onToggleCollapse,
  onLogout,
  viewMode,
  onViewModeChange,
  selectedUrl,
  onOpenSettings,
  onRefresh,
  isRefreshing,
  lastFetchTime,
  loading = false,
  relayPool,
  isMobile = false,
  settings
}) => {
  const navigate = useNavigate()
  const bookmarksListRef = useRef<HTMLDivElement>(null)
  const friendsColor = settings?.highlightColorFriends || '#f97316'
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<BookmarkFilterType>('all')
  const [groupingMode, setGroupingMode] = useState<'grouped' | 'flat'>(() => {
    const saved = localStorage.getItem('bookmarkGroupingMode')
    return saved === 'flat' ? 'flat' : 'grouped'
  })
  const activeAccount = Hooks.useActiveAccount()
  const [readingProgressMap, setReadingProgressMap] = useState<Map<string, number>>(new Map())

  // Subscribe to reading progress updates
  useEffect(() => {
    // Get initial progress map
    setReadingProgressMap(readingProgressController.getProgressMap())
    
    // Subscribe to updates
    const unsubProgress = readingProgressController.onProgress(setReadingProgressMap)
    
    return () => {
      unsubProgress()
    }
  }, [])

  // Helper to get reading progress for a bookmark
  const getBookmarkReadingProgress = (bookmark: IndividualBookmark): number | undefined => {
    if (bookmark.kind === 30023) {
      // For articles, use naddr as key
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
    // For web bookmarks and other types, try to use URL if available
    const urls = extractUrlsFromContent(bookmark.content)
    if (urls.length > 0) {
      return readingProgressMap.get(urls[0])
    }
    return undefined
  }

  const toggleGroupingMode = () => {
    const newMode = groupingMode === 'grouped' ? 'flat' : 'grouped'
    setGroupingMode(newMode)
    localStorage.setItem('bookmarkGroupingMode', newMode)
  }

  const handleSaveBookmark = async (url: string, title?: string, description?: string, tags?: string[]) => {
    if (!activeAccount || !relayPool) {
      throw new Error('Please login to create bookmarks')
    }

    await createWebBookmark(url, title, description, tags, activeAccount, relayPool, getActiveRelayUrls(relayPool))
  }

  // Pull-to-refresh for bookmarks
  const { isRefreshing: isPulling, pullPosition } = usePullToRefresh({
    onRefresh: () => {
      if (onRefresh) {
        onRefresh()
      }
    },
    maximumPullLength: 240,
    refreshThreshold: 80,
    isDisabled: !onRefresh
  })

  // Merge and flatten all individual bookmarks from all lists
  const allIndividualBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
    .filter(hasContent)
    .filter(b => !settings?.hideBookmarksWithoutCreationDate || hasCreationDate(b))
  
  // Debug: log kind:1 events in allIndividualBookmarks
  const kind1Bookmarks = allIndividualBookmarks.filter(b => b.kind === 1)
  if (kind1Bookmarks.length > 0) {
    console.log('📊 BookmarkList kind:1 events after filtering:', {
      total: kind1Bookmarks.length,
      samples: kind1Bookmarks.slice(0, 3).map(b => ({
        id: b.id.slice(0, 8),
        content: b.content?.slice(0, 30),
        hasUrls: extractUrlsFromContent(b.content).length > 0
      }))
    })
  }
  
  // Apply filter
  const filteredBookmarks = filterBookmarksByType(allIndividualBookmarks, selectedFilter)
  
  // Separate bookmarks with setName (kind 30003) from regular bookmarks
  const bookmarksWithoutSet = getBookmarksWithoutSet(filteredBookmarks)
  const bookmarkSets = getBookmarkSets(filteredBookmarks)
  
  // Group non-set bookmarks by source or flatten based on mode
  const groups = groupIndividualBookmarks(bookmarksWithoutSet)
  const sections: Array<{ key: string; title: string; items: IndividualBookmark[] }> = 
    groupingMode === 'flat'
      ? [{ key: 'all', title: `All Bookmarks (${bookmarksWithoutSet.length})`, items: bookmarksWithoutSet }]
      : [
          { key: 'nip51-private', title: 'Private Bookmarks', items: groups.nip51Private },
          { key: 'nip51-public', title: 'My Bookmarks', items: groups.nip51Public },
          { key: 'amethyst-private', title: 'Private Lists', items: groups.amethystPrivate },
          { key: 'amethyst-public', title: 'My Lists', items: groups.amethystPublic },
          { key: 'web', title: 'Web Bookmarks', items: groups.standaloneWeb }
        ]
  
  // Add bookmark sets as additional sections
  bookmarkSets.forEach(set => {
    sections.push({
      key: `set-${set.name}`,
      title: set.title || set.name,
      items: set.bookmarks
    })
  })
  
  if (isCollapsed) {
    // Check if the selected URL is in bookmarks
    const isBookmarked = selectedUrl && bookmarks.some(bookmark => {
      const bookmarkUrl = bookmark.url
      return bookmarkUrl === selectedUrl || selectedUrl.includes(bookmarkUrl) || bookmarkUrl.includes(selectedUrl)
    })
    
    return (
      <div className="bookmarks-container collapsed">
        <button 
          onClick={onToggleCollapse}
          className={`toggle-sidebar-btn with-icon ${isBookmarked ? 'is-bookmarked' : ''}`}
          title="Expand bookmarks sidebar"
          aria-label="Expand bookmarks sidebar"
        >
          <FontAwesomeIcon icon={faChevronLeft} />
          <FontAwesomeIcon icon={faBookmark} className={isBookmarked ? 'glow-blue' : ''} />
        </button>
      </div>
    )
  }

  return (
    <div className="bookmarks-container">
      <SidebarHeader 
        onToggleCollapse={onToggleCollapse} 
        onLogout={onLogout}
        onOpenSettings={onOpenSettings}
        isMobile={isMobile}
      />
      
      {allIndividualBookmarks.length > 0 && (
        <BookmarkFilters
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
        />
      )}
      
      {!activeAccount ? (
        <LoginOptions />
      ) : filteredBookmarks.length === 0 && allIndividualBookmarks.length > 0 ? (
        <div className="empty-state">
          <p>No bookmarks match this filter.</p>
        </div>
      ) : allIndividualBookmarks.length === 0 ? (
        loading ? (
          <div className={`bookmarks-list ${viewMode}`} aria-busy="true">
            <div className={`bookmarks-grid bookmarks-${viewMode}`}>
              {Array.from({ length: viewMode === 'large' ? 4 : viewMode === 'cards' ? 6 : 8 }).map((_, i) => (
                <BookmarkSkeleton key={i} viewMode={viewMode} />
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p>No bookmarks found.</p>
            <p>Add bookmarks using your nostr client to see them here.</p>
          </div>
        )
      ) : (
        <div 
          ref={bookmarksListRef}
          className="bookmarks-list"
        >
          <RefreshIndicator
            isRefreshing={isPulling || isRefreshing || false}
            pullPosition={pullPosition}
          />
          {sections.filter(s => s.items.length > 0).map(section => (
            <div key={section.key} className="bookmarks-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="bookmarks-section-title" style={{ margin: 0, padding: '1.5rem 0.5rem 0.375rem', flex: 1 }}>{section.title}</h3>
                {section.key === 'web' && activeAccount && (
                  <CompactButton
                    icon={faPlus}
                    onClick={() => setShowAddModal(true)}
                    title="Add web bookmark"
                    ariaLabel="Add web bookmark"
                    className="bookmark-section-action"
                  />
                )}
              </div>
              <div className={`bookmarks-grid bookmarks-${viewMode}`}>
                {section.items.map((individualBookmark, index) => (
                  <BookmarkItem 
                    key={`${section.key}-${individualBookmark.id}-${index}`}
                    bookmark={individualBookmark} 
                    index={index} 
                    onSelectUrl={onSelectUrl}
                    viewMode={viewMode}
                    readingProgress={getBookmarkReadingProgress(individualBookmark)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="view-mode-controls">
        <div className="view-mode-left">
          <IconButton
            icon={faHeart}
            onClick={() => navigate('/support')}
            title="Support Boris"
            ariaLabel="Support"
            variant="ghost"
            style={{ color: friendsColor }}
          />
        </div>
        {activeAccount && (
          <div className="view-mode-right">
            <IconButton
              icon={groupingMode === 'grouped' ? faLayerGroup : faBars}
              onClick={toggleGroupingMode}
              title={groupingMode === 'grouped' ? 'Show flat chronological list' : 'Show grouped by source'}
              ariaLabel={groupingMode === 'grouped' ? 'Switch to flat view' : 'Switch to grouped view'}
              variant="ghost"
            />
            {onRefresh && (
              <IconButton
                icon={faRotate}
                onClick={onRefresh}
                title={lastFetchTime ? `Refresh bookmarks (updated ${formatDistanceToNow(lastFetchTime, { addSuffix: true })})` : 'Refresh bookmarks'}
                ariaLabel="Refresh bookmarks"
                variant="ghost"
                disabled={isRefreshing}
                spin={isRefreshing}
              />
            )}
            <IconButton
              icon={faList}
              onClick={() => onViewModeChange('compact')}
              title="Compact list view"
              ariaLabel="Compact list view"
              variant={viewMode === 'compact' ? 'primary' : 'ghost'}
            />
            <IconButton
              icon={faThLarge}
              onClick={() => onViewModeChange('cards')}
              title="Cards view"
              ariaLabel="Cards view"
              variant={viewMode === 'cards' ? 'primary' : 'ghost'}
            />
            <IconButton
              icon={faImage}
              onClick={() => onViewModeChange('large')}
              title="Large preview view"
              ariaLabel="Large preview view"
              variant={viewMode === 'large' ? 'primary' : 'ghost'}
            />
          </div>
        )}
      </div>
      {showAddModal && (
        <AddBookmarkModal
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveBookmark}
        />
      )}
    </div>
  )
}
