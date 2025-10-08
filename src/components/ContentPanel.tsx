import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Highlight } from '../types/highlights'
import { readingTime } from 'reading-time-estimator'
import { hexToRgb } from '../utils/colorHelpers'
import ReaderHeader from './ReaderHeader'
import { HighlightVisibility } from './HighlightsPanel'
import { useMarkdownToHTML } from '../hooks/useMarkdownToHTML'
import { useHighlightedContent } from '../hooks/useHighlightedContent'
import { useHighlightInteractions } from '../hooks/useHighlightInteractions'

interface ContentPanelProps {
  loading: boolean
  title?: string
  html?: string
  markdown?: string
  selectedUrl?: string
  image?: string
  summary?: string
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
  summary,
  highlights = [],
  showHighlights = true,
  highlightStyle = 'marker',
  highlightColor = '#ffff00',
  onHighlightClick,
  selectedHighlightId,
  highlightVisibility = { nostrverse: true, friends: true, mine: true },
  currentUserPubkey,
  followedPubkeys = new Set(),
  onTextSelection,
  onClearSelection
}) => {
  const { renderedHtml: renderedMarkdownHtml, previewRef: markdownPreviewRef } = useMarkdownToHTML(markdown)
  
  const { finalHtml, relevantHighlights } = useHighlightedContent({
    html,
    markdown,
    renderedMarkdownHtml,
    highlights,
    showHighlights,
    highlightStyle,
    selectedUrl,
    highlightVisibility,
    currentUserPubkey,
    followedPubkeys
  })

  const { contentRef, handleMouseUp } = useHighlightInteractions({
    onHighlightClick,
    selectedHighlightId,
    onTextSelection,
    onClearSelection
  })

  const readingStats = useMemo(() => {
    const content = markdown || html || ''
    if (!content) return null
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
        summary={summary}
        readingTimeText={readingStats ? readingStats.text : null}
        hasHighlights={hasHighlights}
        highlightCount={relevantHighlights.length}
      />
      {markdown || html ? (
        markdown ? (
          renderedMarkdownHtml && finalHtml ? (
            <div 
              ref={contentRef} 
              className="reader-markdown" 
              dangerouslySetInnerHTML={{ __html: finalHtml }}
              onMouseUp={handleMouseUp}
            />
          ) : (
            <div className="reader-markdown">
              <div className="loading-spinner">
                <FontAwesomeIcon icon={faSpinner} spin size="sm" />
              </div>
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
