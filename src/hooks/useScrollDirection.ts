import { useState, useEffect } from 'react'

export type ScrollDirection = 'up' | 'down' | 'none'

interface UseScrollDirectionOptions {
  threshold?: number
  enabled?: boolean
}

/**
 * Hook to detect scroll direction
 * @param options Configuration options
 * @param options.threshold Minimum scroll distance to trigger direction change (default: 10)
 * @param options.enabled Whether scroll detection is enabled (default: true)
 * @returns Current scroll direction ('up', 'down', or 'none')
 */
export function useScrollDirection({ 
  threshold = 10, 
  enabled = true 
}: UseScrollDirectionOptions = {}): ScrollDirection {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>('none')

  useEffect(() => {
    if (!enabled) return

    let lastScrollY = window.scrollY
    let ticking = false

    const updateScrollDirection = () => {
      const scrollY = window.scrollY

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

    window.addEventListener('scroll', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [threshold, enabled])

  return scrollDirection
}

