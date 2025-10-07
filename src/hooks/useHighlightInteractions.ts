import { useEffect, useCallback, useRef } from 'react'

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
  }, [onHighlightClick])

  // Scroll to selected highlight
  useEffect(() => {
    if (!selectedHighlightId || !contentRef.current) return
    
    const markElement = contentRef.current.querySelector(`mark[data-highlight-id="${selectedHighlightId}"]`)
    
    if (markElement) {
      markElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      
      const htmlElement = markElement as HTMLElement
      setTimeout(() => {
        htmlElement.classList.add('highlight-pulse')
        setTimeout(() => htmlElement.classList.remove('highlight-pulse'), 1500)
      }, 500)
    }
  }, [selectedHighlightId])

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    setTimeout(() => {
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
    }, 10)
  }, [onTextSelection, onClearSelection])

  return { contentRef, handleMouseUp }
}

