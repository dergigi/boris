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
      <div
        style={{
          position: 'sticky',
          bottom: '32px',
          zIndex: 10,
          height: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          pointerEvents: 'none',
          marginRight: '32px'
        }}
      >
        <button
          className="highlight-fab"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: highlightColor,
            color: '#000',
            border: 'none',
            boxShadow: hasSelection ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
            cursor: hasSelection ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            opacity: hasSelection ? 1 : 0.4,
            transform: hasSelection ? 'scale(1)' : 'scale(0.8)',
            pointerEvents: hasSelection ? 'auto' : 'none',
            userSelect: 'none'
          }}
          onClick={handleClick}
          aria-label="Create highlight from selection"
          title={hasSelection ? 'Create highlight' : ''}
        >
          <FontAwesomeIcon icon={faHighlighter} size="lg" />
        </button>
      </div>
    )
  }
)

HighlightButton.displayName = 'HighlightButton'

