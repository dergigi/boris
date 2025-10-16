import React from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendar, faUser, faNewspaper } from '@fortawesome/free-solid-svg-icons'
import { formatDistance } from 'date-fns'
import { BlogPostPreview } from '../services/exploreService'
import { useEventModel } from 'applesauce-react/hooks'
import { Models } from 'applesauce-core'

interface BlogPostCardProps {
  post: BlogPostPreview
  href: string
  level?: 'mine' | 'friends' | 'nostrverse'
  readingProgress?: number // 0-1 reading progress (optional)
}

const BlogPostCard: React.FC<BlogPostCardProps> = ({ post, href, level, readingProgress }) => {
  const profile = useEventModel(Models.ProfileModel, [post.author])
  const displayName = profile?.name || profile?.display_name || 
    `${post.author.slice(0, 8)}...${post.author.slice(-4)}`
  
  const publishedDate = post.published || post.event.created_at
  const formattedDate = formatDistance(new Date(publishedDate * 1000), new Date(), { 
    addSuffix: true 
  })

  // Calculate progress percentage and determine color (matching readingProgressUtils.ts logic)
  const progressPercent = readingProgress ? Math.round(readingProgress * 100) : 0
  let progressColor = '#6366f1' // Default blue (reading)
  
  if (readingProgress && readingProgress >= 0.95) {
    progressColor = '#10b981' // Green (completed)
  } else if (readingProgress && readingProgress > 0 && readingProgress <= 0.10) {
    progressColor = '#f59e0b' // Amber (started)
  }

  return (
    <Link 
      to={href}
      className={`blog-post-card ${level ? `level-${level}` : ''}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="blog-post-card-image">
        {post.image ? (
          <img 
            src={post.image} 
            alt={post.title}
            loading="lazy"
          />
        ) : (
          <div className="blog-post-image-placeholder">
            <FontAwesomeIcon icon={faNewspaper} />
          </div>
        )}
      </div>
      <div className="blog-post-card-content">
        <h3 className="blog-post-card-title">{post.title}</h3>
        {post.summary && (
          <p className="blog-post-card-summary">{post.summary}</p>
        )}
        
        {/* Reading progress indicator - replaces the dividing line */}
        {readingProgress !== undefined && readingProgress > 0 ? (
          <div 
            className="blog-post-reading-progress"
            style={{
              height: '3px',
              width: '100%',
              background: 'var(--color-border)',
              overflow: 'hidden',
              marginTop: '1rem'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: progressColor,
                transition: 'width 0.3s ease, background 0.3s ease'
              }}
            />
          </div>
        ) : (
          <div style={{ 
            height: '1px', 
            background: 'var(--color-border)', 
            marginTop: '1rem' 
          }} />
        )}
        
        <div className="blog-post-card-meta" style={{ borderTop: 'none', paddingTop: '0.75rem' }}>
          <span className="blog-post-card-author">
            <FontAwesomeIcon icon={faUser} />
            {displayName}
          </span>
          <span className="blog-post-card-date">
            <FontAwesomeIcon icon={faCalendar} />
            {formattedDate}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default BlogPostCard

