import React, { useEffect, useState } from 'react'
import { SkeletonTheme } from 'react-loading-skeleton'

interface SkeletonThemeProviderProps {
  children: React.ReactNode
}

export const SkeletonThemeProvider: React.FC<SkeletonThemeProviderProps> = ({ children }) => {
  const [colors, setColors] = useState({
    baseColor: '#27272a',
    highlightColor: '#52525b'
  })

  useEffect(() => {
    const updateColors = () => {
      const rootStyles = getComputedStyle(document.documentElement)
      const baseColor = rootStyles.getPropertyValue('--color-bg-elevated').trim() || '#27272a'
      const highlightColor = rootStyles.getPropertyValue('--color-border-subtle').trim() || '#52525b'
      
      setColors({ baseColor, highlightColor })
    }

    // Initial update
    updateColors()

    // Watch for theme changes via MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          updateColors()
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return (
    <SkeletonTheme baseColor={colors.baseColor} highlightColor={colors.highlightColor}>
      {children}
    </SkeletonTheme>
  )
}

