import React from 'react'
import Skeleton from 'react-loading-skeleton'

export const BlogPostSkeleton: React.FC = () => {
  return (
    <div 
      className="blog-post-card"
      style={{ 
        textDecoration: 'none',
        color: 'inherit',
        display: 'block'
      }}
      aria-hidden="true"
    >
      <div className="blog-post-card-image">
        <Skeleton height={200} style={{ display: 'block' }} />
      </div>
      <div className="blog-post-card-content">
        <Skeleton 
          height={24} 
          width="85%" 
          style={{ marginBottom: '0.75rem' }} 
          className="blog-post-card-title"
        />
        <Skeleton 
          count={2} 
          style={{ marginBottom: '0.5rem' }} 
          className="blog-post-card-summary"
        />
        <div className="blog-post-card-meta" style={{ display: 'flex', gap: '1rem' }}>
          <span className="blog-post-card-author" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Skeleton width={100} height={14} />
          </span>
          <span className="blog-post-card-date" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Skeleton width={80} height={14} />
          </span>
        </div>
      </div>
    </div>
  )
}

