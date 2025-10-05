import React, { useMemo, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faHighlighter, faClock } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { applyHighlightsToHTML } from '../utils/highlightMatching'
import { readingTime } from 'reading-time-estimator'

interface ContentPanelProps {
  loading: boolean
  title?: string
  html?: string
  markdown?: string
  selectedUrl?: string
  highlights?: Highlight[]
  showUnderlines?: boolean
  onHighlightClick?: (highlightId: string) => void
  selectedHighlightId?: string
}

const ContentPanel: React.FC<ContentPanelProps> = ({ 
  loading, 
  title, 
  html, 
  markdown, 
  selectedUrl,
  highlights = [],
  showUnderlines = true,
  onHighlightClick,
  selectedHighlightId
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const originalHtmlRef = useRef<string>('')
  
  // Scroll to selected highlight in article when clicked from sidebar
  useEffect(() => {
    if (!selectedHighlightId || !contentRef.current) return
    
    const markElement = contentRef.current.querySelector(`mark.content-highlight[data-highlight-id="${selectedHighlightId}"]`)
    
    if (markElement) {
      markElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      
      // Add pulsing animation after scroll completes
      const htmlElement = markElement as HTMLElement
      setTimeout(() => {
        htmlElement.classList.add('highlight-pulse')
        setTimeout(() => htmlElement.classList.remove('highlight-pulse'), 1500)
      }, 500)
    }
  }, [selectedHighlightId])
  
  // Filter highlights relevant to the current URL
  const relevantHighlights = useMemo(() => {
    if (!selectedUrl || highlights.length === 0) return []
    
    // Normalize URLs for comparison (remove trailing slashes, protocols, www, query params, fragments)
    const normalizeUrl = (url: string) => {
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
        // Get just the hostname + pathname, remove trailing slash
        return `${urlObj.hostname.replace(/^www\./, '')}${urlObj.pathname}`.replace(/\/$/, '').toLowerCase()
      } catch {
        // Fallback for invalid URLs
        return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase()
      }
    }
    
    const normalizedSelected = normalizeUrl(selectedUrl)
    
    const filtered = highlights.filter(h => {
      if (!h.urlReference) return false
      
      const normalizedRef = normalizeUrl(h.urlReference)
      return normalizedSelected === normalizedRef || 
             normalizedSelected.includes(normalizedRef) ||
             normalizedRef.includes(normalizedSelected)
    })
    
    return filtered
  }, [selectedUrl, highlights])

  // Store original HTML when content changes
  useEffect(() => {
    if (!contentRef.current) return
    // Only store if we don't have it yet or content changed
    if (!originalHtmlRef.current || html) {
      originalHtmlRef.current = contentRef.current.innerHTML
    }
  }, [html, markdown, selectedUrl])

  // Apply highlights after DOM is rendered
  useEffect(() => {
    // Skip if no content or underlines are hidden
    if ((!html && !markdown) || !showUnderlines) {
      // If underlines are hidden, restore original HTML
      if (!showUnderlines && contentRef.current && originalHtmlRef.current) {
        contentRef.current.innerHTML = originalHtmlRef.current
      }
      return
    }
    
    // Skip if no relevant highlights
    if (relevantHighlights.length === 0) {
      // Restore original HTML if no highlights
      if (contentRef.current && originalHtmlRef.current) {
        contentRef.current.innerHTML = originalHtmlRef.current
      }
      return
    }
    
    // Use requestAnimationFrame to ensure DOM is fully rendered
    const rafId = requestAnimationFrame(() => {
      if (!contentRef.current || !originalHtmlRef.current) return
      
      // Always apply highlights to the ORIGINAL HTML, not already-highlighted content
      const highlightedHTML = applyHighlightsToHTML(originalHtmlRef.current, relevantHighlights)
      contentRef.current.innerHTML = highlightedHTML
    })
    
    return () => cancelAnimationFrame(rafId)
  }, [relevantHighlights, html, markdown, showUnderlines])

  // Attach click handlers separately (only when handler changes)
  useEffect(() => {
    if (!onHighlightClick || !contentRef.current) return
    
    const marks = contentRef.current.querySelectorAll('mark.content-highlight')
    const handlers = new Map<Element, () => void>()
    
    marks.forEach(mark => {
      const highlightId = mark.getAttribute('data-highlight-id')
      if (highlightId) {
        const handler = () => onHighlightClick(highlightId)
        mark.addEventListener('click', handler)
        ;(mark as HTMLElement).style.cursor = 'pointer'
        handlers.set(mark, handler)
      }
    })
    
    return () => {
      handlers.forEach((handler, mark) => {
        mark.removeEventListener('click', handler)
      })
    }
  }, [onHighlightClick, relevantHighlights])

  const highlightedMarkdown = useMemo(() => {
    if (!markdown || relevantHighlights.length === 0) return markdown
    // For markdown, we'll apply highlights after rendering
    return markdown
  }, [markdown, relevantHighlights])

  // Calculate reading time from content (must be before early returns)
  const readingStats = useMemo(() => {
    const content = markdown || html || ''
    if (!content) return null
    // Strip HTML tags for more accurate word count
    const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
    return readingTime(textContent)
  }, [html, markdown])

  const hasHighlights = relevantHighlights.length > 0

  if (!selectedUrl) {
    return (
      <div className="reader empty">
        <p>Select a bookmark to read its content.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="reader loading">
        <div className="loading-spinner">
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Loading content…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="reader">
      {title && (
        <div className="reader-header">
          <h2 className="reader-title">{title}</h2>
          <div className="reader-meta">
            {readingStats && (
              <div className="reading-time">
                <FontAwesomeIcon icon={faClock} />
                <span>{readingStats.text}</span>
              </div>
            )}
            {hasHighlights && (
              <div className="highlight-indicator">
                <FontAwesomeIcon icon={faHighlighter} />
                <span>{relevantHighlights.length} highlight{relevantHighlights.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {markdown ? (
        <div ref={contentRef} className="reader-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {highlightedMarkdown}
          </ReactMarkdown>
        </div>
      ) : html ? (
        <div ref={contentRef} className="reader-html" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="reader empty">
          <p>No readable content found for this URL.</p>
        </div>
      )}
    </div>
  )
}

export default ContentPanel


