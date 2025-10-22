import { useEffect, useRef, useState, useCallback } from 'react'

interface UseReadingPositionOptions {
  enabled?: boolean
  onPositionChange?: (position: number) => void
  onReadingComplete?: () => void
  readingCompleteThreshold?: number // Default 0.95 (95%) - matches filter threshold
  syncEnabled?: boolean // Whether to sync positions to Nostr
  onSave?: (position: number) => void // Callback for saving position
  completionHoldMs?: number // How long to hold at 100% before firing complete (default 2000)
}

export const useReadingPosition = ({
  enabled = true,
  onPositionChange,
  onReadingComplete,
  readingCompleteThreshold = 0.95, // Match filter threshold for consistency
  syncEnabled = false,
  onSave,
  completionHoldMs = 2000
}: UseReadingPositionOptions = {}) => {
  const [position, setPosition] = useState(0)
  const positionRef = useRef(0)
  const [isReadingComplete, setIsReadingComplete] = useState(false)
  const hasTriggeredComplete = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressUntilRef = useRef<number>(0)
  const pendingPositionRef = useRef<number>(0) // Track latest position for throttled save
  const lastSaved100Ref = useRef(false) // Track if we've saved 100% to avoid duplicate saves

  // Suppress auto-saves for a given duration (used after programmatic restore)
  const suppressSavesFor = useCallback((ms: number) => {
    const until = Date.now() + ms
    suppressUntilRef.current = until
    console.log(`[reading-position] [${new Date().toISOString()}] 🛡️ Suppressing saves for ${ms}ms until ${new Date(until).toISOString()}`)
  }, [])

  // Throttled save function - saves at 3s intervals during scrolling
  const scheduleSave = useCallback((currentPosition: number) => {
    if (!syncEnabled || !onSave) {
      return
    }

    // Always save instantly when we reach completion (1.0)
    if (currentPosition === 1 && !lastSaved100Ref.current) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      console.log(`[reading-position] [${new Date().toISOString()}] 💾 Instant save at 100% completion`)
      lastSaved100Ref.current = true
      onSave(1)
      return
    }

    // Always update the pending position (latest position to save)
    pendingPositionRef.current = currentPosition

    // Throttle: only schedule a save if one isn't already pending
    // This ensures saves happen at regular 3s intervals during continuous scrolling
    if (saveTimerRef.current) {
      return // Already have a save scheduled, don't reset the timer
    }

    const THROTTLE_MS = 3000
    saveTimerRef.current = setTimeout(() => {
      // Save the latest position, not the one from when timer was scheduled
      const positionToSave = pendingPositionRef.current
      console.log(`[reading-position] [${new Date().toISOString()}] 💾 Auto-save at ${Math.round(positionToSave * 100)}%`)
      onSave(positionToSave)
      saveTimerRef.current = null
    }, THROTTLE_MS)
  }, [syncEnabled, onSave])

  useEffect(() => {
    if (!enabled) return

    const handleScroll = () => {
      // Get the main content area (reader content)
      const readerContent = document.querySelector('.reader-html, .reader-markdown')
      if (!readerContent) return

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      
      // Ignore if document is too small (likely during page transition)
      if (documentHeight < 100) return
      
      // Calculate position based on how much of the content has been scrolled through
      const maxScroll = documentHeight - windowHeight
      const scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0
      
      // Only consider it 100% if we're truly at the bottom AND have scrolled significantly
      // This prevents false 100% during page transitions
      const isAtBottom = scrollTop + windowHeight >= documentHeight - 5 && scrollTop > 100
      const clampedProgress = isAtBottom ? 1 : Math.max(0, Math.min(1, scrollProgress))
      
      setPosition(clampedProgress)
      positionRef.current = clampedProgress
      onPositionChange?.(clampedProgress)

      // Schedule auto-save if sync is enabled (unless suppressed)
      if (Date.now() >= suppressUntilRef.current) {
        scheduleSave(clampedProgress)
      } else {
        const remainingMs = suppressUntilRef.current - Date.now()
        console.log(`[reading-position] [${new Date().toISOString()}] 🛡️ Save suppressed (${remainingMs}ms remaining) at ${Math.round(clampedProgress * 100)}%`)
      }

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
      lastSaved100Ref.current = false
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
    suppressSavesFor
  }
}
