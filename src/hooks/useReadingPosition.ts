import { useEffect, useRef, useState } from 'react'
// @ts-ignore - position-indicator types issue
import { createPositionIndicator } from 'position-indicator'

interface ReadingPositionData {
  position: number // 0 to 1
  prevPosition: number
  hasUpdated: boolean
  hasScroll: boolean
  eventType: 'scroll' | 'resize' | 'heightChange' | 'init'
  eventDate: number
}

interface UseReadingPositionOptions {
  enabled?: boolean
  onPositionChange?: (data: ReadingPositionData) => void
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
  const positionIndicatorRef = useRef<any>(null)
  const hasTriggeredComplete = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const handleInit = (data: ReadingPositionData) => {
      setPosition(data.position)
      onPositionChange?.(data)
    }

    const handleUpdate = (data: ReadingPositionData) => {
      setPosition(data.position)
      onPositionChange?.(data)

      // Check if reading is complete
      if (data.position >= readingCompleteThreshold && !hasTriggeredComplete.current) {
        setIsReadingComplete(true)
        hasTriggeredComplete.current = true
        onReadingComplete?.()
      }
    }

    const positionIndicator = createPositionIndicator({
      onInit: handleInit,
      onUpdate: handleUpdate,
      useResizeListener: true,
      useResizeObserver: true
    })

    positionIndicator.init()
    positionIndicatorRef.current = positionIndicator

    return () => {
      if (positionIndicatorRef.current) {
        positionIndicatorRef.current.destroy()
        positionIndicatorRef.current = null
      }
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
