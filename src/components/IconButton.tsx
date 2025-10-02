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
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  title,
  ariaLabel,
  variant = 'ghost',
  size = 33
}) => {
  return (
    <button
      className={`icon-button ${variant}`}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      style={{ width: size, height: size }}
    >
      <FontAwesomeIcon icon={icon} />
    </button>
  )
}

export default IconButton


