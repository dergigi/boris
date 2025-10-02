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
  href?: string
  target?: string
  rel?: string
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  title,
  ariaLabel,
  variant = 'ghost',
  size = 44,
  href,
  target,
  rel
}) => {
  const commonProps = {
    className: `icon-button ${variant}`,
    title,
    'aria-label': ariaLabel || title,
    style: { width: size, height: size }
  } as const

  if (href) {
    return (
      <a
        {...(commonProps as any)}
        href={href}
        target={target || '_blank'}
        rel={rel || 'noopener noreferrer'}
      >
        <FontAwesomeIcon icon={icon} />
      </a>
    )
  }

  return (
    <button
      {...(commonProps as any)}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} />
    </button>
  )
}

export default IconButton


