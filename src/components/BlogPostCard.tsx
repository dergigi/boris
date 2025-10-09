import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendar, faUser } from '@fortawesome/free-solid-svg-icons'
import { formatDistance } from 'date-fns'
import { BlogPostPreview } from '../services/exploreService'
import { useEventModel } from 'applesauce-react'
import { Models } from 'applesauce-core'

interface BlogPostCardProps {
  post: BlogPostPreview
  onClick: () => void
}

const BlogPostCard: React.FC<BlogPostCardProps> = ({ post, onClick }) => {
  const profile = useEventModel(Models.ProfileModel, [post.author])
  const displayName = profile?.name || profile?.display_name || 
    `${post.author.slice(0, 8)}...${post.author.slice(-4)}`
  
  const publishedDate = post.published || post.event.created_at
  const formattedDate = formatDistance(new Date(publishedDate * 1000), new Date(), { 
    addSuffix: true 
  })

  return (
    <div 
      className="blog-post-card"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {post.image && (
        <div className="blog-post-card-image">
          <img 
            src={post.image} 
            alt={post.title}
            loading="lazy"
          />
        </div>
      )}
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
    </div>
  )
}

export default BlogPostCard

