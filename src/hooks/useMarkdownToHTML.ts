import React, { useState, useEffect, useRef, useMemo } from 'react'
import { RelayPool } from 'applesauce-relay'
import { extractNaddrUris, replaceNostrUrisInMarkdownWithProfileLabels, addLoadingClassToProfileLinks } from '../utils/nostrUriResolver'
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
  const { labels: profileLabels, loading: profileLoading } = useProfileLabels(markdown || '', relayPool)
  
  // Create stable dependencies based on Map contents, not Map objects
  // This prevents unnecessary reprocessing when Maps are recreated with same content
  const profileLabelsKey = useMemo(() => {
    const key = Array.from(profileLabels.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('|')
    return key
  }, [profileLabels])
  
  const profileLoadingKey = useMemo(() => {
    return Array.from(profileLoading.entries())
      .filter(([, loading]) => loading)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k]) => k)
      .join('|')
  }, [profileLoading])
  
  const articleTitlesKey = useMemo(() => {
    return Array.from(articleTitles.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('|')
  }, [articleTitles])
  
  // Keep refs to latest Maps for processing without causing re-renders
  const profileLabelsRef = useRef(profileLabels)
  const profileLoadingRef = useRef(profileLoading)
  const articleTitlesRef = useRef(articleTitles)
  
  // Ref to track second RAF ID for HTML extraction cleanup
  const htmlExtractionRafIdRef = useRef<number | null>(null)
  
  useEffect(() => {
    profileLabelsRef.current = profileLabels
    profileLoadingRef.current = profileLoading
    articleTitlesRef.current = articleTitles
  }, [profileLabels, profileLoading, articleTitles])

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
      } catch {
        if (!isCancelled) setArticleTitles(new Map())
      }
    }

    fetchTitles()
    return () => { isCancelled = true }
  }, [markdown, relayPool])

  // Track previous markdown and processed state to detect actual content changes
  const previousMarkdownRef = useRef<string | undefined>(markdown)
  const processedMarkdownRef = useRef<string>(processedMarkdown)
  
  useEffect(() => {
    processedMarkdownRef.current = processedMarkdown
  }, [processedMarkdown])
  
  // Process markdown with progressive profile labels and article titles
  // Use stable string keys instead of Map objects to prevent excessive reprocessing
  useEffect(() => {
    if (!markdown) {
      setRenderedHtml('')
      setProcessedMarkdown('')
      previousMarkdownRef.current = markdown
      processedMarkdownRef.current = ''
      return
    }

    let isCancelled = false

    const processMarkdown = () => {
      try {
        // Replace nostr URIs with profile labels (progressive) and article titles
        // Use refs to get latest values without causing dependency changes
        const processed = replaceNostrUrisInMarkdownWithProfileLabels(
          markdown,
          profileLabelsRef.current,
          articleTitlesRef.current,
          profileLoadingRef.current
        )
        
        if (isCancelled) return
        
        setProcessedMarkdown(processed)
        processedMarkdownRef.current = processed
        // HTML extraction will happen in separate useEffect that watches processedMarkdown
      } catch (error) {
        console.error(`[markdown-to-html] Error processing markdown:`, error)
        if (!isCancelled) {
          setProcessedMarkdown(markdown) // Fallback to original
          processedMarkdownRef.current = markdown
        }
      }
    }

    // Only clear previous content if this is the first processing or markdown changed
    // For profile updates, just reprocess without clearing to avoid flicker
    const isMarkdownChange = previousMarkdownRef.current !== markdown
    previousMarkdownRef.current = markdown
    
    if (isMarkdownChange || !processedMarkdownRef.current) {
      setRenderedHtml('')
      setProcessedMarkdown('')
      processedMarkdownRef.current = ''
    }

    processMarkdown()

    return () => {
      isCancelled = true
    }
  }, [markdown, profileLabelsKey, profileLoadingKey, articleTitlesKey])

  // Extract HTML after processedMarkdown renders
  // This useEffect watches processedMarkdown and extracts HTML once ReactMarkdown has rendered it
  useEffect(() => {
    if (!processedMarkdown || !markdown) {
      return
    }

    let isCancelled = false
    
    // Use double RAF to ensure ReactMarkdown has finished rendering:
    // First RAF: let React complete its render cycle
    // Second RAF: extract HTML after DOM has updated
    const rafId1 = requestAnimationFrame(() => {
      htmlExtractionRafIdRef.current = requestAnimationFrame(() => {
        if (previewRef.current && !isCancelled) {
          let html = previewRef.current.innerHTML
          
          // Post-process HTML to add loading class to profile links
          html = addLoadingClassToProfileLinks(html, profileLoadingRef.current)
          
          setRenderedHtml(html)
        } else if (!isCancelled && processedMarkdown) {
          console.warn('⚠️ markdownPreviewRef.current is null but processedMarkdown exists')
        }
      })
    })

    return () => {
      isCancelled = true
      cancelAnimationFrame(rafId1)
      if (htmlExtractionRafIdRef.current !== null) {
        cancelAnimationFrame(htmlExtractionRafIdRef.current)
        htmlExtractionRafIdRef.current = null
      }
    }
  }, [processedMarkdown, markdown])

  return { renderedHtml, previewRef, processedMarkdown }
}

// Removed separate useMarkdownPreviewRef; use useMarkdownToHTML to obtain previewRef

