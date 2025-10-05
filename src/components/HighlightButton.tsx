import React, { useCallback, useImperativeHandle, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter } from '@fortawesome/free-solid-svg-icons'

interface HighlightButtonProps {
  onHighlight: (text: string) => void
}

export interface HighlightButtonRef {
  updateSelection: (text: string, range: Range) => void
  hide: () => void
}

export const HighlightButton = React.forwardRef<HighlightButtonRef, HighlightButtonProps>(
  ({ onHighlight }, ref) => {
    const currentSelectionRef = useRef<string>('')
    const buttonRef = useRef<HTMLButtonElement>(null)

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (currentSelectionRef.current) {
          onHighlight(currentSelectionRef.current)
        }
      },
      [onHighlight]
    )

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      // Prevent the button from taking focus away from the text selection
      e.preventDefault()
    }, [])

    // Expose methods to update selection and hide button
    useImperativeHandle(ref, () => ({
      updateSelection: (text: string, range: Range) => {
        currentSelectionRef.current = text
        if (buttonRef.current) {
          const rect = range.getBoundingClientRect()
          buttonRef.current.style.display = 'flex'
          buttonRef.current.style.top = `${rect.bottom + window.scrollY + 8}px`
          buttonRef.current.style.left = `${rect.left + rect.width / 2 - 20}px`
        }
      },
      hide: () => {
        currentSelectionRef.current = ''
        if (buttonRef.current) {
          buttonRef.current.style.display = 'none'
        }
      }
    }))

    return (
      <button
        ref={buttonRef}
        className="highlight-create-button"
        style={{
          display: 'none',
          position: 'absolute',
          zIndex: 1000,
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary, #0066cc)',
          color: 'white',
          border: '2px solid white',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        tabIndex={-1}
        aria-label="Create highlight"
        title="Create highlight"
      >
        <FontAwesomeIcon icon={faHighlighter} />
      </button>
    )
  }
)

HighlightButton.displayName = 'HighlightButton'

