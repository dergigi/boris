import React, { useState, useEffect, useRef } from 'react'
import { RelayPool } from 'applesauce-relay'
import { extractNaddrUris, replaceNostrUrisInMarkdown, replaceNostrUrisInMarkdownWithTitles } from '../utils/nostrUriResolver'
import { fetchArticleTitles } from '../services/articleTitleResolver'

/**
 * Hook to convert markdown to HTML using a hidden ReactMarkdown component
 * Also processes nostr: URIs in the markdown and resolves article titles
 */
export const useMarkdownToHTML = (
  markdown?: string,
  relayPool?: RelayPool | null
): { 
  renderedHtml: string
  previewRef: React.RefObject<HTMLDivElement>
  processedMarkdown: string 
} => {
  const previewRef = useRef<HTMLDivElement>(null)
  const [renderedHtml, setRenderedHtml] = useState<string>('')
  const [processedMarkdown, setProcessedMarkdown] = useState<string>('')

  useEffect(() => {
    // Always clear previous render immediately to avoid showing stale content while processing
    setRenderedHtml('')
    setProcessedMarkdown('')
    
    if (!markdown) {
      return
    }

    let isCancelled = false

    const processMarkdown = async () => {
      // Extract all naddr references
      const naddrs = extractNaddrUris(markdown)
      
      let processed: string
      
      if (naddrs.length > 0 && relayPool) {
        // Fetch article titles for all naddrs
        try {
          const articleTitles = await fetchArticleTitles(relayPool, naddrs)
          
          if (isCancelled) return
          
          // Replace nostr URIs with resolved titles
          processed = replaceNostrUrisInMarkdownWithTitles(markdown, articleTitles)
        } catch (error) {
          console.warn('Failed to fetch article titles:', error)
          // Fall back to basic replacement
          processed = replaceNostrUrisInMarkdown(markdown)
        }
      } else {
        // No articles to resolve, use basic replacement
        processed = replaceNostrUrisInMarkdown(markdown)
      }
      
      if (isCancelled) return
      
      setProcessedMarkdown(processed)

      
      const rafId = requestAnimationFrame(() => {
        if (previewRef.current && !isCancelled) {
          const html = previewRef.current.innerHTML
          setRenderedHtml(html)
        } else if (!isCancelled) {
          console.warn('⚠️ markdownPreviewRef.current is null')
        }
      })

      return () => cancelAnimationFrame(rafId)
    }

    processMarkdown()

    return () => {
      isCancelled = true
    }
  }, [markdown, relayPool])

  return { renderedHtml, previewRef, processedMarkdown }
}

// Removed separate useMarkdownPreviewRef; use useMarkdownToHTML to obtain previewRef

