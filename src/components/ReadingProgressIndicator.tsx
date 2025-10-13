import React from 'react'

interface ReadingProgressIndicatorProps {
  progress: number // 0 to 100
  isComplete?: boolean
  showPercentage?: boolean
  className?: string
}

export const ReadingProgressIndicator: React.FC<ReadingProgressIndicatorProps> = ({
  progress,
  isComplete = false,
  showPercentage = true,
  className = ''
}) => {
  return (
    <div className={`reading-progress-indicator ${className}`}>
      <div className="reading-progress-bar">
        <div 
          className={`reading-progress-fill ${isComplete ? 'complete' : ''}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {showPercentage && (
        <div className="reading-progress-text">
          {isComplete ? '✓ Complete' : `${progress}%`}
        </div>
      )}
    </div>
  )
}
