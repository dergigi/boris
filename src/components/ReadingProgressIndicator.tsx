import React from 'react'

interface ReadingProgressIndicatorProps {
  progress: number // 0 to 100
  isComplete?: boolean
  showPercentage?: boolean
  className?: string
  isSidebarCollapsed?: boolean
  isHighlightsCollapsed?: boolean
}

export const ReadingProgressIndicator: React.FC<ReadingProgressIndicatorProps> = ({
  progress,
  isComplete = false,
  showPercentage = true,
  className = '',
  isSidebarCollapsed = false,
  isHighlightsCollapsed = false
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress))
  
  // Determine reading state based on progress (matching readingProgressUtils.ts logic)
  const progressDecimal = clampedProgress / 100
  const isStarted = progressDecimal > 0 && progressDecimal <= 0.10
  const isReading = progressDecimal > 0.10 && progressDecimal <= 0.94
  
  // Determine bar color based on state
  let barColorClass = ''
  let barColorStyle: string | undefined = 'var(--color-primary)' // Default blue
  
  if (isComplete) {
    barColorClass = 'bg-green-500'
    barColorStyle = undefined
  } else if (isStarted) {
    barColorStyle = 'var(--color-text)' // Neutral text color (matches card titles)
  }
  
  // Calculate left and right offsets based on sidebar states (desktop only)
  const leftOffset = isSidebarCollapsed 
    ? 'var(--sidebar-collapsed-width)' 
    : 'var(--sidebar-width)'
  const rightOffset = isHighlightsCollapsed 
    ? 'var(--highlights-collapsed-width)' 
    : 'var(--highlights-width)'
  
  return (
    <div 
      className={`reading-progress-bar fixed bottom-0 left-0 right-0 z-[1102] backdrop-blur-sm px-3 py-1 flex items-center gap-2 transition-all duration-300 ${className}`}
      style={{
        '--left-offset': leftOffset,
        '--right-offset': rightOffset,
        backgroundColor: 'var(--color-bg-elevated)',
        opacity: 0.95
      } as React.CSSProperties}
    >
      <div 
        className="flex-1 h-0.5 rounded-full overflow-hidden relative"
        style={{ backgroundColor: 'var(--color-border)' }}
      >
        <div 
          className={`h-full rounded-full transition-all duration-300 relative ${barColorClass}`}
          style={{ 
            width: `${clampedProgress}%`,
            backgroundColor: barColorStyle
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
        </div>
      </div>
      {showPercentage && (
        <div 
          className={`text-[0.625rem] font-normal min-w-[32px] text-right tabular-nums ${
            isComplete ? 'text-green-500' : ''
          }`}
          style={{ 
            color: isComplete ? undefined : isStarted ? 'var(--color-text)' : 'var(--color-text-muted)' 
          }}
        >
          {isComplete ? '✓' : `${clampedProgress}%`}
        </div>
      )}
    </div>
  )
}
