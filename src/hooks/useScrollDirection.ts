import { useState, useEffect, RefObject } from 'react'

export type ScrollDirection = 'up' | 'down' | 'none'

interface UseScrollDirectionOptions {
  threshold?: number
  enabled?: boolean
  elementRef?: RefObject<HTMLElement>
}

/**
 * Hook to detect scroll direction on window or a specific element
 * @param options Configuration options
 * @param options.threshold Minimum scroll distance to trigger direction change (default: 10)
 * @param options.enabled Whether scroll detection is enabled (default: true)
 * @param options.elementRef Optional ref to a scrollable element (uses window if not provided)
 * @returns Current scroll direction ('up', 'down', or 'none')
 */
export function useScrollDirection({ 
  threshold = 10, 
  enabled = true,
  elementRef
}: UseScrollDirectionOptions = {}): ScrollDirection {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>('none')

  useEffect(() => {
    if (!enabled) return

    const scrollElement = elementRef?.current || window
    const getScrollY = () => {
      if (elementRef?.current) {
        return elementRef.current.scrollTop
      }
      return window.scrollY
    }

    let lastScrollY = getScrollY()
    let ticking = false

    const updateScrollDirection = () => {
      const scrollY = getScrollY()

      // Only update if scroll distance exceeds threshold
      if (Math.abs(scrollY - lastScrollY) < threshold) {
        ticking = false
        return
      }

      setScrollDirection(scrollY > lastScrollY ? 'down' : 'up')
      lastScrollY = scrollY > 0 ? scrollY : 0
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDirection)
        ticking = true
      }
    }

    scrollElement.addEventListener('scroll', onScroll)

    return () => {
      scrollElement.removeEventListener('scroll', onScroll)
    }
  }, [threshold, enabled, elementRef])

  return scrollDirection
}

