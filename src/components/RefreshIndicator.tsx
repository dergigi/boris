import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRotateRight } from '@fortawesome/free-solid-svg-icons'

interface RefreshIndicatorProps {
  isRefreshing: boolean
  pullPosition: number
}

const THRESHOLD = 80

/**
 * Simple pull-to-refresh visual indicator
 */
const RefreshIndicator: React.FC<RefreshIndicatorProps> = ({
  isRefreshing,
  pullPosition
}) => {
  const isVisible = isRefreshing || pullPosition > 0
  if (!isVisible) return null

  const opacity = Math.min(pullPosition / THRESHOLD, 1)
  const translateY = isRefreshing ? THRESHOLD / 3 : pullPosition / 3

  return (
    <div
      style={{
        position: 'fixed',
        top: `${translateY}px`,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        opacity,
        transition: isRefreshing ? 'opacity 0.2s' : 'none'
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: 'var(--surface-secondary, #ffffff)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <FontAwesomeIcon
          icon={faArrowRotateRight}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${pullPosition}deg)`,
            color: 'var(--accent-color, #3b82f6)'
          }}
          className={isRefreshing ? 'fa-spin' : ''}
        />
      </div>
    </div>
  )
}

export default RefreshIndicator

