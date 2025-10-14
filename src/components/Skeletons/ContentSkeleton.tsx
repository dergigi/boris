import React from 'react'
import Skeleton from 'react-loading-skeleton'

export const ContentSkeleton: React.FC = () => {
  return (
    <div 
      className="reader-content"
      style={{ 
        maxWidth: '900px',
        margin: '0 auto',
        padding: '2rem 1rem'
      }}
      aria-hidden="true"
    >
      {/* Title */}
      <Skeleton 
        height={48} 
        width="90%" 
        style={{ marginBottom: '1rem' }} 
      />
      
      {/* Byline / Meta */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
        <Skeleton circle width={40} height={40} />
        <div style={{ flex: 1 }}>
          <Skeleton width={150} height={16} style={{ marginBottom: '0.25rem' }} />
          <Skeleton width={200} height={14} />
        </div>
      </div>
      
      {/* Cover image */}
      <Skeleton 
        height={400} 
        style={{ marginBottom: '2rem', display: 'block', borderRadius: '8px' }} 
      />
      
      {/* Paragraphs */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Skeleton count={3} style={{ marginBottom: '0.5rem' }} />
        <Skeleton width="80%" />
      </div>
      
      <div style={{ marginBottom: '1.5rem' }}>
        <Skeleton count={4} style={{ marginBottom: '0.5rem' }} />
        <Skeleton width="65%" />
      </div>
      
      <div style={{ marginBottom: '1.5rem' }}>
        <Skeleton count={3} style={{ marginBottom: '0.5rem' }} />
        <Skeleton width="90%" />
      </div>
      
      {/* Another image placeholder */}
      <Skeleton 
        height={300} 
        style={{ marginBottom: '2rem', display: 'block', borderRadius: '8px' }} 
      />
      
      <div style={{ marginBottom: '1.5rem' }}>
        <Skeleton count={3} style={{ marginBottom: '0.5rem' }} />
        <Skeleton width="75%" />
      </div>
    </div>
  )
}

