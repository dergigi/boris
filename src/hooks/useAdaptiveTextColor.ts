import { useEffect, useState } from 'react'
import { FastAverageColor } from 'fast-average-color'

interface AdaptiveTextColor {
  textColor: string
}

/**
 * Hook to determine optimal text color based on image background
 * Samples the top-right corner of the image to ensure publication date is readable
 * 
 * @param imageUrl - The URL of the image to analyze
 * @returns Object containing textColor for optimal contrast
 */
export function useAdaptiveTextColor(imageUrl: string | undefined): AdaptiveTextColor {
  const [colors, setColors] = useState<AdaptiveTextColor>({
    textColor: '#ffffff'
  })

  useEffect(() => {
    if (!imageUrl) {
      // No image, use default white text
      setColors({
        textColor: '#ffffff'
      })
      return
    }

    const fac = new FastAverageColor()
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const width = img.naturalWidth
        const height = img.naturalHeight
        
        // Sample top-right corner (last 25% width, first 25% height)
        const color = fac.getColor(img, {
          left: Math.floor(width * 0.75),
          top: 0,
          width: Math.floor(width * 0.25),
          height: Math.floor(height * 0.25)
        })
        
        // Color analysis complete
        
        // Use library's built-in isLight check for optimal contrast
        if (color.isLight) {
          setColors({
            textColor: '#000000'
          })
        } else {
          setColors({
            textColor: '#ffffff'
          })
        }
      } catch (error) {
        // Fallback to default on error
        console.error('Error analyzing image color:', error)
        setColors({
          textColor: '#ffffff'
        })
      }
    }
    
    img.onerror = () => {
      // Fallback to default if image fails to load
      setColors({
        textColor: '#ffffff'
      })
    }
    
    img.src = imageUrl

    return () => {
      fac.destroy()
    }
  }, [imageUrl])

  return colors
}

