import React, { useMemo, forwardRef } from 'react'
import ReactPlayer from 'react-player'
import { classifyUrl } from '../utils/helpers'

interface VideoEmbedProcessorProps {
  html: string
  renderVideoLinksAsEmbeds: boolean
  className?: string
}

/**
 * Component that processes HTML content and optionally embeds video links
 * as ReactPlayer components when renderVideoLinksAsEmbeds is enabled
 */
const VideoEmbedProcessor = forwardRef<HTMLDivElement, VideoEmbedProcessorProps>(({
  html,
  renderVideoLinksAsEmbeds,
  className
}, ref) => {
  // Process HTML and extract video URLs in a single pass to keep them in sync
  const { processedHtml, videoUrls } = useMemo(() => {
    if (!renderVideoLinksAsEmbeds || !html) {
      return { processedHtml: html, videoUrls: [] }
    }

    // Process HTML in stages: <video> blocks, <img> tags with video src, and bare video URLs
    let result = html

    const collectedUrls: string[] = []
    let placeholderIndex = 0

    // 1) Replace entire <video>...</video> blocks when they reference a video URL
    const videoBlockPattern = /<video[^>]*>[\s\S]*?<\/video>/gi
    const videoBlocks = result.match(videoBlockPattern) || []
    videoBlocks.forEach((block) => {
      // Try src on <video>
      let url: string | null = null
      const videoSrcMatch = block.match(/<video[^>]*\s+src=["']?(https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)[^\s<>"']*)["']?[^>]*>/i)
      if (videoSrcMatch && videoSrcMatch[1]) {
        url = videoSrcMatch[1]
      } else {
        // Try nested <source>
        const sourceSrcMatch = block.match(/<source[^>]*\s+src=["']?(https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)[^\s<>"']*)["']?[^>]*>/i)
        if (sourceSrcMatch && sourceSrcMatch[1]) {
          url = sourceSrcMatch[1]
        }
      }
      if (url) {
        collectedUrls.push(url)
        const placeholder = `__VIDEO_EMBED_${placeholderIndex}__`
        const escaped = block.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        result = result.replace(new RegExp(escaped, 'g'), placeholder)
        placeholderIndex++
      }
    })

    // 2) Replace entire <img ...> tags if their src points to a video
    const imgTagPattern = /<img[^>]*>/gi
    const allImgTags = result.match(imgTagPattern) || []
    allImgTags.forEach((imgTag) => {
      const srcMatch = imgTag.match(/src=["']?(https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)[^\s<>"']*)["']?/i)
      if (srcMatch && srcMatch[1]) {
        const videoUrl = srcMatch[1]
        collectedUrls.push(videoUrl)
        const placeholder = `__VIDEO_EMBED_${placeholderIndex}__`
        const escapedTag = imgTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        result = result.replace(new RegExp(escapedTag, 'g'), placeholder)
        placeholderIndex++
      }
    })

    // 3) Replace remaining bare video URLs (direct files or recognized video platforms)
    const fileVideoPattern = /https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi|mkv|m4v)(?:\?[^\s<>"']*)?/gi
    const fileVideoUrls: string[] = result.match(fileVideoPattern) || []

    const allUrlPattern = /https?:\/\/[^\s<>"']+(?=\s|>|"|'|$)/gi
    const allUrls: string[] = result.match(allUrlPattern) || []
    const platformVideoUrls = allUrls.filter(url => {
      // include URLs classified as video and not already collected
      const classification = classifyUrl(url)
      return classification.type === 'video' && !collectedUrls.includes(url)
    })

    const remainingUrls = [...fileVideoUrls, ...platformVideoUrls].filter(url => !collectedUrls.includes(url))

    let finalHtml = result
    remainingUrls.forEach((url) => {
      const placeholder = `__VIDEO_EMBED_${placeholderIndex}__`
      finalHtml = finalHtml.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder)
      collectedUrls.push(url)
      placeholderIndex++
    })

    // Return both processed HTML and collected URLs (in the same order as placeholders)
    return {
      processedHtml: collectedUrls.length > 0 ? finalHtml : html,
      videoUrls: collectedUrls
    }
  }, [html, renderVideoLinksAsEmbeds])

  // If no video embedding is enabled, just render the HTML normally
  if (!renderVideoLinksAsEmbeds || videoUrls.length === 0) {
    return (
      <div 
        ref={ref}
        className={className}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    )
  }

  // Split the HTML by video placeholders and render with embedded players
  const parts = processedHtml.split(/(__VIDEO_EMBED_\d+__)/)
  
  return (
    <div ref={ref} className={className}>
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
        
        // Regular HTML content - only render if not empty
        if (part.trim()) {
          return (
            <div 
              key={index}
              dangerouslySetInnerHTML={{ __html: part }}
            />
          )
        }
        return null
      })}
    </div>
  )
})

VideoEmbedProcessor.displayName = 'VideoEmbedProcessor'

export default VideoEmbedProcessor
