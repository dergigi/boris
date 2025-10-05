import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faBookmark } from '@fortawesome/free-solid-svg-icons'
import { Bookmark } from '../types/bookmarks'
import { BookmarkItem } from './BookmarkItem'
import { formatDate, renderParsedContent } from '../utils/bookmarkUtils'
import SidebarHeader from './SidebarHeader'
import { ViewMode } from './Bookmarks'

interface BookmarkListProps {
  bookmarks: Bookmark[]
  onSelectUrl?: (url: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onLogout: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  selectedUrl?: string
  onOpenSettings: () => void
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
  onOpenSettings
}) => {
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
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onOpenSettings={onOpenSettings}
      />
      
      {bookmarks.length === 0 ? (
        <div className="empty-state">
          <p>No bookmarks found.</p>
          <p>Add bookmarks using your nostr client to see them here.</p>
        </div>
      ) : (
        <div className="bookmarks-list">
          {bookmarks.map((bookmark, index) => (
            <div key={`${bookmark.id}-${index}`} className="bookmark-item">
              {bookmark.bookmarkCount && (
                <p className="bookmark-count">
                  {bookmark.bookmarkCount} bookmarks in{' '}
                  <a 
                    href={`https://search.dergigi.com/e/${bookmark.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-link"
                  >
                    this list
                  </a>
                  :
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
              {bookmark.individualBookmarks && bookmark.individualBookmarks.length > 0 && (
                <div className="individual-bookmarks">
                  <div className={`bookmarks-grid bookmarks-${viewMode}`}>
                    {bookmark.individualBookmarks.map((individualBookmark, index) => 
                      <BookmarkItem 
                        key={index} 
                        bookmark={individualBookmark} 
                        index={index} 
                        onSelectUrl={onSelectUrl}
                        viewMode={viewMode}
                      />
                    )}
                  </div>
                </div>
              )}
              {bookmark.eventReferences && bookmark.eventReferences.length > 0 && bookmark.individualBookmarks?.length === 0 && (
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
              {bookmark.parsedContent ? (
                <div className="bookmark-content">
                  {renderParsedContent(bookmark.parsedContent)}
                </div>
              ) : bookmark.content && (
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
