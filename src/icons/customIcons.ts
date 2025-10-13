import { IconDefinition, IconPrefix, IconName } from '@fortawesome/fontawesome-svg-core'
import booksSvg from './books.svg?raw'

/**
 * Custom icon definitions for FontAwesome Pro icons
 * or any custom SVG icons that aren't in the free tier
 */

function parseSvgToIconDefinition(svg: string, options: { prefix: IconPrefix, iconName: IconName, unicode?: string }): IconDefinition {
  const { prefix, iconName, unicode = 'e002' } = options

  // Extract viewBox first; fallback to width/height
  const viewBoxMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/i)
  let width = 512
  let height = 512
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/)
    if (parts.length === 4) {
      const w = Number(parts[2])
      const h = Number(parts[3])
      if (!Number.isNaN(w)) width = Math.round(w)
      if (!Number.isNaN(h)) height = Math.round(h)
    }
  } else {
    const widthMatch = svg.match(/\bwidth\s*=\s*"(\d+(?:\.\d+)?)"/i)
    const heightMatch = svg.match(/\bheight\s*=\s*"(\d+(?:\.\d+)?)"/i)
    if (widthMatch) width = Math.round(Number(widthMatch[1]))
    if (heightMatch) height = Math.round(Number(heightMatch[1]))
  }

  // Collect all path d attributes
  const pathDs: string[] = []
  const pathRegex = /<path[^>]*\sd=\s*"([^"]+)"[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = pathRegex.exec(svg)) !== null) {
    pathDs.push(m[1])
  }

  const pathData = pathDs.length <= 1 ? (pathDs[0] || '') : pathDs

  return {
    prefix,
    iconName,
    icon: [width, height, [], unicode, pathData]
  }
}

export const faBooks: IconDefinition = parseSvgToIconDefinition(booksSvg, {
  prefix: 'far',
  iconName: 'books'
})

