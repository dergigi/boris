import React from 'react'
import Skeleton from 'react-loading-skeleton'

export const HighlightSkeleton: React.FC = () => {
  return (
    <div 
      className="highlight-item"
      style={{ 
        padding: '1rem',
        marginBottom: '0.75rem',
        borderRadius: '8px',
        backgroundColor: 'var(--color-bg-elevated)'
      }}
      aria-hidden="true"
    >
      {/* Author line with avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Skeleton circle width={24} height={24} />
        <Skeleton width={120} height={14} />
        <Skeleton width={60} height={12} style={{ marginLeft: 'auto' }} />
      </div>
      
      {/* Highlight content */}
      <div style={{ marginBottom: '0.5rem' }}>
        <Skeleton count={2} style={{ marginBottom: '0.25rem' }} />
        <Skeleton width="70%" />
      </div>
      
      {/* Citation/context */}
      <div style={{ marginTop: '0.75rem' }}>
        <Skeleton width="90%" height={12} />
      </div>
    </div>
  )
}

