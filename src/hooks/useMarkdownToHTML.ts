import React, { useState, useEffect, useRef } from 'react'
import { replaceNostrUrisInMarkdown } from '../utils/nostrUriResolver'

/**
 * Hook to convert markdown to HTML using a hidden ReactMarkdown component
 * Also processes nostr: URIs in the markdown
 */
export const useMarkdownToHTML = (markdown?: string): { 
  renderedHtml: string
  previewRef: React.RefObject<HTMLDivElement>
  processedMarkdown: string 
} => {
  const previewRef = useRef<HTMLDivElement>(null)
  const [renderedHtml, setRenderedHtml] = useState<string>('')
  const [processedMarkdown, setProcessedMarkdown] = useState<string>('')

  useEffect(() => {
    if (!markdown) {
      setRenderedHtml('')
      setProcessedMarkdown('')
      return
    }

    // Process nostr: URIs in markdown before rendering
    const processed = replaceNostrUrisInMarkdown(markdown)
    setProcessedMarkdown(processed)

    console.log('📝 Converting markdown to HTML...')
    
    const rafId = requestAnimationFrame(() => {
      if (previewRef.current) {
        const html = previewRef.current.innerHTML
        console.log('✅ Markdown converted to HTML:', html.length, 'chars')
        setRenderedHtml(html)
      } else {
        console.warn('⚠️ markdownPreviewRef.current is null')
      }
    })

    return () => cancelAnimationFrame(rafId)
  }, [markdown])

  return { renderedHtml, previewRef, processedMarkdown }
}

// Removed separate useMarkdownPreviewRef; use useMarkdownToHTML to obtain previewRef

