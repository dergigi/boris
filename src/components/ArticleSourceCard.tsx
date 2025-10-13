import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLink, faHighlighter, faFile } from '@fortawesome/free-solid-svg-icons'

interface ArticleSourceCardProps {
  url: string
  highlightCount: number
  isSelected: boolean
  onClick: () => void
  title?: string
}

const ArticleSourceCard: React.FC<ArticleSourceCardProps> = ({
  url,
  highlightCount,
  isSelected,
  onClick,
  title
}) => {
  // Extract domain from URL for display
  const getDomain = (urlString: string) => {
    try {
      if (urlString.startsWith('nostr:')) {
        return 'Nostr Article'
      }
      const urlObj = new URL(urlString)
      return urlObj.hostname.replace('www.', '')
    } catch {
      return 'Unknown Source'
    }
  }

  // Get display title
  const displayTitle = title || url
  const domain = getDomain(url)
  const isNostrArticle = url.startsWith('nostr:')

  return (
    <div 
      className={`article-source-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="article-source-icon">
        <FontAwesomeIcon icon={isNostrArticle ? faFile : faLink} />
      </div>
      <div className="article-source-content">
        <h3 className="article-source-title">{displayTitle}</h3>
        <p className="article-source-domain">{domain}</p>
        <div className="article-source-meta">
          <FontAwesomeIcon icon={faHighlighter} />
          <span>{highlightCount} highlight{highlightCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

export default ArticleSourceCard

