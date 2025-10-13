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
  const clampedProgress = Math.min(100, Math.max(0, progress))
  
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[1102] bg-[rgba(26,26,26,0.95)] backdrop-blur-md border-t border-white/10 px-4 py-2 flex items-center gap-4 transition-all duration-300 shadow-[0_-4px_12px_rgba(0,0,0,0.3)] ${className}`}>
      <div className="flex-1 h-1 bg-white/10 rounded-sm overflow-hidden relative">
        <div 
          className={`h-full rounded-sm transition-all duration-300 relative ${
            isComplete 
              ? 'bg-gradient-to-r from-green-400 to-green-600' 
              : 'bg-gradient-to-r from-indigo-500 to-blue-400'
          }`}
          style={{ width: `${clampedProgress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
        </div>
      </div>
      {showPercentage && (
        <div className={`text-sm font-medium min-w-[80px] text-right ${
          isComplete ? 'text-green-400' : 'text-gray-400'
        }`}>
          {isComplete ? '✓ Complete' : `${clampedProgress}%`}
        </div>
      )}
    </div>
  )
}
