import { useEffect, useRef, useState } from 'react'

interface UseReadingPositionOptions {
  enabled?: boolean
  onPositionChange?: (position: number) => void
  onReadingComplete?: () => void
  readingCompleteThreshold?: number // Default 0.9 (90%)
}

export const useReadingPosition = ({
  enabled = true,
  onPositionChange,
  onReadingComplete,
  readingCompleteThreshold = 0.9
}: UseReadingPositionOptions = {}) => {
  const [position, setPosition] = useState(0)
  const [isReadingComplete, setIsReadingComplete] = useState(false)
  const hasTriggeredComplete = useRef(false)

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
      const scrollProgress = Math.min(scrollTop / (documentHeight - windowHeight), 1)
      const clampedProgress = Math.max(0, Math.min(1, scrollProgress))
      
      setPosition(clampedProgress)
      onPositionChange?.(clampedProgress)

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
    }
  }, [enabled, onPositionChange, onReadingComplete, readingCompleteThreshold])

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
    progressPercentage: Math.round(position * 100)
  }
}
