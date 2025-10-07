import { useState, useEffect, useRef } from 'react'

/**
 * Hook to convert markdown to HTML using a hidden ReactMarkdown component
 */
export const useMarkdownToHTML = (markdown?: string): string => {
  const markdownPreviewRef = useRef<HTMLDivElement>(null)
  const [renderedHtml, setRenderedHtml] = useState<string>('')

  useEffect(() => {
    if (!markdown) {
      setRenderedHtml('')
      return
    }

    console.log('📝 Converting markdown to HTML...')
    
    const rafId = requestAnimationFrame(() => {
      if (markdownPreviewRef.current) {
        const html = markdownPreviewRef.current.innerHTML
        console.log('✅ Markdown converted to HTML:', html.length, 'chars')
        setRenderedHtml(html)
      } else {
        console.warn('⚠️ markdownPreviewRef.current is null')
      }
    })

    return () => cancelAnimationFrame(rafId)
  }, [markdown])

  return renderedHtml
}

export const useMarkdownPreviewRef = () => {
  return useRef<HTMLDivElement>(null)
}

