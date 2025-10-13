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
  
  // Calculate left and right offsets based on sidebar states (desktop only)
  const leftOffset = isSidebarCollapsed 
    ? 'var(--sidebar-collapsed-width)' 
    : 'var(--sidebar-width)'
  const rightOffset = isHighlightsCollapsed 
    ? 'var(--highlights-collapsed-width)' 
    : 'var(--highlights-width)'
  
  return (
    <div 
      className={`reading-progress-bar fixed bottom-0 left-0 right-0 z-[1102] bg-[rgba(26,26,26,0.85)] backdrop-blur-sm px-3 py-1 flex items-center gap-2 transition-all duration-300 ${className}`}
      style={{
        '--left-offset': leftOffset,
        '--right-offset': rightOffset
      } as React.CSSProperties}
    >
      <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden relative">
        <div 
          className={`h-full rounded-full transition-all duration-300 relative ${
            isComplete 
              ? 'bg-green-500' 
              : 'bg-indigo-500'
          }`}
          style={{ width: `${clampedProgress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
        </div>
      </div>
      {showPercentage && (
        <div className={`text-[0.625rem] font-normal min-w-[32px] text-right tabular-nums ${
          isComplete ? 'text-green-500' : 'text-gray-500'
        }`}>
          {isComplete ? '✓' : `${clampedProgress}%`}
        </div>
      )}
    </div>
  )
}
