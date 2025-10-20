import { useRef, useEffect, useCallback } from 'react'

/**
 * Hook to track if component is mounted and prevent state updates after unmount.
 * Returns a function to check if still mounted.
 * 
 * @example
 * const isMounted = useMountedState()
 * 
 * async function loadData() {
 *   const data = await fetch(...)
 *   if (isMounted()) {
 *     setState(data)
 *   }
 * }
 */
export function useMountedState(): () => boolean {
  const mountedRef = useRef(true)
  
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])
  
  return useCallback(() => mountedRef.current, [])
}

