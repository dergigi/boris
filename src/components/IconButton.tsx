import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

interface IconButtonProps {
  icon: IconDefinition
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  title?: string
  ariaLabel?: string
  variant?: 'primary' | 'success' | 'ghost'
  size?: number
  disabled?: boolean
  spin?: boolean
  className?: string
  style?: React.CSSProperties
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  title,
  ariaLabel,
  variant = 'ghost',
  size = 33,
  disabled = false,
  spin = false,
  className = '',
  style
}) => {
  return (
    <button
      className={`icon-button ${variant} ${className}`.trim()}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      style={{ width: size, height: size, ...style }}
      disabled={disabled}
    >
      <FontAwesomeIcon icon={icon} spin={spin} />
    </button>
  )
}

export default IconButton


