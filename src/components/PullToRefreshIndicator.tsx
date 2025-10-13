import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown } from '@fortawesome/free-solid-svg-icons'

interface PullToRefreshIndicatorProps {
  isPulling: boolean
  pullDistance: number
  canRefresh: boolean
  isRefreshing: boolean
  threshold?: number
}

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  isPulling,
  pullDistance,
  canRefresh,
  isRefreshing,
  threshold = 80
}) => {
  // Only show when actively pulling, not when refreshing
  if (!isPulling) return null

  const opacity = Math.min(pullDistance / threshold, 1)
  const rotation = (pullDistance / threshold) * 180

  return (
    <div 
      className="pull-to-refresh-indicator"
      style={{
        opacity,
        transform: `translateY(${-20 + pullDistance / 2}px)`
      }}
    >
      <div 
        className="pull-to-refresh-icon"
        style={{
          transform: `rotate(${rotation}deg)`
        }}
      >
        <FontAwesomeIcon 
          icon={faArrowDown} 
          style={{ color: canRefresh ? 'var(--accent-color, #3b82f6)' : 'var(--text-secondary)' }}
        />
      </div>
      <div className="pull-to-refresh-text">
        {canRefresh ? 'Release to refresh' : 'Pull to refresh'}
      </div>
    </div>
  )
}

export default PullToRefreshIndicator

