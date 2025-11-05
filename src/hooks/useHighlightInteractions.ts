import { useEffect, useCallback, useRef, useState } from 'react'

interface UseHighlightInteractionsParams {
  onHighlightClick?: (highlightId: string) => void
  selectedHighlightId?: string
  onTextSelection?: (text: string) => void
  onClearSelection?: () => void
}

export const useHighlightInteractions = ({
  onHighlightClick,
  selectedHighlightId,
  onTextSelection,
  onClearSelection
}: UseHighlightInteractionsParams) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentVersion, setContentVersion] = useState(0)

  // Watch for DOM changes (highlights being added/removed)
  useEffect(() => {
    if (!contentRef.current) return
    
    const observer = new MutationObserver(() => {
      // Increment version to trigger re-attachment of handlers
      setContentVersion(prev => prev + 1)
    })
    
    observer.observe(contentRef.current, {
      childList: true,
      subtree: true,
      characterData: false
    })
    
    return () => observer.disconnect()
  }, [])

  // Attach click handlers to highlight marks
  useEffect(() => {
    if (!onHighlightClick || !contentRef.current) return
    
    const marks = contentRef.current.querySelectorAll('mark[data-highlight-id]')
    const handlers = new Map<Element, () => void>()
    
    marks.forEach(mark => {
      const highlightId = mark.getAttribute('data-highlight-id')
      if (highlightId) {
        const handler = () => onHighlightClick(highlightId)
        mark.addEventListener('click', handler)
        ;(mark as HTMLElement).style.cursor = 'pointer'
        handlers.set(mark, handler)
      }
    })
    
    return () => {
      handlers.forEach((handler, mark) => {
        mark.removeEventListener('click', handler)
      })
    }
  }, [onHighlightClick, contentVersion])

  // Scroll to selected highlight with retry mechanism
  useEffect(() => {
    if (!selectedHighlightId || !contentRef.current) return
    
    let attempts = 0
    const maxAttempts = 20 // Try for up to 2 seconds
    const retryDelay = 100
    
    const tryScroll = () => {
      if (!contentRef.current) return
      
      const markElement = contentRef.current.querySelector(`mark[data-highlight-id="${selectedHighlightId}"]`)
      
      if (markElement) {
        markElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        
        const htmlElement = markElement as HTMLElement
        setTimeout(() => {
          htmlElement.classList.add('highlight-pulse')
          setTimeout(() => htmlElement.classList.remove('highlight-pulse'), 1500)
        }, 500)
      } else if (attempts < maxAttempts) {
        attempts++
        setTimeout(tryScroll, retryDelay)
      } else {
        console.warn('Could not find mark element for highlight after', maxAttempts, 'attempts:', selectedHighlightId)
      }
    }
    
    // Start trying after a small initial delay
    const timeoutId = setTimeout(tryScroll, 100)
    
    return () => clearTimeout(timeoutId)
  }, [selectedHighlightId, contentVersion])

  // Shared function to check and handle text selection
  const checkSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      onClearSelection?.()
      return
    }

    const range = selection.getRangeAt(0)
    const text = selection.toString().trim()

    if (text.length > 0 && contentRef.current?.contains(range.commonAncestorContainer)) {
      onTextSelection?.(text)
    } else {
      onClearSelection?.()
    }
  }, [onTextSelection, onClearSelection])

  // Listen to selectionchange events for immediate detection (works reliably on mobile)
  useEffect(() => {
    const handleSelectionChange = () => {
      // Use requestAnimationFrame to ensure selection is checked after browser updates
      requestAnimationFrame(checkSelection)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [checkSelection])

  return { contentRef }
}

