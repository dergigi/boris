import React, { useMemo, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faCheck } from '@fortawesome/free-solid-svg-icons'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { NostrEvent } from 'nostr-tools'
import { Highlight } from '../types/highlights'
import { readingTime } from 'reading-time-estimator'
import { hexToRgb } from '../utils/colorHelpers'
import ReaderHeader from './ReaderHeader'
import { HighlightVisibility } from './HighlightsPanel'
import { useMarkdownToHTML } from '../hooks/useMarkdownToHTML'
import { useHighlightedContent } from '../hooks/useHighlightedContent'
import { useHighlightInteractions } from '../hooks/useHighlightInteractions'
import { UserSettings } from '../services/settingsService'
import { 
  createEventReaction, 
  createWebsiteReaction,
  hasMarkedEventAsRead,
  hasMarkedWebsiteAsRead
} from '../services/reactionService'
import AuthorCard from './AuthorCard'
import { faBooks } from '../icons/customIcons'

interface ContentPanelProps {
  loading: boolean
  title?: string
  html?: string
  markdown?: string
  selectedUrl?: string
  image?: string
  summary?: string
  published?: number
  highlights?: Highlight[]
  showHighlights?: boolean
  highlightStyle?: 'marker' | 'underline'
  highlightColor?: string
  onHighlightClick?: (highlightId: string) => void
  selectedHighlightId?: string
  highlightVisibility?: HighlightVisibility
  currentUserPubkey?: string
  followedPubkeys?: Set<string>
  settings?: UserSettings
  relayPool?: RelayPool | null
  activeAccount?: IAccount | null
  currentArticle?: NostrEvent | null
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
  published,
  highlights = [],
  showHighlights = true,
  highlightStyle = 'marker',
  highlightColor = '#ffff00',
  settings,
  relayPool,
  activeAccount,
  currentArticle,
  onHighlightClick,
  selectedHighlightId,
  highlightVisibility = { nostrverse: true, friends: true, mine: true },
  currentUserPubkey,
  followedPubkeys = new Set(),
  onTextSelection,
  onClearSelection
}) => {
  const [isMarkedAsRead, setIsMarkedAsRead] = useState(false)
  const [isCheckingReadStatus, setIsCheckingReadStatus] = useState(false)
  const [showCheckAnimation, setShowCheckAnimation] = useState(false)
  const { renderedHtml: renderedMarkdownHtml, previewRef: markdownPreviewRef, processedMarkdown } = useMarkdownToHTML(markdown, relayPool)
  
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

  const { contentRef, handleSelectionEnd } = useHighlightInteractions({
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

  // Determine if we're on a nostr-native article (/a/) or external URL (/r/)
  const isNostrArticle = selectedUrl && selectedUrl.startsWith('nostr:')
  
  // Check if article is already marked as read when URL/article changes
  useEffect(() => {
    const checkReadStatus = async () => {
      if (!activeAccount || !relayPool || !selectedUrl) {
        setIsMarkedAsRead(false)
        return
      }

      setIsCheckingReadStatus(true)

      try {
        let hasRead = false
        if (isNostrArticle && currentArticle) {
          hasRead = await hasMarkedEventAsRead(
            currentArticle.id,
            activeAccount.pubkey,
            relayPool
          )
        } else {
          hasRead = await hasMarkedWebsiteAsRead(
            selectedUrl,
            activeAccount.pubkey,
            relayPool
          )
        }
        setIsMarkedAsRead(hasRead)
      } catch (error) {
        console.error('Failed to check read status:', error)
      } finally {
        setIsCheckingReadStatus(false)
      }
    }

    checkReadStatus()
  }, [selectedUrl, currentArticle?.id, activeAccount, relayPool, isNostrArticle])
  
  const handleMarkAsRead = () => {
    if (!activeAccount || !relayPool || isMarkedAsRead) {
      return
    }

    // Instantly update UI with checkmark animation
    setIsMarkedAsRead(true)
    setShowCheckAnimation(true)

    // Reset animation after it completes
    setTimeout(() => {
      setShowCheckAnimation(false)
    }, 600)

    // Fire-and-forget: publish in background without blocking UI
    ;(async () => {
      try {
        if (isNostrArticle && currentArticle) {
          await createEventReaction(
            currentArticle.id,
            currentArticle.pubkey,
            currentArticle.kind,
            activeAccount,
            relayPool
          )
          console.log('✅ Marked nostr article as read')
        } else if (selectedUrl) {
          await createWebsiteReaction(
            selectedUrl,
            activeAccount,
            relayPool
          )
          console.log('✅ Marked website as read')
        }
      } catch (error) {
        console.error('Failed to mark as read:', error)
        // Revert UI state on error
        setIsMarkedAsRead(false)
      }
    })()
  }

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
            {processedMarkdown || markdown}
          </ReactMarkdown>
        </div>
      )}
      
      <ReaderHeader 
        title={title}
        image={image}
        summary={summary}
        published={published}
        readingTimeText={readingStats ? readingStats.text : null}
        hasHighlights={hasHighlights}
        highlightCount={relevantHighlights.length}
        settings={settings}
        highlights={relevantHighlights}
        highlightVisibility={highlightVisibility}
      />
      {markdown || html ? (
        <>
          {markdown ? (
            renderedMarkdownHtml && finalHtml ? (
              <div 
                ref={contentRef} 
                className="reader-markdown" 
                dangerouslySetInnerHTML={{ __html: finalHtml }}
                onMouseUp={handleSelectionEnd}
                onTouchEnd={handleSelectionEnd}
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
              onMouseUp={handleSelectionEnd}
              onTouchEnd={handleSelectionEnd}
            />
          )}
          
          {/* Mark as Read button */}
          {activeAccount && (
            <div className="mark-as-read-container">
              <button
                className={`mark-as-read-btn ${isMarkedAsRead ? 'marked' : ''} ${showCheckAnimation ? 'animating' : ''}`}
                onClick={handleMarkAsRead}
                disabled={isMarkedAsRead || isCheckingReadStatus}
                title={isMarkedAsRead ? 'Already Marked as Read' : 'Mark as Read'}
              >
                <FontAwesomeIcon 
                  icon={isCheckingReadStatus ? faSpinner : isMarkedAsRead ? faCheck : faBooks} 
                  spin={isCheckingReadStatus} 
                />
                <span>
                  {isCheckingReadStatus ? 'Checking...' : isMarkedAsRead ? 'Marked as Read' : 'Mark as Read'}
                </span>
              </button>
            </div>
          )}
          
          {/* Author info card for nostr-native articles */}
          {isNostrArticle && currentArticle && (
            <div className="author-card-container">
              <AuthorCard authorPubkey={currentArticle.pubkey} />
            </div>
          )}
        </>
      ) : (
        <div className="reader empty">
          <p>No readable content found for this URL.</p>
        </div>
      )}
    </div>
  )
}

export default ContentPanel
