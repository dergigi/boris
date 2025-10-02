import React from 'react'
import { Bookmark, ActiveAccount } from '../types/bookmarks'
import { BookmarkItem } from './BookmarkItem'
import { formatDate, renderParsedContent } from '../utils/bookmarkUtils'

interface BookmarkListProps {
  bookmarks: Bookmark[]
  activeAccount: ActiveAccount | null
  onLogout: () => void
  formatUserDisplay: () => string
}

export const BookmarkList: React.FC<BookmarkListProps> = ({ 
  bookmarks, 
  activeAccount, 
  onLogout, 
  formatUserDisplay 
}) => {
  return (
    <div className="bookmarks-container">
      <div className="bookmarks-header">
        <div>
          <h2>Your Bookmarks ({bookmarks.length})</h2>
          {activeAccount && (
            <p className="user-info">Logged in as: {formatUserDisplay()}</p>
          )}
        </div>
        <button onClick={onLogout} className="logout-button">
          Logout
        </button>
      </div>
      
      {bookmarks.length === 0 ? (
        <div className="empty-state">
          <p>No bookmarks found.</p>
          <p>Add bookmarks using your nostr client to see them here.</p>
        </div>
      ) : (
        <div className="bookmarks-list">
          {bookmarks.map((bookmark, index) => (
            <div key={`${bookmark.id}-${index}`} className="bookmark-item">
              <h3>{bookmark.title}</h3>
              {bookmark.bookmarkCount && (
                <p className="bookmark-count">
                  {bookmark.bookmarkCount} bookmarks in this list
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
                  <h4>Individual Bookmarks ({bookmark.individualBookmarks.length}):</h4>
                  <div className="bookmarks-grid">
                    {bookmark.individualBookmarks.map((individualBookmark, index) => 
                      <BookmarkItem key={index} bookmark={individualBookmark} index={index} />
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
