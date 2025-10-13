import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faSpinner } from '@fortawesome/free-solid-svg-icons'

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
  // Don't show if not pulling and not refreshing
  if (!isPulling && !isRefreshing) return null

  const opacity = Math.min(pullDistance / threshold, 1)
  const rotation = (pullDistance / threshold) * 180

  return (
    <div 
      className="pull-to-refresh-indicator"
      style={{
        opacity: isRefreshing ? 1 : opacity,
        transform: `translateY(${isRefreshing ? 0 : -20 + pullDistance / 2}px)`
      }}
    >
      <div 
        className="pull-to-refresh-icon"
        style={{
          transform: isRefreshing ? 'none' : `rotate(${rotation}deg)`
        }}
      >
        {isRefreshing ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : (
          <FontAwesomeIcon 
            icon={faArrowDown} 
            style={{ color: canRefresh ? 'var(--accent-color, #3b82f6)' : 'var(--text-secondary)' }}
          />
        )}
      </div>
      <div className="pull-to-refresh-text">
        {isRefreshing 
          ? 'Refreshing...' 
          : canRefresh 
            ? 'Release to refresh' 
            : 'Pull to refresh'}
      </div>
    </div>
  )
}

export default PullToRefreshIndicator

