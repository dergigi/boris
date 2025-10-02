import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faGlobe, faCopy } from '@fortawesome/free-solid-svg-icons'
import { IndividualBookmark } from '../types/bookmarks'
import { formatDate, renderParsedContent } from '../utils/bookmarkUtils'

interface BookmarkItemProps {
  bookmark: IndividualBookmark
  index: number
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookmark, index }) => {
  const copy = async (text: string) => {
    try { 
      await navigator.clipboard.writeText(text) 
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error)
    }
  }

  const short = (v: string) => `${v.slice(0, 8)}...${v.slice(-8)}`

  return (
    <div key={`${bookmark.id}-${index}`} className={`individual-bookmark ${bookmark.isPrivate ? 'private-bookmark' : ''}`}>
      <div className="bookmark-header">
        <span className="bookmark-type">
          <FontAwesomeIcon icon={bookmark.isPrivate ? faLock : faGlobe} className={`bookmark-visibility ${bookmark.isPrivate ? 'private' : 'public'}`} />
        </span>
        <span className="bookmark-id">
          {short(bookmark.id)}
          <button className="copy-btn" onClick={() => copy(bookmark.id)} title="Copy event id">
            <FontAwesomeIcon icon={faCopy} />
          </button>
        </span>
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
        <span>
          Author: {short(bookmark.pubkey)}
          <button className="copy-btn" onClick={() => copy(bookmark.pubkey)} title="Copy author pubkey">
            <FontAwesomeIcon icon={faCopy} />
          </button>
        </span>
      </div>
    </div>
  )
}
