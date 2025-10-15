import { useEffect, useState } from 'react'
import FastAverageColor from 'fast-average-color'

interface AdaptiveTextColor {
  textColor: string
  shadowColor: string
}

/**
 * Hook to determine optimal text and shadow colors based on image background
 * Samples the top-right corner of the image to ensure publication date is readable
 * 
 * @param imageUrl - The URL of the image to analyze
 * @returns Object containing textColor and shadowColor for optimal contrast
 */
export function useAdaptiveTextColor(imageUrl: string | undefined): AdaptiveTextColor {
  const [colors, setColors] = useState<AdaptiveTextColor>({
    textColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.5)'
  })

  useEffect(() => {
    if (!imageUrl) {
      // No image, use default white text
      setColors({
        textColor: '#ffffff',
        shadowColor: 'rgba(0, 0, 0, 0.5)'
      })
      return
    }

    const fac = new FastAverageColor()
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = async () => {
      try {
        const width = img.naturalWidth
        const height = img.naturalHeight
        
        // Sample top-right corner (last 25% width, first 25% height)
        const color = await fac.getColor(img, {
          left: Math.floor(width * 0.75),
          top: 0,
          width: Math.floor(width * 0.25),
          height: Math.floor(height * 0.25)
        })
        
        // Use library's built-in isLight check for optimal contrast
        if (color.isLight) {
          setColors({
            textColor: '#000000',
            shadowColor: 'rgba(255, 255, 255, 0.5)'
          })
        } else {
          setColors({
            textColor: '#ffffff',
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          })
        }
      } catch (error) {
        // Fallback to default on error
        console.error('Error analyzing image color:', error)
        setColors({
          textColor: '#ffffff',
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        })
      }
    }
    
    img.onerror = () => {
      // Fallback to default if image fails to load
      setColors({
        textColor: '#ffffff',
        shadowColor: 'rgba(0, 0, 0, 0.5)'
      })
    }
    
    img.src = imageUrl

    return () => {
      fac.destroy()
    }
  }, [imageUrl])

  return colors
}

