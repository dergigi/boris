import { useEffect, useRef, useState, useCallback } from 'react'

interface UseReadingPositionOptions {
  enabled?: boolean
  onPositionChange?: (position: number) => void
  onReadingComplete?: () => void
  readingCompleteThreshold?: number // Default 0.9 (90%)
  syncEnabled?: boolean // Whether to sync positions to Nostr
  onSave?: (position: number) => void // Callback for saving position
  autoSaveInterval?: number // Auto-save interval in ms (default 5000)
}

export const useReadingPosition = ({
  enabled = true,
  onPositionChange,
  onReadingComplete,
  readingCompleteThreshold = 0.9,
  syncEnabled = false,
  onSave,
  autoSaveInterval = 5000
}: UseReadingPositionOptions = {}) => {
  const [position, setPosition] = useState(0)
  const [isReadingComplete, setIsReadingComplete] = useState(false)
  const hasTriggeredComplete = useRef(false)
  const lastSavedPosition = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced save function
  const scheduleSave = useCallback((currentPosition: number) => {
    if (!syncEnabled || !onSave) return
    
    // Don't save if position is too low (< 5%)
    if (currentPosition < 0.05) return
    
    // Don't save if position hasn't changed significantly (less than 1%)
    // But always save if we've reached 100% (completion)
    const hasSignificantChange = Math.abs(currentPosition - lastSavedPosition.current) >= 0.01
    const hasReachedCompletion = currentPosition === 1 && lastSavedPosition.current < 1
    
    if (!hasSignificantChange && !hasReachedCompletion) return

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    // Schedule new save
    saveTimerRef.current = setTimeout(() => {
      lastSavedPosition.current = currentPosition
      onSave(currentPosition)
    }, autoSaveInterval)
  }, [syncEnabled, onSave, autoSaveInterval])

  // Immediate save function
  const saveNow = useCallback(() => {
    if (!syncEnabled || !onSave) return
    
    // Cancel any pending saves
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    // Save if position is meaningful (>= 5%)
    if (position >= 0.05) {
      lastSavedPosition.current = position
      onSave(position)
    }
  }, [syncEnabled, onSave, position])

  useEffect(() => {
    if (!enabled) return

    const handleScroll = () => {
      // Get the main content area (reader content)
      const readerContent = document.querySelector('.reader-html, .reader-markdown')
      if (!readerContent) return

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      
      // Calculate position based on how much of the content has been scrolled through
      // Add a small threshold (5px) to account for rounding and make it easier to reach 100%
      const maxScroll = documentHeight - windowHeight
      const scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0
      
      // If we're within 5px of the bottom, consider it 100%
      const isAtBottom = scrollTop + windowHeight >= documentHeight - 5
      const clampedProgress = isAtBottom ? 1 : Math.max(0, Math.min(1, scrollProgress))
      
      setPosition(clampedProgress)
      onPositionChange?.(clampedProgress)

      // Schedule auto-save if sync is enabled
      scheduleSave(clampedProgress)

      // Check if reading is complete
      if (clampedProgress >= readingCompleteThreshold && !hasTriggeredComplete.current) {
        setIsReadingComplete(true)
        hasTriggeredComplete.current = true
        onReadingComplete?.()
      }
    }

    // Initial calculation
    handleScroll()

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      
      // Clear save timer on unmount
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [enabled, onPositionChange, onReadingComplete, readingCompleteThreshold, scheduleSave])

  // Reset reading complete state when enabled changes
  useEffect(() => {
    if (!enabled) {
      setIsReadingComplete(false)
      hasTriggeredComplete.current = false
    }
  }, [enabled])

  return {
    position,
    isReadingComplete,
    progressPercentage: Math.round(position * 100),
    saveNow
  }
}
