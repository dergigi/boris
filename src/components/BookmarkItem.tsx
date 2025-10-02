import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faBookmark, 
  faUserLock, 
  faCircleUser,
  faFeather,
  faRetweet,
  faHeart,
  faImage,
  faVideo,
  faFile,
  faLaptopCode,
  faCodePullRequest,
  faBug,
  faExclamationTriangle,
  faBolt,
  faCloudBolt,
  faHighlighter,
  faNewspaper,
  faEyeSlash,
  faThumbtack
} from '@fortawesome/free-solid-svg-icons'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'
import { IndividualBookmark } from '../types/bookmarks'
import { formatDate, renderParsedContent } from '../utils/bookmarkUtils'
import ContentWithResolvedProfiles from './ContentWithResolvedProfiles'
import { extractUrlsFromContent } from '../services/bookmarkHelpers'

interface BookmarkItemProps {
  bookmark: IndividualBookmark
  index: number
  onSelectUrl?: (url: string) => void
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookmark, index, onSelectUrl }) => {
  const [expanded, setExpanded] = useState(false)
  // removed copy-to-clipboard buttons

  const short = (v: string) => `${v.slice(0, 8)}...${v.slice(-8)}`
  
  // Extract URLs from bookmark content
  const extractedUrls = extractUrlsFromContent(bookmark.content)
  const hasUrls = extractedUrls.length > 0

  // Resolve author profile using applesauce
  const authorProfile = useEventModel(Models.ProfileModel, [bookmark.pubkey])
  
  // Get display name for author
  const getAuthorDisplayName = () => {
    if (authorProfile?.name) return authorProfile.name
    if (authorProfile?.display_name) return authorProfile.display_name
    if (authorProfile?.nip05) return authorProfile.nip05
    return short(bookmark.pubkey) // fallback to short pubkey
  }

  // Map kind numbers to FontAwesome icons
  const getKindIcon = (kind: number) => {
    const iconMap: Record<number, import('@fortawesome/fontawesome-svg-core').IconDefinition> = {
      0: faCircleUser,
      1: faFeather,
      6: faRetweet,
      7: faHeart,
      20: faImage,
      21: faVideo,
      22: faVideo,
      1063: faFile,
      1337: faLaptopCode,
      1617: faCodePullRequest,
      1621: faBug,
      1984: faExclamationTriangle,
      9735: faBolt,
      9321: faCloudBolt,
      9802: faHighlighter,
      30023: faNewspaper,
      10000: faEyeSlash,
      10001: faThumbtack,
      10003: faBookmark
    }
    return iconMap[kind] || faFile // fallback to file icon
  }

  const handleReadNow = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasUrls) return
    const firstUrl = extractedUrls[0]
    if (onSelectUrl) {
      event.preventDefault()
      onSelectUrl(firstUrl)
    } else {
      window.open(firstUrl, '_blank')
    }
  }

  return (
    <div key={`${bookmark.id}-${index}`} className={`individual-bookmark ${bookmark.isPrivate ? 'private-bookmark' : ''}`}>
      <div className="bookmark-header">
        <span className="bookmark-type">
          {bookmark.isPrivate ? (
            <>
              <FontAwesomeIcon icon={faBookmark} className="bookmark-visibility public" />
              <FontAwesomeIcon icon={faUserLock} className="bookmark-visibility private" />
            </>
          ) : (
            <FontAwesomeIcon icon={faBookmark} className="bookmark-visibility public" />
          )}
        </span>
        <span className="bookmark-id">
          {short(bookmark.id)}
        </span>
        <span className="bookmark-date">{formatDate(bookmark.created_at)}</span>
      </div>
      
      {extractedUrls.length > 0 && (
        <div className="bookmark-urls">
          <h4>URLs:</h4>
          {extractedUrls.map((url, urlIndex) => (
            <a
              key={urlIndex}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="bookmark-url"
              onClick={(e) => { if (onSelectUrl) { e.preventDefault(); onSelectUrl(url) } }}
            >
              {url}
            </a>
          ))}
        </div>
      )}
      
      {bookmark.parsedContent ? (
        <div className="bookmark-content">
          {renderParsedContent(bookmark.parsedContent)}
        </div>
      ) : bookmark.content && (
        <>
          <ContentWithResolvedProfiles content={(expanded || bookmark.content.length <= 210) ? bookmark.content : `${bookmark.content.slice(0, 210).trimEnd()}…`} />
          {bookmark.content.length > 210 && (
            <button
              className="expand-toggle"
              onClick={() => setExpanded(v => !v)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} />
            </button>
          )}
        </>
      )}
      
      <div className="bookmark-meta">
        <span className="kind-icon">
          <FontAwesomeIcon icon={getKindIcon(bookmark.kind)} />
        </span>
        <span>
          by: {getAuthorDisplayName()}
        </span>
      </div>

      {hasUrls && (
        <div className="read-now">
          <button className="read-now-button" onClick={handleReadNow}>
            READ NOW
          </button>
        </div>
      )}
    </div>
  )
}
