import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import ReactPlayer from 'react-player'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypePrism from 'rehype-prism-plus'
import VideoEmbedProcessor from './VideoEmbedProcessor'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import 'prismjs/themes/prism-tomorrow.css'
import { faSpinner, faCheckCircle, faEllipsisH, faExternalLinkAlt, faMobileAlt, faCopy, faShare, faSearch } from '@fortawesome/free-solid-svg-icons'
import { ContentSkeleton } from './Skeletons'
import { nip19 } from 'nostr-tools'
import { getNostrUrl, getSearchUrl } from '../config/nostrGateways'
import { RelayPool } from 'applesauce-relay'
import { getActiveRelayUrls } from '../services/relayManager'
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
import { unarchiveEvent, unarchiveWebsite } from '../services/unarchiveService'
import { archiveController } from '../services/archiveController'
import AuthorCard from './AuthorCard'
import { faBooks } from '../icons/customIcons'
import { extractYouTubeId, getYouTubeMeta } from '../services/youtubeMetaService'
import { classifyUrl, shouldTrackReadingProgress } from '../utils/helpers'
import { buildNativeVideoUrl } from '../utils/videoHelpers'
import { useReadingPosition } from '../hooks/useReadingPosition'
import { ReadingProgressIndicator } from './ReadingProgressIndicator'
import { EventFactory } from 'applesauce-factory'
import { Hooks } from 'applesauce-react'
import { 
  generateArticleIdentifier, 
  loadReadingPosition, 
  saveReadingPosition 
} from '../services/readingPositionService'
import TTSControls from './TTSControls'

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
  // For reading progress indicator positioning
  isSidebarCollapsed?: boolean
  isHighlightsCollapsed?: boolean
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
  onClearSelection,
  isSidebarCollapsed = false,
  isHighlightsCollapsed = false
}) => {
  const [isMarkedAsRead, setIsMarkedAsRead] = useState(false)
  const [isCheckingReadStatus, setIsCheckingReadStatus] = useState(false)
  const [showCheckAnimation, setShowCheckAnimation] = useState(false)
  const [showArticleMenu, setShowArticleMenu] = useState(false)
  const [showVideoMenu, setShowVideoMenu] = useState(false)
  const [showExternalMenu, setShowExternalMenu] = useState(false)
  const [articleMenuOpenUpward, setArticleMenuOpenUpward] = useState(false)
  const [videoMenuOpenUpward, setVideoMenuOpenUpward] = useState(false)
  const [externalMenuOpenUpward, setExternalMenuOpenUpward] = useState(false)
  const articleMenuRef = useRef<HTMLDivElement>(null)
  const videoMenuRef = useRef<HTMLDivElement>(null)
  const externalMenuRef = useRef<HTMLDivElement>(null)
  const [ytMeta, setYtMeta] = useState<{ title?: string; description?: string; transcript?: string } | null>(null)
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

  // Get event store for reading position service
  const eventStore = Hooks.useEventStore()
  
  // Reading position tracking - only for text content, not videos
  const isTextContent = !loading && !!(markdown || html) && !selectedUrl?.includes('youtube') && !selectedUrl?.includes('vimeo')
  
  // Generate article identifier for saving/loading position
  const articleIdentifier = useMemo(() => {
    if (!selectedUrl) return null
    return generateArticleIdentifier(selectedUrl)
  }, [selectedUrl])

  // Callback to save reading position
  const handleSavePosition = useCallback(async (position: number) => {
    if (!activeAccount || !relayPool || !eventStore || !articleIdentifier) {
      return
    }
    if (!settings?.syncReadingPosition) {
      return
    }
    
    // Check if content is long enough to track reading progress
    if (!shouldTrackReadingProgress(html, markdown)) {
      return
    }

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop

    try {
      const factory = new EventFactory({ signer: activeAccount })
      await saveReadingPosition(
        relayPool,
        eventStore,
        factory,
        articleIdentifier,
        {
          position,
          timestamp: Math.floor(Date.now() / 1000),
          scrollTop
        }
      )
    } catch (error) {
      console.error('[progress] ❌ ContentPanel: Failed to save reading position:', error)
    }
  }, [activeAccount, relayPool, eventStore, articleIdentifier, settings?.syncReadingPosition, html, markdown])

  const { progressPercentage, saveNow } = useReadingPosition({
    enabled: isTextContent,
    syncEnabled: settings?.syncReadingPosition !== false,
    onSave: handleSavePosition,
    onReadingComplete: () => {
      // Auto-mark as read when reading is complete (if enabled in settings)
      if (!settings?.autoMarkAsReadOnCompletion || !activeAccount) return
      if (!isMarkedAsRead) {
        handleMarkAsRead()
      } else {
        // Already archived: still show the success animation for feedback
        setShowCheckAnimation(true)
        setTimeout(() => setShowCheckAnimation(false), 600)
      }
    }
  })
  
  // Log sync status when it changes
  useEffect(() => {
  }, [isTextContent, settings?.syncReadingPosition, activeAccount, relayPool, eventStore, articleIdentifier, progressPercentage])

  // Load saved reading position when article loads
  useEffect(() => {
    if (!isTextContent || !activeAccount || !relayPool || !eventStore || !articleIdentifier) {
      return
    }
    if (settings?.syncReadingPosition === false) {
      return
    }

    const loadPosition = async () => {
      try {
        const savedPosition = await loadReadingPosition(
          relayPool,
          eventStore,
          activeAccount.pubkey,
          articleIdentifier
        )

        if (savedPosition && savedPosition.position > 0.05 && savedPosition.position < 1) {
          // Wait for content to be fully rendered before scrolling
          setTimeout(() => {
            const documentHeight = document.documentElement.scrollHeight
            const windowHeight = window.innerHeight
            const scrollTop = savedPosition.position * (documentHeight - windowHeight)
            
            window.scrollTo({
              top: scrollTop,
              behavior: 'smooth'
            })
          }, 500) // Give content time to render
        } else if (savedPosition) {
          if (savedPosition.position === 1) {
            // Article was completed, start from top
          } else {
            // Position was too early, skip restore
          }
        }
      } catch (error) {
        console.error('❌ [ContentPanel] Failed to load reading position:', error)
      }
    }

    loadPosition()
  }, [isTextContent, activeAccount, relayPool, eventStore, articleIdentifier, settings?.syncReadingPosition, selectedUrl])

  // Save position before unmounting or changing article
  useEffect(() => {
    return () => {
      if (saveNow) {
        saveNow()
      }
    }
  }, [saveNow, selectedUrl])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (articleMenuRef.current && !articleMenuRef.current.contains(target)) {
        setShowArticleMenu(false)
      }
      if (videoMenuRef.current && !videoMenuRef.current.contains(target)) {
        setShowVideoMenu(false)
      }
      if (externalMenuRef.current && !externalMenuRef.current.contains(target)) {
        setShowExternalMenu(false)
      }
    }
    
    if (showArticleMenu || showVideoMenu || showExternalMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showArticleMenu, showVideoMenu, showExternalMenu])

  // Check available space and position menu upward if needed
  useEffect(() => {
    const checkMenuPosition = (menuRef: React.RefObject<HTMLDivElement>, setOpenUpward: (value: boolean) => void) => {
      if (!menuRef.current) return

      const menuWrapper = menuRef.current
      const menuElement = menuWrapper.querySelector('.article-menu') as HTMLElement
      if (!menuElement) return

      const rect = menuWrapper.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const menuHeight = menuElement.offsetHeight || 300 // estimate if not rendered yet

      // Open upward if there's not enough space below (with 20px buffer)
      setOpenUpward(spaceBelow < menuHeight + 20 && rect.top > menuHeight)
    }

    if (showArticleMenu) {
      checkMenuPosition(articleMenuRef, setArticleMenuOpenUpward)
    }
    if (showVideoMenu) {
      checkMenuPosition(videoMenuRef, setVideoMenuOpenUpward)
    }
    if (showExternalMenu) {
      checkMenuPosition(externalMenuRef, setExternalMenuOpenUpward)
    }
  }, [showArticleMenu, showVideoMenu, showExternalMenu])

  const readingStats = useMemo(() => {
    const content = markdown || html || ''
    if (!content) return null
    const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
    return readingTime(textContent)
  }, [html, markdown])

  const hasHighlights = relevantHighlights.length > 0

  // Extract plain text for TTS
  const baseHtml = useMemo(() => {
    if (markdown) return renderedMarkdownHtml && finalHtml ? finalHtml : ''
    return finalHtml || html || ''
  }, [markdown, renderedMarkdownHtml, finalHtml, html])

  const articleText = useMemo(() => {
    const parts: string[] = []
    if (title) parts.push(title)
    if (summary) parts.push(summary)
    if (baseHtml) {
      const div = document.createElement('div')
      div.innerHTML = baseHtml
      const txt = (div.textContent || '').replace(/\s+/g, ' ').trim()
      if (txt) parts.push(txt)
    }
    return parts.join('. ')
  }, [title, summary, baseHtml])

  // Determine if we're on a nostr-native article (/a/) or external URL (/r/)
  const isNostrArticle = selectedUrl && selectedUrl.startsWith('nostr:')
  const isExternalVideo = !isNostrArticle && !!selectedUrl && ['youtube', 'video'].includes(classifyUrl(selectedUrl).type)

  // Track external video duration (in seconds) for display in header
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null)
  // Load YouTube metadata/captions when applicable
  useEffect(() => {
    (async () => {
      try {
        if (!selectedUrl) return setYtMeta(null)
        const id = extractYouTubeId(selectedUrl)
        if (!id) return setYtMeta(null)
        const locale = navigator?.language?.split('-')[0] || 'en'
        const data = await getYouTubeMeta(id, locale)
        if (data) setYtMeta({ title: data.title, description: data.description, transcript: data.transcript })
      } catch {
        setYtMeta(null)
      }
    })()
  }, [selectedUrl])

  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
    const ss = String(seconds).padStart(2, '0')
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
  }
  

  // Get article links for menu
  const getArticleLinks = () => {
    if (!currentArticle) return null

    const dTag = currentArticle.tags.find(t => t[0] === 'd')?.[1] || ''
    const activeRelays = relayPool ? getActiveRelayUrls(relayPool) : []
    const relayHints = activeRelays.filter(r => 
      !r.includes('localhost') && !r.includes('127.0.0.1')
    ).slice(0, 3)

    const naddr = nip19.naddrEncode({
      kind: 30023,
      pubkey: currentArticle.pubkey,
      identifier: dTag,
      relays: relayHints
    })

    // Check for source URL in 'r' tags
    const sourceUrl = currentArticle.tags.find(t => t[0] === 'r')?.[1]

    return {
      portal: getNostrUrl(naddr),
      native: `nostr:${naddr}`,
      naddr,
      sourceUrl,
      borisUrl: `${window.location.origin}/a/${naddr}`
    }
  }

  const articleLinks = getArticleLinks()

  const handleMenuToggle = () => {
    setShowArticleMenu(!showArticleMenu)
  }

  const toggleVideoMenu = () => setShowVideoMenu(v => !v)

  const handleOpenPortal = () => {
    if (articleLinks) {
      window.open(articleLinks.portal, '_blank', 'noopener,noreferrer')
    }
    setShowArticleMenu(false)
  }

  const handleOpenNative = () => {
    if (articleLinks) {
      window.location.href = articleLinks.native
    }
    setShowArticleMenu(false)
  }

  const handleShareBoris = async () => {
    try {
      if (!articleLinks) return
      
      if ((navigator as { share?: (d: { title?: string; url?: string }) => Promise<void> }).share) {
        await (navigator as { share: (d: { title?: string; url?: string }) => Promise<void> }).share({ 
          title: title || 'Article', 
          url: articleLinks.borisUrl 
        })
      } else {
        await navigator.clipboard.writeText(articleLinks.borisUrl)
      }
    } catch (e) {
      console.warn('Share failed', e)
    } finally {
      setShowArticleMenu(false)
    }
  }

  const handleShareOriginal = async () => {
    try {
      if (!articleLinks?.sourceUrl) return
      
      if ((navigator as { share?: (d: { title?: string; url?: string }) => Promise<void> }).share) {
        await (navigator as { share: (d: { title?: string; url?: string }) => Promise<void> }).share({ 
          title: title || 'Article', 
          url: articleLinks.sourceUrl 
        })
      } else {
        await navigator.clipboard.writeText(articleLinks.sourceUrl)
      }
    } catch (e) {
      console.warn('Share failed', e)
    } finally {
      setShowArticleMenu(false)
    }
  }

  const handleCopyBoris = async () => {
    try {
      if (!articleLinks) return
      await navigator.clipboard.writeText(articleLinks.borisUrl)
    } catch (e) {
      console.warn('Copy failed', e)
    } finally {
      setShowArticleMenu(false)
    }
  }

  const handleCopyOriginal = async () => {
    try {
      if (!articleLinks?.sourceUrl) return
      await navigator.clipboard.writeText(articleLinks.sourceUrl)
    } catch (e) {
      console.warn('Copy failed', e)
    } finally {
      setShowArticleMenu(false)
    }
  }

  const handleOpenSearch = () => {
    if (articleLinks) {
      window.open(getSearchUrl(articleLinks.naddr), '_blank', 'noopener,noreferrer')
    }
    setShowArticleMenu(false)
  }
  
  // Video actions
  const handleOpenVideoExternal = () => {
    if (selectedUrl) window.open(selectedUrl, '_blank', 'noopener,noreferrer')
    setShowVideoMenu(false)
  }

  const handleOpenVideoNative = () => {
    if (!selectedUrl) return
    const native = buildNativeVideoUrl(selectedUrl)
    if (native) {
      window.location.href = native
    } else {
      window.location.href = selectedUrl
    }
    setShowVideoMenu(false)
  }

  const handleCopyVideoUrl = async () => {
    try {
      if (selectedUrl) await navigator.clipboard.writeText(selectedUrl)
    } catch (e) {
      console.warn('Clipboard copy failed', e)
    } finally {
      setShowVideoMenu(false)
    }
  }

  const handleShareVideoUrl = async () => {
    try {
      if (selectedUrl && (navigator as { share?: (d: { title?: string; url?: string }) => Promise<void> }).share) {
        await (navigator as { share: (d: { title?: string; url?: string }) => Promise<void> }).share({ title: title || 'Video', url: selectedUrl })
      } else if (selectedUrl) {
        await navigator.clipboard.writeText(selectedUrl)
      }
    } catch (e) {
      console.warn('Share failed', e)
    } finally {
      setShowVideoMenu(false)
    }
  }

  // External article actions
  const toggleExternalMenu = () => setShowExternalMenu(v => !v)

  const handleOpenExternalUrl = () => {
    if (selectedUrl) window.open(selectedUrl, '_blank', 'noopener,noreferrer')
    setShowExternalMenu(false)
  }

  const handleCopyExternalUrl = async () => {
    try {
      if (selectedUrl) await navigator.clipboard.writeText(selectedUrl)
    } catch (e) {
      console.warn('Clipboard copy failed', e)
    } finally {
      setShowExternalMenu(false)
    }
  }

  const handleShareExternalUrl = async () => {
    try {
      if (!selectedUrl) return
      const borisUrl = `${window.location.origin}/r/${encodeURIComponent(selectedUrl)}`
      
      if ((navigator as { share?: (d: { title?: string; url?: string }) => Promise<void> }).share) {
        await (navigator as { share: (d: { title?: string; url?: string }) => Promise<void> }).share({ 
          title: title || 'Article', 
          url: borisUrl 
        })
      } else {
        await navigator.clipboard.writeText(borisUrl)
      }
    } catch (e) {
      console.warn('Share failed', e)
    } finally {
      setShowExternalMenu(false)
    }
  }

  const handleSearchExternalUrl = () => {
    if (selectedUrl) {
      window.open(getSearchUrl(selectedUrl), '_blank', 'noopener,noreferrer')
    }
    setShowExternalMenu(false)
  }
  
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
          // Also check archiveController
          const dTag = currentArticle.tags.find(t => t[0] === 'd')?.[1]
          if (dTag) {
            try {
              const naddr = nip19.naddrEncode({ kind: 30023, pubkey: currentArticle.pubkey, identifier: dTag })
              hasRead = hasRead || archiveController.isMarked(naddr)
            } catch (e) {
              // Silently ignore encoding errors
            }
          }
        } else {
          hasRead = await hasMarkedWebsiteAsRead(
            selectedUrl,
            activeAccount.pubkey,
            relayPool
          )
          // Also check archiveController
          const ctrl = archiveController.isMarked(selectedUrl)
          hasRead = hasRead || ctrl
        }
        setIsMarkedAsRead(hasRead)
      } catch (error) {
        console.error('Failed to check read status:', error)
      } finally {
        setIsCheckingReadStatus(false)
      }
    }

    checkReadStatus()
  }, [selectedUrl, currentArticle, activeAccount, relayPool, isNostrArticle])
  
  const handleMarkAsRead = () => {
    if (!activeAccount || !relayPool) return

    // Toggle archive state: if already archived, request deletion; else archive
    if (isMarkedAsRead) {
      // Optimistically unarchive in UI; background deletion request (NIP-09)
      setIsMarkedAsRead(false)
      ;(async () => {
        try {
          if (isNostrArticle && currentArticle) {
            // Send deletion for all matching reactions
            await unarchiveEvent(currentArticle.id, activeAccount, relayPool)
            // Also clear controller mark so lists update
            try {
              const dTag = currentArticle.tags.find(t => t[0] === 'd')?.[1]
              if (dTag) {
                const naddr = nip19.naddrEncode({ kind: 30023, pubkey: currentArticle.pubkey, identifier: dTag })
                archiveController.unmark(naddr)
              }
            } catch (e) {
              console.warn('[archive][content] encode naddr failed', e)
            }
          } else if (selectedUrl) {
            await unarchiveWebsite(selectedUrl, activeAccount, relayPool)
            archiveController.unmark(selectedUrl)
          }
        } catch (err) {
          console.warn('[archive][content] unarchive failed', err)
        }
      })()
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
            relayPool,
            {
              aCoord: (() => {
                try {
                  const dTag = currentArticle.tags.find(t => t[0] === 'd')?.[1]
                  if (!dTag) return undefined
                  return `${30023}:${currentArticle.pubkey}:${dTag}`
                } catch { return undefined }
              })()
            }
          )
          // Update archiveController immediately
          try {
            const dTag = currentArticle.tags.find(t => t[0] === 'd')?.[1]
            if (dTag) {
              const naddr = nip19.naddrEncode({ kind: 30023, pubkey: currentArticle.pubkey, identifier: dTag })
              archiveController.mark(naddr)
            }
          } catch (err) {
            console.warn('[archive][content] optimistic article mark failed', err)
          }
        } else if (selectedUrl) {
          await createWebsiteReaction(
            selectedUrl,
            activeAccount,
            relayPool
          )
          archiveController.mark(selectedUrl)
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
      <div className="reader" aria-busy="true">
        <ContentSkeleton />
      </div>
    )
  }

  const highlightRgb = hexToRgb(highlightColor)

  return (
    <>
      {/* Reading Progress Indicator - Outside reader for fixed positioning */}
      {isTextContent && (
        <ReadingProgressIndicator 
          progress={progressPercentage}
          // Consider complete only at 95%+
          isComplete={progressPercentage >= 95}
          showPercentage={true}
          isSidebarCollapsed={isSidebarCollapsed}
          isHighlightsCollapsed={isHighlightsCollapsed}
        />
      )}
      
      <div className="reader" style={{ '--highlight-rgb': highlightRgb } as React.CSSProperties}>
        {/* Hidden markdown preview to convert markdown to HTML */}
      {markdown && (
        <div ref={markdownPreviewRef} style={{ display: 'none' }}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypePrism]}
            components={{
              img: ({ src, alt }) => (
                <img 
                  src={src} 
                  alt={alt} 
                />
              )
            }}
          >
            {processedMarkdown || markdown}
          </ReactMarkdown>
        </div>
      )}
      
      <ReaderHeader 
        title={ytMeta?.title || title}
        image={image}
        summary={summary}
        published={published}
        readingTimeText={isExternalVideo ? (videoDurationSec !== null ? formatDuration(videoDurationSec) : null) : (readingStats ? readingStats.text : null)}
        hasHighlights={hasHighlights}
        highlightCount={relevantHighlights.length}
        settings={settings}
        highlights={relevantHighlights}
        highlightVisibility={highlightVisibility}
      />
      {isTextContent && articleText && (
        <div style={{ padding: '0 0.75rem 0.5rem 0.75rem' }}>
          <TTSControls text={articleText} defaultLang={navigator?.language} />
        </div>
      )}
      {isExternalVideo ? (
        <>
          <div className="reader-video">
            <ReactPlayer 
              url={selectedUrl as string} 
              controls 
              width="100%"
              height="auto"
              style={{ 
                width: '100%', 
                height: 'auto', 
                aspectRatio: '16/9' 
              }}
              onDuration={(d) => setVideoDurationSec(Math.floor(d))}
            />
          </div>
          {ytMeta?.description && (
            <div className="large-text" style={{ color: '#ddd', padding: '0 0.75rem', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>
              {ytMeta.description}
            </div>
          )}
          {ytMeta?.transcript && (
            <div style={{ padding: '0 0.75rem 1rem 0.75rem' }}>
              <h3 style={{ margin: '1rem 0 0.5rem 0', fontSize: '1rem', color: '#aaa' }}>Transcript</h3>
              <div className="large-text" style={{ whiteSpace: 'pre-wrap', color: '#ddd' }}>
                {ytMeta.transcript}
              </div>
            </div>
          )}
          <div className="article-menu-container">
            <div className="article-menu-wrapper" ref={videoMenuRef}>
              <button
                className="article-menu-btn"
                onClick={toggleVideoMenu}
                title="More options"
              >
                <FontAwesomeIcon icon={faEllipsisH} />
              </button>
              {showVideoMenu && (
                <div className={`article-menu ${videoMenuOpenUpward ? 'open-upward' : ''}`}>
                  <button className="article-menu-item" onClick={handleOpenVideoExternal}>
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                    <span>Open Link</span>
                  </button>
                  <button className="article-menu-item" onClick={handleOpenVideoNative}>
                    <FontAwesomeIcon icon={faMobileAlt} />
                    <span>Open in Native App</span>
                  </button>
                  <button className="article-menu-item" onClick={handleCopyVideoUrl}>
                    <FontAwesomeIcon icon={faCopy} />
                    <span>Copy URL</span>
                  </button>
                  <button className="article-menu-item" onClick={handleShareVideoUrl}>
                    <FontAwesomeIcon icon={faShare} />
                    <span>Share</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          {activeAccount && (
            <div className="mark-as-read-container">
              <button
                className={`mark-as-read-btn ${isMarkedAsRead ? 'marked' : ''} ${showCheckAnimation ? 'animating' : ''}`}
                onClick={handleMarkAsRead}
                disabled={isCheckingReadStatus}
                title={isMarkedAsRead ? 'Already Marked as Watched' : 'Mark as Watched'}
                style={isMarkedAsRead ? { opacity: 0.85 } : undefined}
              >
                <FontAwesomeIcon 
                  icon={isCheckingReadStatus ? faSpinner : isMarkedAsRead ? faCheckCircle : faBooks} 
                  spin={isCheckingReadStatus} 
                />
                <span>
                  {isCheckingReadStatus ? 'Checking...' : isMarkedAsRead ? 'Marked as Watched' : 'Mark as Watched'}
                </span>
              </button>
            </div>
          )}
        </>
      ) : markdown || html ? (
        <>
          {markdown ? (
            renderedMarkdownHtml && finalHtml ? (
              <VideoEmbedProcessor
                ref={contentRef}
                html={finalHtml}
                renderVideoLinksAsEmbeds={settings?.renderVideoLinksAsEmbeds === true && !isExternalVideo}
                className="reader-markdown"
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
            <VideoEmbedProcessor
              ref={contentRef}
              html={finalHtml || html || ''}
              renderVideoLinksAsEmbeds={settings?.renderVideoLinksAsEmbeds === true && !isExternalVideo}
              className="reader-html"
              onMouseUp={handleSelectionEnd}
              onTouchEnd={handleSelectionEnd}
            />
          )}
          
          {/* Article menu for external URLs */}
          {!isNostrArticle && !isExternalVideo && selectedUrl && (
            <div className="article-menu-container">
              <div className="article-menu-wrapper" ref={externalMenuRef}>
                <button
                  className="article-menu-btn"
                  onClick={toggleExternalMenu}
                  title="More options"
                >
                  <FontAwesomeIcon icon={faEllipsisH} />
                </button>
                
                {showExternalMenu && (
                  <div className={`article-menu ${externalMenuOpenUpward ? 'open-upward' : ''}`}>
                    <button
                      className="article-menu-item"
                      onClick={handleShareExternalUrl}
                    >
                      <FontAwesomeIcon icon={faShare} />
                      <span>Share</span>
                    </button>
                    <button
                      className="article-menu-item"
                      onClick={handleCopyExternalUrl}
                    >
                      <FontAwesomeIcon icon={faCopy} />
                      <span>Copy URL</span>
                    </button>
                    <button
                      className="article-menu-item"
                      onClick={handleOpenExternalUrl}
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      <span>Open Original</span>
                    </button>
                    <button
                      className="article-menu-item"
                      onClick={handleSearchExternalUrl}
                    >
                      <FontAwesomeIcon icon={faSearch} />
                      <span>Search</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Article menu for nostr-native articles */}
          {isNostrArticle && currentArticle && articleLinks && (
            <div className="article-menu-container">
              <div className="article-menu-wrapper" ref={articleMenuRef}>
                <button
                  className="article-menu-btn"
                  onClick={handleMenuToggle}
                  title="More options"
                >
                  <FontAwesomeIcon icon={faEllipsisH} />
                </button>
                
                {showArticleMenu && (
                  <div className={`article-menu ${articleMenuOpenUpward ? 'open-upward' : ''}`}>
                    <button
                      className="article-menu-item"
                      onClick={handleShareBoris}
                    >
                      <FontAwesomeIcon icon={faShare} />
                      <span>Share</span>
                    </button>
                    {articleLinks.sourceUrl && (
                      <button
                        className="article-menu-item"
                        onClick={handleShareOriginal}
                      >
                        <FontAwesomeIcon icon={faShare} />
                        <span>Share Original</span>
                      </button>
                    )}
                    <button
                      className="article-menu-item"
                      onClick={handleCopyBoris}
                    >
                      <FontAwesomeIcon icon={faCopy} />
                      <span>Copy Link</span>
                    </button>
                    {articleLinks.sourceUrl && (
                      <button
                        className="article-menu-item"
                        onClick={handleCopyOriginal}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                        <span>Copy Original</span>
                      </button>
                    )}
                    <button
                      className="article-menu-item"
                      onClick={handleOpenSearch}
                    >
                      <FontAwesomeIcon icon={faSearch} />
                      <span>Search</span>
                    </button>
                    <button
                      className="article-menu-item"
                      onClick={handleOpenPortal}
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      <span>Open with njump</span>
                    </button>
                    <button
                      className="article-menu-item"
                      onClick={handleOpenNative}
                    >
                      <FontAwesomeIcon icon={faMobileAlt} />
                      <span>Open with Native App</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Archive button */}
          {activeAccount && (
            <div className="mark-as-read-container">
              <button
                className={`mark-as-read-btn ${isMarkedAsRead ? 'marked' : ''} ${showCheckAnimation ? 'animating' : ''}`}
                onClick={handleMarkAsRead}
                disabled={isCheckingReadStatus}
                title={isMarkedAsRead ? 'Already Archived' : 'Move to Archive'}
                style={isMarkedAsRead ? { opacity: 0.85 } : undefined}
              >
                <FontAwesomeIcon 
                  icon={isCheckingReadStatus ? faSpinner : isMarkedAsRead ? faCheckCircle : faBooks} 
                  spin={isCheckingReadStatus} 
                />
                <span>
                  {isCheckingReadStatus ? 'Checking...' : isMarkedAsRead ? 'Archived' : 'Move to Archive'}
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
    </>
  )
}

export default ContentPanel
