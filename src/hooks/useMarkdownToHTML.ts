import React, { useState, useEffect, useRef } from 'react'
import { RelayPool } from 'applesauce-relay'
import { extractNaddrUris, replaceNostrUrisInMarkdownWithProfileLabels } from '../utils/nostrUriResolver'
import { fetchArticleTitles } from '../services/articleTitleResolver'
import { useProfileLabels } from './useProfileLabels'

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
  const [articleTitles, setArticleTitles] = useState<Map<string, string>>(new Map())

  // Resolve profile labels progressively as profiles load
  const profileLabels = useProfileLabels(markdown || '')

  // Fetch article titles
  useEffect(() => {
    if (!markdown || !relayPool) {
      setArticleTitles(new Map())
      return
    }

    let isCancelled = false

    const fetchTitles = async () => {
      const naddrs = extractNaddrUris(markdown)
      if (naddrs.length === 0) {
        setArticleTitles(new Map())
        return
      }

      try {
        const titlesMap = await fetchArticleTitles(relayPool!, naddrs)
        if (!isCancelled) {
          setArticleTitles(titlesMap)
        }
      } catch (error) {
        console.warn('Failed to fetch article titles:', error)
        if (!isCancelled) setArticleTitles(new Map())
      }
    }

    fetchTitles()
    return () => { isCancelled = true }
  }, [markdown, relayPool])

  // Process markdown with progressive profile labels and article titles
  useEffect(() => {
    // Always clear previous render immediately to avoid showing stale content while processing
    setRenderedHtml('')
    setProcessedMarkdown('')
    
    if (!markdown) {
      return
    }

    let isCancelled = false

    const processMarkdown = () => {
      // Replace nostr URIs with profile labels (progressive) and article titles
      const processed = replaceNostrUrisInMarkdownWithProfileLabels(
        markdown,
        profileLabels,
        articleTitles
      )
      
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
  }, [markdown, profileLabels, articleTitles])

  return { renderedHtml, previewRef, processedMarkdown }
}

// Removed separate useMarkdownPreviewRef; use useMarkdownToHTML to obtain previewRef

