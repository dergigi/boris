import React, { useMemo } from 'react'
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
}

const ContentPanel: React.FC<ContentPanelProps> = ({ 
  loading, 
  title, 
  html, 
  markdown, 
  selectedUrl,
  highlights = []
}) => {
  // Filter highlights relevant to the current URL
  const relevantHighlights = useMemo(() => {
    if (!selectedUrl || highlights.length === 0) {
      console.log('🔍 No highlights to filter:', { selectedUrl, highlightsCount: highlights.length })
      return []
    }
    
    const filtered = highlights.filter(h => {
      // Match by URL reference
      if (h.urlReference && selectedUrl.includes(h.urlReference)) return true
      if (h.urlReference && h.urlReference.includes(selectedUrl)) return true
      
      // Normalize URLs for comparison (remove trailing slashes, protocols)
      const normalizeUrl = (url: string) => 
        url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      
      const normalizedSelected = normalizeUrl(selectedUrl)
      const normalizedRef = h.urlReference ? normalizeUrl(h.urlReference) : ''
      
      return normalizedSelected === normalizedRef
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

  // Apply highlights to content
  const highlightedHTML = useMemo(() => {
    if (!html || relevantHighlights.length === 0) {
      console.log('🔍 No HTML highlighting:', { hasHtml: !!html, highlightsCount: relevantHighlights.length })
      return html
    }
    console.log('🔍 Applying highlights to HTML:', { htmlLength: html.length, highlightsCount: relevantHighlights.length })
    const result = applyHighlightsToHTML(html, relevantHighlights)
    console.log('🔍 HTML highlighting result:', { originalLength: html.length, modifiedLength: result.length, changed: html !== result })
    return result
  }, [html, relevantHighlights])

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
      ) : highlightedHTML ? (
        <div className="reader-html" dangerouslySetInnerHTML={{ __html: highlightedHTML }} />
      ) : (
        <div className="reader empty">
          <p>No readable content found for this URL.</p>
        </div>
      )}
    </div>
  )
}

export default ContentPanel


