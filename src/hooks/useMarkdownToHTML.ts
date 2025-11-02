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

  console.log('[npub-resolve] useMarkdownToHTML: markdown length:', markdown?.length || 0, 'hasRelayPool:', !!relayPool)

  // Resolve profile labels progressively as profiles load
  const profileLabels = useProfileLabels(markdown || '', relayPool)
  console.log('[npub-resolve] useMarkdownToHTML: Profile labels size:', profileLabels.size)

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
      console.log('[npub-resolve] useMarkdownToHTML: Processing markdown, length:', markdown.length)
      console.log('[npub-resolve] useMarkdownToHTML: Profile labels:', profileLabels.size, 'Article titles:', articleTitles.size)
      try {
        // Replace nostr URIs with profile labels (progressive) and article titles
        const processed = replaceNostrUrisInMarkdownWithProfileLabels(
          markdown,
          profileLabels,
          articleTitles
        )
        console.log('[npub-resolve] useMarkdownToHTML: Processed markdown length:', processed.length)
        
        if (isCancelled) return
        
        setProcessedMarkdown(processed)
      } catch (err) {
        console.error('[npub-resolve] useMarkdownToHTML: Error processing markdown:', err)
        if (!isCancelled) {
          setProcessedMarkdown(markdown) // Fallback to original
        }
      }

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

