import { useEffect, useRef, useState, RefObject } from 'react'
import { useIsCoarsePointer } from './useMediaQuery'

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<void>
  isRefreshing?: boolean
  disabled?: boolean
  threshold?: number // Distance in pixels to trigger refresh
  resistance?: number // Resistance factor (higher = harder to pull)
}

interface PullToRefreshState {
  isPulling: boolean
  pullDistance: number
  canRefresh: boolean
}

/**
 * Hook to enable pull-to-refresh gesture on touch devices
 * @param containerRef - Ref to the scrollable container element
 * @param options - Configuration options
 * @returns State of the pull gesture
 */
export function usePullToRefresh(
  containerRef: RefObject<HTMLElement>,
  options: UsePullToRefreshOptions
): PullToRefreshState {
  const {
    onRefresh,
    isRefreshing = false,
    disabled = false,
    threshold = 80,
    resistance = 2.5
  } = options

  const isTouch = useIsCoarsePointer()
  const [pullState, setPullState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    canRefresh: false
  })

  const touchStartY = useRef<number>(0)
  const startScrollTop = useRef<number>(0)
  const isDragging = useRef<boolean>(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !isTouch || disabled || isRefreshing) return

    const handleTouchStart = (e: TouchEvent) => {
      // Only start if scrolled to top
      const scrollTop = container.scrollTop
      if (scrollTop <= 0) {
        touchStartY.current = e.touches[0].clientY
        startScrollTop.current = scrollTop
        isDragging.current = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return

      const currentY = e.touches[0].clientY
      const deltaY = currentY - touchStartY.current
      const scrollTop = container.scrollTop

      // Only pull down when at top and pulling down
      if (scrollTop <= 0 && deltaY > 0) {
        // Prevent default scroll behavior
        e.preventDefault()

        // Apply resistance to make pulling feel natural
        const distance = Math.min(deltaY / resistance, threshold * 1.5)
        const canRefresh = distance >= threshold

        setPullState({
          isPulling: true,
          pullDistance: distance,
          canRefresh
        })
      } else {
        // Reset if scrolled or pulling up
        isDragging.current = false
        setPullState({
          isPulling: false,
          pullDistance: 0,
          canRefresh: false
        })
      }
    }

    const handleTouchEnd = async () => {
      if (!isDragging.current) return

      isDragging.current = false

      if (pullState.canRefresh && !isRefreshing) {
        // Keep the indicator visible while refreshing
        setPullState(prev => ({
          ...prev,
          isPulling: false
        }))

        // Trigger refresh
        await onRefresh()
      }

      // Reset state
      setPullState({
        isPulling: false,
        pullDistance: 0,
        canRefresh: false
      })
    }

    const handleTouchCancel = () => {
      isDragging.current = false
      setPullState({
        isPulling: false,
        pullDistance: 0,
        canRefresh: false
      })
    }

    // Add event listeners with passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [containerRef, isTouch, disabled, isRefreshing, threshold, resistance, onRefresh, pullState.canRefresh])

  // Reset pull state when refresh completes
  useEffect(() => {
    if (!isRefreshing && pullState.isPulling) {
      setPullState({
        isPulling: false,
        pullDistance: 0,
        canRefresh: false
      })
    }
  }, [isRefreshing, pullState.isPulling])

  return pullState
}

