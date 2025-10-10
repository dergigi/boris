import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faBookmark, faSpinner, faList, faThLarge, faImage, faRotate } from '@fortawesome/free-solid-svg-icons'
import { formatDistanceToNow } from 'date-fns'
import { RelayPool } from 'applesauce-relay'
import { Bookmark, IndividualBookmark } from '../types/bookmarks'
import { BookmarkItem } from './BookmarkItem'
import SidebarHeader from './SidebarHeader'
import IconButton from './IconButton'
import { ViewMode } from './Bookmarks'
import { extractUrlsFromContent } from '../services/bookmarkHelpers'
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
  settings?: UserSettings
  isMobile?: boolean
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
  settings,
  isMobile = false
}) => {
  // Helper to check if a bookmark has either content or a URL
  const hasContentOrUrl = (ib: IndividualBookmark) => {
    // Check if has content (text)
    const hasContent = ib.content && ib.content.trim().length > 0
    
    // Check if has URL
    let hasUrl = false
    
    // For web bookmarks (kind:39701), URL is in the 'd' tag
    if (ib.kind === 39701) {
      const dTag = ib.tags?.find((t: string[]) => t[0] === 'd')?.[1]
      hasUrl = !!dTag && dTag.trim().length > 0
    } else {
      // For other bookmarks, extract URLs from content
      const urls = extractUrlsFromContent(ib.content || '')
      hasUrl = urls.length > 0
    }
    
    // Always show articles (kind:30023) as they have special handling
    if (ib.kind === 30023) return true
    
    // Otherwise, must have either content or URL
    return hasContent || hasUrl
  }
  
  // Merge and flatten all individual bookmarks from all lists
  // Re-sort after flattening to ensure newest first across all lists
  const allIndividualBookmarks = bookmarks.flatMap(b => b.individualBookmarks || [])
    .filter(hasContentOrUrl)
    .sort((a, b) => ((b.added_at || 0) - (a.added_at || 0)) || ((b.created_at || 0) - (a.created_at || 0)))
  
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
      
      {loading ? (
        <div className="loading">
          <FontAwesomeIcon icon={faSpinner} spin />
        </div>
      ) : allIndividualBookmarks.length === 0 ? (
        <div className="empty-state">
          <p>No bookmarks found.</p>
          <p>Add bookmarks using your nostr client to see them here.</p>
          <p>If you aren't on nostr yet, start here: <a href="https://nstart.me/" target="_blank" rel="noopener noreferrer">nstart.me</a></p>
        </div>
      ) : (
        <div className="bookmarks-list">
          <div className={`bookmarks-grid bookmarks-${viewMode}`}>
            {allIndividualBookmarks.map((individualBookmark, index) => 
              <BookmarkItem 
                key={`${individualBookmark.id}-${index}`}
                bookmark={individualBookmark} 
                index={index} 
                onSelectUrl={onSelectUrl}
                viewMode={viewMode}
                settings={settings}
              />
            )}
          </div>
          {onRefresh && (
            <div className="refresh-section" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '1rem',
              marginTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)'
            }}>
              <IconButton
                icon={faRotate}
                onClick={onRefresh}
                title="Refresh bookmarks"
                ariaLabel="Refresh bookmarks"
                variant="ghost"
                disabled={isRefreshing}
                spin={isRefreshing}
              />
              {lastFetchTime && (
                <span>
                  Updated {formatDistanceToNow(lastFetchTime, { addSuffix: true })}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      <div className="view-mode-controls">
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
  )
}
