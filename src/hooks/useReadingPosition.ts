import { useEffect, useRef, useState, useCallback } from 'react'

interface UseReadingPositionOptions {
  enabled?: boolean
  onPositionChange?: (position: number) => void
  onReadingComplete?: () => void
  readingCompleteThreshold?: number // Default 0.95 (95%) - matches filter threshold
  syncEnabled?: boolean // Whether to sync positions to Nostr
  onSave?: (position: number) => void // Callback for saving position
  autoSaveInterval?: number // Auto-save interval in ms (default 5000)
  completionHoldMs?: number // How long to hold at 100% before firing complete (default 2000)
}

export const useReadingPosition = ({
  enabled = true,
  onPositionChange,
  onReadingComplete,
  readingCompleteThreshold = 0.95, // Match filter threshold for consistency
  syncEnabled = false,
  onSave,
  autoSaveInterval = 5000,
  completionHoldMs = 2000
}: UseReadingPositionOptions = {}) => {
  const [position, setPosition] = useState(0)
  const positionRef = useRef(0)
  const [isReadingComplete, setIsReadingComplete] = useState(false)
  const hasTriggeredComplete = useRef(false)
  const lastSavedPosition = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSavedOnce = useRef(false)
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced save function
  const scheduleSave = useCallback((currentPosition: number) => {
    if (!syncEnabled || !onSave) {
      return
    }

    // Don't save if position hasn't changed significantly (less than 1%)
    // But always save if we've reached 100% (completion)
    const hasSignificantChange = Math.abs(currentPosition - lastSavedPosition.current) >= 0.01
    const hasReachedCompletion = currentPosition === 1 && lastSavedPosition.current < 1
    const isInitialSave = !hasSavedOnce.current
    
    if (!hasSignificantChange && !hasReachedCompletion && !isInitialSave) {
      // Not significant enough to save
      return
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    // Schedule new save
    saveTimerRef.current = setTimeout(() => {
      lastSavedPosition.current = currentPosition
      hasSavedOnce.current = true
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

    // Always allow immediate save (including 0%)
    lastSavedPosition.current = position
    hasSavedOnce.current = true
    onSave(position)
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
      positionRef.current = clampedProgress
      onPositionChange?.(clampedProgress)

      // Schedule auto-save if sync is enabled
      scheduleSave(clampedProgress)

      // Completion detection with 2s hold at 100%
      if (!hasTriggeredComplete.current) {
        // If at exact 100%, start a hold timer; cancel if we scroll up
        if (clampedProgress === 1) {
          if (!completionTimerRef.current) {
            completionTimerRef.current = setTimeout(() => {
              if (!hasTriggeredComplete.current && positionRef.current === 1) {
                setIsReadingComplete(true)
                hasTriggeredComplete.current = true
                onReadingComplete?.()
              }
              completionTimerRef.current = null
            }, completionHoldMs)
          }
        } else {
          // If we moved off 100%, cancel any pending completion hold
          if (completionTimerRef.current) {
            clearTimeout(completionTimerRef.current)
            completionTimerRef.current = null
            // still allow threshold-based completion for near-bottom if configured
            if (clampedProgress >= readingCompleteThreshold) {
              setIsReadingComplete(true)
              hasTriggeredComplete.current = true
              onReadingComplete?.()
            }
          }
        }
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
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current)
      }
    }
  }, [enabled, onPositionChange, onReadingComplete, readingCompleteThreshold, scheduleSave, completionHoldMs])

  // Reset reading complete state when enabled changes
  useEffect(() => {
    if (!enabled) {
      setIsReadingComplete(false)
      hasTriggeredComplete.current = false
      hasSavedOnce.current = false
      lastSavedPosition.current = 0
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current)
        completionTimerRef.current = null
      }
    }
  }, [enabled])

  return {
    position,
    isReadingComplete,
    progressPercentage: Math.round(position * 100),
    saveNow
  }
}
