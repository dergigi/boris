import { useState, useEffect } from 'react'

/**
 * Hook to detect if a media query matches
 * @param query The media query string (e.g., '(max-width: 768px)')
 * @returns true if the media query matches, false otherwise
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(query)
    
    // Update state if the media query changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } 
    // Legacy browsers
    else {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [query])

  return matches
}

/**
 * Hook to detect if the user is on a coarse pointer device (touch)
 * @returns true if the user is using a coarse pointer (touch), false otherwise
 */
export function useIsCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)')
}

/**
 * Hook to detect if the viewport is mobile-sized
 * @returns true if viewport width is <= 768px, false otherwise
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)')
}

/**
 * Hook to detect if the viewport is tablet-sized
 * @returns true if viewport width is <= 1024px, false otherwise
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(max-width: 1024px)')
}

