import React, { useMemo, forwardRef } from 'react'
import ReactPlayer from 'react-player'
import { classifyUrl } from '../utils/helpers'

interface VideoEmbedProcessorProps {
  html: string
  renderVideoLinksAsEmbeds: boolean
  className?: string
  onMouseUp?: (e: React.MouseEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
}

/**
 * Component that processes HTML content and optionally embeds video links
 * as ReactPlayer components when renderVideoLinksAsEmbeds is enabled
 */
const VideoEmbedProcessor = forwardRef<HTMLDivElement, VideoEmbedProcessorProps>(({
  html,
  renderVideoLinksAsEmbeds,
  className,
  onMouseUp,
  onTouchEnd
}, ref) => {
  const processedHtml = useMemo(() => {
    if (!renderVideoLinksAsEmbeds || !html) {
      return html
    }

    // Find all video URLs in img tags and replace the entire tag
    let result = html
    
    // Pattern to match img tags with video URLs in src attribute
    const imgVideoPattern = /<img[^>]+src=["']?(https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)[^\s<>"']*)["']?[^>]*>/gi
    const imgMatches = result.match(imgVideoPattern) || []
    
    const imgVideoUrls: string[] = []
    imgMatches.forEach((imgTag, index) => {
      const srcMatch = imgTag.match(/src=["']?(https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)[^\s<>"']*)["']?/i)
      if (srcMatch && srcMatch[1]) {
        imgVideoUrls.push(srcMatch[1])
        const placeholder = `__VIDEO_EMBED_${index}__`
        result = result.replace(imgTag, placeholder)
      }
    })

    // Find remaining video URLs (not in img tags)
    const videoUrlPattern = /https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)(?:\?[^\s<>"']*)?/gi
    const videoUrls: string[] = result.match(videoUrlPattern) || []
    
    // Also check for video URLs that might not have extensions but are classified as video
    // Use a more precise pattern that stops at whitespace, quotes, and HTML tag boundaries
    const allUrlPattern = /https?:\/\/[^\s<>"']+(?=\s|>|"|'|$)/gi
    const allUrls: string[] = result.match(allUrlPattern) || []
    const videoUrlsWithoutExt = allUrls.filter(url => {
      const classification = classifyUrl(url)
      return classification.type === 'video' && !videoUrls.includes(url)
    })
    
    const allVideoUrls = [...videoUrls, ...videoUrlsWithoutExt]
    
    if ((imgVideoUrls.length + allVideoUrls.length) === 0) {
      return html
    }

    // Replace remaining video URLs with placeholder divs
    let processedHtml = result
    let placeholderIndex = imgVideoUrls.length
    allVideoUrls.forEach((url) => {
      const placeholder = `__VIDEO_EMBED_${placeholderIndex}__`
      processedHtml = processedHtml.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder)
      placeholderIndex++
    })

    return processedHtml
  }, [html, renderVideoLinksAsEmbeds])

  const videoUrls = useMemo(() => {
    if (!renderVideoLinksAsEmbeds || !html) {
      return []
    }

    const result: string[] = []
    
    // Extract video URLs from img tags
    const imgVideoPattern = /<img[^>]+src=["']?(https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)[^\s<>"']*)["']?[^>]*>/gi
    const imgMatches = html.match(imgVideoPattern) || []
    imgMatches.forEach((imgTag) => {
      const srcMatch = imgTag.match(/src=["']?(https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)[^\s<>"']*)["']?/i)
      if (srcMatch && srcMatch[1]) {
        result.push(srcMatch[1])
      }
    })
    
    // Extract remaining video URLs
    const videoUrlPattern = /https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)(?:\?[^\s<>"']*)?/gi
    const videoUrls: string[] = html.match(videoUrlPattern) || []
    result.push(...videoUrls.filter(url => !result.includes(url)))
    
    // Use a more precise pattern that stops at whitespace, quotes, and HTML tag boundaries
    const allUrlPattern = /https?:\/\/[^\s<>"']+(?=\s|>|"|'|$)/gi
    const allUrls: string[] = html.match(allUrlPattern) || []
    const videoUrlsWithoutExt = allUrls.filter(url => {
      const classification = classifyUrl(url)
      return classification.type === 'video' && !result.includes(url)
    })
    
    return [...result, ...videoUrlsWithoutExt]
  }, [html, renderVideoLinksAsEmbeds])

  // If no video embedding is enabled, just render the HTML normally
  if (!renderVideoLinksAsEmbeds || videoUrls.length === 0) {
    return (
      <div 
        ref={ref}
        className={className}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
        onMouseUp={onMouseUp}
        onTouchEnd={onTouchEnd}
      />
    )
  }

  // Split the HTML by video placeholders and render with embedded players
  const parts = processedHtml.split(/(__VIDEO_EMBED_\d+__)/)
  
  return (
    <div ref={ref} className={className} onMouseUp={onMouseUp} onTouchEnd={onTouchEnd}>
      {parts.map((part, index) => {
        const videoMatch = part.match(/^__VIDEO_EMBED_(\d+)__$/)
        if (videoMatch) {
          const videoIndex = parseInt(videoMatch[1])
          const videoUrl = videoUrls[videoIndex]
          if (videoUrl) {
            return (
              <div key={index} className="reader-video" style={{ margin: '1rem 0' }}>
                <ReactPlayer 
                  url={videoUrl}
                  controls 
                  width="100%"
                  height="auto"
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    aspectRatio: '16/9' 
                  }}
                />
              </div>
            )
          }
        }
        
        // Regular HTML content
        return (
          <div 
            key={index}
            dangerouslySetInnerHTML={{ __html: part }}
          />
        )
      })}
    </div>
  )
})

VideoEmbedProcessor.displayName = 'VideoEmbedProcessor'

export default VideoEmbedProcessor
