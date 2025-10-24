import { useEffect, useRef } from 'react'

const DEFAULT_TITLE = 'Boris - Read, Highlight, Explore'

interface UseDocumentTitleProps {
  title?: string
  fallback?: string
}

export function useDocumentTitle({ title, fallback }: UseDocumentTitleProps) {
  const originalTitleRef = useRef<string>(document.title)

  useEffect(() => {
    // Store the original title on first mount
    if (originalTitleRef.current === DEFAULT_TITLE) {
      originalTitleRef.current = document.title
    }

    // Set the new title if provided, otherwise use fallback or default
    const newTitle = title || fallback || DEFAULT_TITLE
    document.title = newTitle

    // Cleanup: restore original title when component unmounts
    return () => {
      document.title = originalTitleRef.current
    }
  }, [title, fallback])

  // Return a function to manually reset to default
  const resetTitle = () => {
    document.title = DEFAULT_TITLE
  }

  return { resetTitle }
}
