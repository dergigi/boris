import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { applyHighlightsToHTML } from '../utils/highlightMatching'
import { readingTime } from 'reading-time-estimator'
import { filterHighlightsByUrl } from '../utils/urlHelpers'
import { hexToRgb } from '../utils/colorHelpers'
import ReaderHeader from './ReaderHeader'
import { HighlightVisibility } from './HighlightsPanel'

interface ContentPanelProps {
  loading: boolean
  title?: string
  html?: string
  markdown?: string
  selectedUrl?: string
  image?: string
  highlights?: Highlight[]
  showHighlights?: boolean
  highlightStyle?: 'marker' | 'underline'
  highlightColor?: string
  onHighlightClick?: (highlightId: string) => void
  selectedHighlightId?: string
  highlightVisibility?: HighlightVisibility
  currentUserPubkey?: string
  followedPubkeys?: Set<string>
  // For highlight creation
  onTextSelection?: (text: string) => void
  onClearSelection?: () => void
}

const ContentPanel: React.FC<ContentPanelProps> = ({ 
  loading, 
  title, 
  html, 
  markdown, 
  selectedUrl,
  image,
  highlights = [],
  showHighlights = true,
  highlightStyle = 'marker',
  highlightColor = '#ffff00',
  onHighlightClick,
  selectedHighlightId,
  highlightVisibility = { nostrverse: true, friends: true, mine: true },
  currentUserPubkey,
  followedPubkeys = new Set(),
  // For highlight creation
  onTextSelection,
  onClearSelection
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const markdownPreviewRef = useRef<HTMLDivElement>(null)
  const [renderedHtml, setRenderedHtml] = useState<string>('')
  
  // Filter highlights by URL and visibility settings
  const relevantHighlights = useMemo(() => {
    const urlFiltered = filterHighlightsByUrl(highlights, selectedUrl)
    
    // Apply visibility filtering
    return urlFiltered
      .map(h => {
        // Classify highlight level
        let level: 'mine' | 'friends' | 'nostrverse' = 'nostrverse'
        if (h.pubkey === currentUserPubkey) {
          level = 'mine'
        } else if (followedPubkeys.has(h.pubkey)) {
          level = 'friends'
        }
        return { ...h, level }
      })
      .filter(h => {
        // Filter by visibility settings
        if (h.level === 'mine') return highlightVisibility.mine
        if (h.level === 'friends') return highlightVisibility.friends
        return highlightVisibility.nostrverse
      })
  }, [selectedUrl, highlights, highlightVisibility, currentUserPubkey, followedPubkeys])

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
    
    // Apply highlights if we have them and highlights are enabled
    if (showHighlights && relevantHighlights.length > 0) {
      return applyHighlightsToHTML(sourceHtml, relevantHighlights, highlightStyle)
    }
    
    return sourceHtml
  }, [html, renderedHtml, markdown, relevantHighlights, showHighlights, highlightStyle])


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

  // Handle text selection for highlight creation
  const handleMouseUp = useCallback(() => {
    setTimeout(() => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        onClearSelection?.()
        return
      }

      const range = selection.getRangeAt(0)
      const text = selection.toString().trim()

      if (text.length > 0 && contentRef.current?.contains(range.commonAncestorContainer)) {
        onTextSelection?.(text)
      } else {
        onClearSelection?.()
      }
    }, 10)
  }, [onTextSelection, onClearSelection])

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
      
      <ReaderHeader 
        title={title}
        image={image}
        readingTimeText={readingStats ? readingStats.text : null}
        hasHighlights={hasHighlights}
        highlightCount={relevantHighlights.length}
      />
      {markdown || html ? (
        markdown ? (
          finalHtml ? (
            <div 
              ref={contentRef} 
              className="reader-markdown" 
              dangerouslySetInnerHTML={{ __html: finalHtml }}
              onMouseUp={handleMouseUp}
            />
          ) : (
            <div 
              ref={contentRef} 
              className="reader-markdown"
              onMouseUp={handleMouseUp}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown}
              </ReactMarkdown>
            </div>
          )
        ) : (
          <div 
            ref={contentRef} 
            className="reader-html" 
            dangerouslySetInnerHTML={{ __html: finalHtml || html || '' }}
            onMouseUp={handleMouseUp}
          />
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
