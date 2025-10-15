import React, { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faBookmark, faList, faThLarge, faImage, faRotate, faHeart } from '@fortawesome/free-solid-svg-icons'
import { formatDistanceToNow } from 'date-fns'
import { RelayPool } from 'applesauce-relay'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import { BookmarkItem } from './BookmarkItem'
import SidebarHeader from './SidebarHeader'
import IconButton from './IconButton'
import { ViewMode } from './Bookmarks'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'
import { BookmarkSkeleton } from './Skeletons'
import { groupIndividualBookmarks, hasContent, getBookmarkSets, getBookmarksWithoutSet } from '../utils/bookmarkUtils'
import { UserSettings } from '../services/settingsService'

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
  
  // Separate bookmarks with setName (kind 30003) from regular bookmarks
  const bookmarksWithoutSet = getBookmarksWithoutSet(allIndividualBookmarks)
  const bookmarkSets = getBookmarkSets(allIndividualBookmarks)
  
  // Group non-set bookmarks as before
  const groups = groupIndividualBookmarks(bookmarksWithoutSet)
  const sections: Array<{ key: string; title: string; items: IndividualBookmark[] }> = [
    { key: 'private', title: 'Private bookmarks', items: groups.privateItems },
    { key: 'public', title: 'Public bookmarks', items: groups.publicItems },
    { key: 'web', title: 'Web bookmarks', items: groups.web },
    { key: 'amethyst', title: 'Amethyst-style bookmarks', items: groups.amethyst }
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
        relayPool={relayPool}
        isMobile={isMobile}
      />
      
      {allIndividualBookmarks.length === 0 ? (
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
            <p>If you aren't on nostr yet, start here: <a href="https://nstart.me/" target="_blank" rel="noopener noreferrer">nstart.me</a></p>
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
              <h3 className="bookmarks-section-title">{section.title}</h3>
              <div className={`bookmarks-grid bookmarks-${viewMode}`}>
                {section.items.map((individualBookmark, index) => (
                  <BookmarkItem 
                    key={`${section.key}-${individualBookmark.id}-${index}`}
                    bookmark={individualBookmark} 
                    index={index} 
                    onSelectUrl={onSelectUrl}
                    viewMode={viewMode}
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
        <div className="view-mode-right">
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
      </div>
    </div>
  )
}
