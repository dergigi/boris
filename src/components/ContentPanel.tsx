import React, { useMemo, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faHighlighter, faClock } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { applyHighlightsToHTML } from '../utils/highlightMatching'
import { readingTime } from 'reading-time-estimator'
import { filterHighlightsByUrl } from '../utils/urlHelpers'
import { hexToRgb } from '../utils/colorHelpers'

interface ContentPanelProps {
  loading: boolean
  title?: string
  html?: string
  markdown?: string
  selectedUrl?: string
  image?: string
  highlights?: Highlight[]
  showUnderlines?: boolean
  highlightStyle?: 'marker' | 'underline'
  highlightColor?: string
  onHighlightClick?: (highlightId: string) => void
  selectedHighlightId?: string
}

const ContentPanel: React.FC<ContentPanelProps> = ({ 
  loading, 
  title, 
  html, 
  markdown, 
  selectedUrl,
  image,
  highlights = [],
  showUnderlines = true,
  highlightStyle = 'marker',
  highlightColor = '#ffff00',
  onHighlightClick,
  selectedHighlightId
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const markdownPreviewRef = useRef<HTMLDivElement>(null)
  const [renderedHtml, setRenderedHtml] = useState<string>('')
  
  const relevantHighlights = useMemo(() => filterHighlightsByUrl(highlights, selectedUrl), [selectedUrl, highlights])

  // Convert markdown to HTML when markdown content changes
  useEffect(() => {
    if (!markdown) {
      setRenderedHtml('')
      return
    }

    // Use requestAnimationFrame to ensure ReactMarkdown has rendered
    const rafId = requestAnimationFrame(() => {
      if (markdownPreviewRef.current) {
        setRenderedHtml(markdownPreviewRef.current.innerHTML)
      }
    })

    return () => cancelAnimationFrame(rafId)
  }, [markdown])

  // Prepare the final HTML with highlights applied
  const finalHtml = useMemo(() => {
    const sourceHtml = markdown ? renderedHtml : html
    if (!sourceHtml) return ''
    
    // Apply highlights if we have them and underlines are shown
    if (showUnderlines && relevantHighlights.length > 0) {
      return applyHighlightsToHTML(sourceHtml, relevantHighlights, highlightStyle)
    }
    
    return sourceHtml
  }, [html, renderedHtml, markdown, relevantHighlights, showUnderlines, highlightStyle])

  // Attach click handlers to highlight marks
  useEffect(() => {
    if (!onHighlightClick || !contentRef.current) return
    
    const marks = contentRef.current.querySelectorAll('mark[data-highlight-id]')
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
  }, [onHighlightClick, finalHtml])

  // Scroll to selected highlight in article when clicked from sidebar
  useEffect(() => {
    if (!selectedHighlightId || !contentRef.current) return
    
    const markElement = contentRef.current.querySelector(`mark[data-highlight-id="${selectedHighlightId}"]`)
    
    if (markElement) {
      markElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      
      // Add pulsing animation after scroll completes
      const htmlElement = markElement as HTMLElement
      setTimeout(() => {
        htmlElement.classList.add('highlight-pulse')
        setTimeout(() => htmlElement.classList.remove('highlight-pulse'), 1500)
      }, 500)
    }
  }, [selectedHighlightId, finalHtml])

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

  const highlightRgb = hexToRgb(highlightColor)

  return (
    <div className="reader" style={{ '--highlight-rgb': highlightRgb } as React.CSSProperties}>
      {/* Hidden markdown preview to convert markdown to HTML */}
      {markdown && (
        <div ref={markdownPreviewRef} style={{ display: 'none' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdown}
          </ReactMarkdown>
        </div>
      )}
      
      {image && (
        <div className="reader-hero-image">
          <img src={image} alt={title || 'Article image'} />
        </div>
      )}
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
      {markdown || html ? (
        finalHtml ? (
          <div 
            ref={contentRef} 
            className={markdown ? "reader-markdown" : "reader-html"} 
            dangerouslySetInnerHTML={{ __html: finalHtml }} 
          />
        ) : markdown && relevantHighlights.length === 0 ? (
          <div 
            ref={contentRef} 
            className="reader-markdown"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        ) : (
          <div className={markdown ? "reader-markdown" : "reader-html"} ref={contentRef} />
        )
      ) : (
        <div className="reader empty">
          <p>No readable content found for this URL.</p>
        </div>
      )}
    </div>
  )
}

export default ContentPanel
