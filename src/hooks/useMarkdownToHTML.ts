import React, { useState, useEffect, useRef } from 'react'

/**
 * Hook to convert markdown to HTML using a hidden ReactMarkdown component
 */
export const useMarkdownToHTML = (markdown?: string): { renderedHtml: string, previewRef: React.RefObject<HTMLDivElement> } => {
  const previewRef = useRef<HTMLDivElement>(null)
  const [renderedHtml, setRenderedHtml] = useState<string>('')

  useEffect(() => {
    if (!markdown) {
      setRenderedHtml('')
      return
    }

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

  return { renderedHtml, previewRef }
}

// Removed separate useMarkdownPreviewRef; use useMarkdownToHTML to obtain previewRef

