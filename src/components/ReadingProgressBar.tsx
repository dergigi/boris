import React from 'react'

interface ReadingProgressBarProps {
  readingProgress?: number
  height?: number
  marginTop?: string
  marginBottom?: string
  marginLeft?: string
  className?: string
}

export const ReadingProgressBar: React.FC<ReadingProgressBarProps> = ({
  readingProgress,
  height = 1,
  marginTop,
  marginBottom,
  marginLeft,
  className
}) => {
  // Calculate progress color
  let progressColor = '#6366f1' // Default blue (reading)
  if (readingProgress && readingProgress >= 0.95) {
    progressColor = '#10b981' // Green (completed)
  } else if (readingProgress && readingProgress > 0 && readingProgress <= 0.10) {
    progressColor = 'var(--color-text)' // Neutral text color (started)
  }

  const progressWidth = readingProgress ? `${Math.round(readingProgress * 100)}%` : '0%'
  const progressBackground = readingProgress ? progressColor : 'var(--color-border)'

  return (
    <div 
      className={className}
      style={{
        height: `${height}px`,
        width: '100%',
        background: 'var(--color-border)',
        borderRadius: '0.5px',
        overflow: 'hidden',
        marginTop,
        marginBottom,
        marginLeft,
        position: 'relative'
      }}
    >
      <div
        style={{
          height: '100%',
          width: progressWidth,
          background: progressBackground,
          transition: 'width 0.3s ease, background 0.3s ease'
        }}
      />
    </div>
  )
}
