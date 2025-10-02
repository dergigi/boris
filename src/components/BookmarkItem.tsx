import React from 'react'
import { IndividualBookmark } from '../types/bookmarks'
import { formatDate, renderParsedContent } from '../utils/bookmarkUtils'

interface BookmarkItemProps {
  bookmark: IndividualBookmark
  index: number
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookmark, index }) => {
  return (
    <div key={`${bookmark.id}-${index}`} className={`individual-bookmark ${bookmark.isPrivate ? 'private-bookmark' : ''}`}>
      <div className="bookmark-header">
        <span className="bookmark-type">
          {bookmark.type}
          {bookmark.isPrivate && <span className="private-indicator">🔒</span>}
        </span>
        <span className="bookmark-id">{bookmark.id.slice(0, 8)}...{bookmark.id.slice(-8)}</span>
        <span className="bookmark-date">{formatDate(bookmark.created_at)}</span>
      </div>
      
      {bookmark.parsedContent ? (
        <div className="bookmark-content">
          {renderParsedContent(bookmark.parsedContent)}
        </div>
      ) : bookmark.content && (
        <div className="bookmark-content">
          <p>{bookmark.content}</p>
        </div>
      )}
      
      <div className="bookmark-meta">
        <span>Kind: {bookmark.kind}</span>
        <span>Author: {bookmark.pubkey.slice(0, 8)}...{bookmark.pubkey.slice(-8)}</span>
      </div>
    </div>
  )
}
