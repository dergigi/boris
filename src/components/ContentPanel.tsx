import React, { useMemo, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { applyHighlightsToText, applyHighlightsToHTML } from '../utils/highlightMatching'

interface ContentPanelProps {
  loading: boolean
  title?: string
  html?: string
  markdown?: string
  selectedUrl?: string
  highlights?: Highlight[]
  showUnderlines?: boolean
}

const ContentPanel: React.FC<ContentPanelProps> = ({ 
  loading, 
  title, 
  html, 
  markdown, 
  selectedUrl,
  highlights = [],
  showUnderlines = true
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Filter highlights relevant to the current URL
  const relevantHighlights = useMemo(() => {
    if (!selectedUrl || highlights.length === 0) {
      console.log('🔍 No highlights to filter:', { selectedUrl, highlightsCount: highlights.length })
      return []
    }
    
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
    console.log('🔍 Normalized selected URL:', normalizedSelected)
    
    const filtered = highlights.filter(h => {
      if (!h.urlReference) {
        console.log('⚠️ Highlight has no URL reference:', h.id.slice(0, 8))
        return false
      }
      
      const normalizedRef = normalizeUrl(h.urlReference)
      const matches = normalizedSelected === normalizedRef || 
                     normalizedSelected.includes(normalizedRef) ||
                     normalizedRef.includes(normalizedSelected)
      
      console.log('🔍 URL comparison:', {
        highlightId: h.id.slice(0, 8),
        originalRef: h.urlReference,
        normalizedRef,
        normalizedSelected,
        matches
      })
      
      return matches
    })
    
    console.log('🔍 Filtered highlights:', {
      selectedUrl,
      totalHighlights: highlights.length,
      relevantHighlights: filtered.length,
      highlights: filtered.map(h => ({
        id: h.id.slice(0, 8),
        urlRef: h.urlReference,
        content: h.content.slice(0, 50)
      }))
    })
    
    return filtered
  }, [selectedUrl, highlights])

  // Apply highlights after DOM is rendered
  useEffect(() => {
    console.log('🔍 useEffect triggered:', {
      hasContentRef: !!contentRef.current,
      relevantHighlightsCount: relevantHighlights.length,
      hasHtml: !!html,
      showUnderlines
    })
    
    if (!contentRef.current || relevantHighlights.length === 0 || !showUnderlines) {
      console.log('⚠️ Skipping highlight application:', {
        reason: !contentRef.current ? 'no contentRef' : 
                !showUnderlines ? 'underlines hidden' :
                'no relevant highlights'
      })
      
      // If underlines are hidden, remove any existing highlights
      if (!showUnderlines && contentRef.current) {
        const marks = contentRef.current.querySelectorAll('mark.content-highlight')
        marks.forEach(mark => {
          const text = mark.textContent || ''
          const textNode = document.createTextNode(text)
          mark.parentNode?.replaceChild(textNode, mark)
        })
      }
      
      return
    }
    
    console.log('🔍 Applying highlights to rendered DOM:', {
      highlightsCount: relevantHighlights.length,
      highlights: relevantHighlights.map(h => h.content.slice(0, 50))
    })
    
    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      if (!contentRef.current) return
      
      const originalHTML = contentRef.current.innerHTML
      const highlightedHTML = applyHighlightsToHTML(originalHTML, relevantHighlights)
      
      if (originalHTML !== highlightedHTML) {
        console.log('✅ Applied highlights to DOM')
        contentRef.current.innerHTML = highlightedHTML
      } else {
        console.log('⚠️ No changes made to DOM')
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [relevantHighlights, html, showUnderlines])

  const highlightedMarkdown = useMemo(() => {
    if (!markdown || relevantHighlights.length === 0) return markdown
    // For markdown, we'll apply highlights after rendering
    return markdown
  }, [markdown, relevantHighlights])

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

  const hasHighlights = relevantHighlights.length > 0

  return (
    <div className="reader">
      {title && (
        <div className="reader-header">
          <h2 className="reader-title">{title}</h2>
          {hasHighlights && (
            <div className="highlight-indicator">
              <FontAwesomeIcon icon={faHighlighter} />
              <span>{relevantHighlights.length} highlight{relevantHighlights.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
      {markdown ? (
        <div className="reader-markdown">
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


