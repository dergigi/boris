import React from 'react'
import Skeleton from 'react-loading-skeleton'
import { ViewMode } from '../Bookmarks'

interface BookmarkSkeletonProps {
  viewMode: ViewMode
}

export const BookmarkSkeleton: React.FC<BookmarkSkeletonProps> = ({ viewMode }) => {
  if (viewMode === 'compact') {
    return (
      <div 
        className="bookmark-item-compact" 
        style={{ padding: '0.75rem', marginBottom: '0.5rem' }}
        aria-hidden="true"
      >
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Skeleton width={40} height={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton width="80%" height={16} style={{ marginBottom: '0.25rem' }} />
            <Skeleton width="60%" height={14} />
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'cards') {
    return (
      <div 
        className="bookmark-card" 
        style={{ 
          borderRadius: '8px', 
          overflow: 'hidden',
          backgroundColor: 'var(--color-bg-elevated)',
          marginBottom: '1rem'
        }}
        aria-hidden="true"
      >
        <Skeleton height={160} style={{ display: 'block' }} />
        <div style={{ padding: '1rem' }}>
          <Skeleton height={20} width="90%" style={{ marginBottom: '0.5rem' }} />
          <Skeleton count={2} style={{ marginBottom: '0.5rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <Skeleton width={80} height={14} />
            <Skeleton width={60} height={14} />
          </div>
        </div>
      </div>
    )
  }

  // large view
  return (
    <div 
      className="bookmark-large" 
      style={{ 
        marginBottom: '1.5rem',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'var(--color-bg-elevated)'
      }}
      aria-hidden="true"
    >
      <Skeleton height={240} style={{ display: 'block' }} />
      <div style={{ padding: '1.5rem' }}>
        <Skeleton height={24} width="85%" style={{ marginBottom: '0.75rem' }} />
        <Skeleton count={3} style={{ marginBottom: '0.5rem' }} />
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <Skeleton circle width={32} height={32} />
          <div style={{ flex: 1 }}>
            <Skeleton width={120} height={14} style={{ marginBottom: '0.25rem' }} />
            <Skeleton width={100} height={12} />
          </div>
        </div>
      </div>
    </div>
  )
}

