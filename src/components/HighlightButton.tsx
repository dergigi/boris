import React, { useCallback, useImperativeHandle, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter } from '@fortawesome/free-solid-svg-icons'

interface HighlightButtonProps {
  onHighlight: (text: string) => void
  highlightColor?: string
}

export interface HighlightButtonRef {
  updateSelection: (text: string) => void
  clearSelection: () => void
}

export const HighlightButton = React.forwardRef<HighlightButtonRef, HighlightButtonProps>(
  ({ onHighlight, highlightColor = '#ffff00' }, ref) => {
    const currentSelectionRef = useRef<string>('')
    const [hasSelection, setHasSelection] = useState(false)

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

    // Expose methods to update selection
    useImperativeHandle(ref, () => ({
      updateSelection: (text: string) => {
        currentSelectionRef.current = text
        setHasSelection(!!text)
      },
      clearSelection: () => {
        currentSelectionRef.current = ''
        setHasSelection(false)
      }
    }))

    return (
      <button
        className="highlight-fab"
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 1000,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: highlightColor,
          color: '#000',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          cursor: hasSelection ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          opacity: hasSelection ? 1 : 0.4,
          transform: hasSelection ? 'scale(1)' : 'scale(0.9)',
          userSelect: 'none'
        }}
        onClick={handleClick}
        disabled={!hasSelection}
        aria-label="Create highlight from selection"
        title={hasSelection ? 'Create highlight' : 'Select text to highlight'}
      >
        <FontAwesomeIcon icon={faHighlighter} size="lg" />
      </button>
    )
  }
)

HighlightButton.displayName = 'HighlightButton'

