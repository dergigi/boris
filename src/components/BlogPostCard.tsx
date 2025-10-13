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
}

const BlogPostCard: React.FC<BlogPostCardProps> = ({ post, href }) => {
  const profile = useEventModel(Models.ProfileModel, [post.author])
  const displayName = profile?.name || profile?.display_name || 
    `${post.author.slice(0, 8)}...${post.author.slice(-4)}`
  
  const publishedDate = post.published || post.event.created_at
  const formattedDate = formatDistance(new Date(publishedDate * 1000), new Date(), { 
    addSuffix: true 
  })

  return (
    <Link 
      to={href}
      className="blog-post-card"
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
        <div className="blog-post-card-meta">
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

