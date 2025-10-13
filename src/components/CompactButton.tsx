import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

interface CompactButtonProps {
  icon?: IconDefinition
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  title?: string
  ariaLabel?: string
  disabled?: boolean
  spin?: boolean
  className?: string
  children?: React.ReactNode
}

const CompactButton: React.FC<CompactButtonProps> = ({
  icon,
  onClick,
  title,
  ariaLabel,
  disabled = false,
  spin = false,
  className = '',
  children
}) => {
  return (
    <button
      className={`compact-button ${className}`.trim()}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      disabled={disabled}
    >
      {icon && <FontAwesomeIcon icon={icon} spin={spin} />}
      {children}
    </button>
  )
}

export default CompactButton

