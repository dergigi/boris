import React, { useState, useEffect, useRef } from 'react'
import ReactPlayer from 'react-player'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsisH, faExternalLinkAlt, faMobileAlt, faCopy, faShare, faCheckCircle } from '@fortawesome/free-solid-svg-icons'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { UserSettings } from '../services/settingsService'
import { extractYouTubeId, getYouTubeMeta } from '../services/youtubeMetaService'
import { buildNativeVideoUrl } from '../utils/videoHelpers'
import { getYouTubeThumbnail } from '../utils/imagePreview'

// Helper function to get Vimeo thumbnail
const getVimeoThumbnail = (url: string): string | null => {
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (!vimeoMatch) return null
  
  const videoId = vimeoMatch[1]
  return `https://vumbnail.com/${videoId}.jpg`
}
import { 
  createWebsiteReaction,
  hasMarkedWebsiteAsRead
} from '../services/reactionService'
import { unarchiveWebsite } from '../services/unarchiveService'
import ReaderHeader from './ReaderHeader'

interface VideoViewProps {
  videoUrl: string
  title?: string
  image?: string
  summary?: string
  published?: number
  settings?: UserSettings
  relayPool?: RelayPool | null
  activeAccount?: IAccount | null
  onOpenHighlights?: () => void
  noteContent?: string // Content from the original Nostr note
}

const VideoView: React.FC<VideoViewProps> = ({
  videoUrl,
  title,
  image,
  summary,
  published,
  settings,
  relayPool,
  activeAccount,
  onOpenHighlights,
  noteContent
}) => {
  const [isMarkedAsWatched, setIsMarkedAsWatched] = useState(false)
  const [isCheckingWatchedStatus, setIsCheckingWatchedStatus] = useState(false)
  const [showCheckAnimation, setShowCheckAnimation] = useState(false)
  const [showVideoMenu, setShowVideoMenu] = useState(false)
  const [videoMenuOpenUpward, setVideoMenuOpenUpward] = useState(false)
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null)
  const [ytMeta, setYtMeta] = useState<{ title?: string; description?: string; transcript?: string } | null>(null)
  const videoMenuRef = useRef<HTMLDivElement>(null)

  // Load YouTube metadata when applicable
  useEffect(() => {
    (async () => {
      try {
        if (!videoUrl) return setYtMeta(null)
        const id = extractYouTubeId(videoUrl)
        if (!id) return setYtMeta(null)
        const locale = navigator?.language?.split('-')[0] || 'en'
        const data = await getYouTubeMeta(id, locale)
        if (data) setYtMeta({ title: data.title, description: data.description, transcript: data.transcript })
      } catch {
        setYtMeta(null)
      }
    })()
  }, [videoUrl])

  // Check if video is marked as watched
  useEffect(() => {
    const checkWatchedStatus = async () => {
      if (!activeAccount || !videoUrl) return
      
      setIsCheckingWatchedStatus(true)
      try {
        const isWatched = relayPool ? await hasMarkedWebsiteAsRead(videoUrl, activeAccount.pubkey, relayPool) : false
        setIsMarkedAsWatched(isWatched)
      } catch (error) {
        console.warn('Failed to check watched status:', error)
      } finally {
        setIsCheckingWatchedStatus(false)
      }
    }

    checkWatchedStatus()
  }, [activeAccount, videoUrl])

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (videoMenuRef.current && !videoMenuRef.current.contains(target)) {
        setShowVideoMenu(false)
      }
    }
    
    if (showVideoMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showVideoMenu])

  // Check menu position for upward opening
  useEffect(() => {
    const checkMenuPosition = (menuRef: React.RefObject<HTMLDivElement>, setOpenUpward: (upward: boolean) => void) => {
      if (!menuRef.current) return
      
      const rect = menuRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      
      // Open upward if there's more space above and less space below
      setOpenUpward(spaceAbove > spaceBelow && spaceBelow < 200)
    }

    if (showVideoMenu) {
      checkMenuPosition(videoMenuRef, setVideoMenuOpenUpward)
    }
  }, [showVideoMenu])

  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
    const ss = String(seconds).padStart(2, '0')
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
  }

  const handleMarkAsWatched = async () => {
    if (!activeAccount || !videoUrl || isCheckingWatchedStatus) return

    setIsCheckingWatchedStatus(true)
    setShowCheckAnimation(true)

    try {
      if (isMarkedAsWatched) {
        // Unmark as watched
        if (relayPool) {
          await unarchiveWebsite(videoUrl, activeAccount, relayPool)
        }
        setIsMarkedAsWatched(false)
      } else {
        // Mark as watched
        if (relayPool) {
          await createWebsiteReaction(videoUrl, activeAccount, relayPool)
        }
        setIsMarkedAsWatched(true)
      }
    } catch (error) {
      console.warn('Failed to update watched status:', error)
    } finally {
      setIsCheckingWatchedStatus(false)
      setTimeout(() => setShowCheckAnimation(false), 1000)
    }
  }

  const toggleVideoMenu = () => setShowVideoMenu(v => !v)

  const handleOpenVideoExternal = () => {
    window.open(videoUrl, '_blank', 'noopener,noreferrer')
    setShowVideoMenu(false)
  }

  const handleOpenVideoNative = () => {
    const native = buildNativeVideoUrl(videoUrl)
    if (native) {
      window.location.href = native
    } else {
      window.location.href = videoUrl
    }
    setShowVideoMenu(false)
  }

  const handleCopyVideoUrl = async () => {
    try {
      await navigator.clipboard.writeText(videoUrl)
    } catch (e) {
      console.warn('Clipboard copy failed', e)
    } finally {
      setShowVideoMenu(false)
    }
  }

  const handleShareVideoUrl = async () => {
    try {
      if ((navigator as { share?: (d: { title?: string; url?: string }) => Promise<void> }).share) {
        await (navigator as { share: (d: { title?: string; url?: string }) => Promise<void> }).share({ 
          title: ytMeta?.title || title || 'Video', 
          url: videoUrl 
        })
      } else {
        await navigator.clipboard.writeText(videoUrl)
      }
    } catch (e) {
      console.warn('Share failed', e)
    } finally {
      setShowVideoMenu(false)
    }
  }

  const displayTitle = ytMeta?.title || title
  // For direct video URLs from Nostr notes, prioritize note content over metadata
  const displaySummary = noteContent || ytMeta?.description || summary
  const durationText = videoDurationSec !== null ? formatDuration(videoDurationSec) : null
  
  // Get video thumbnail for cover image
  const youtubeThumbnail = getYouTubeThumbnail(videoUrl)
  const vimeoThumbnail = getVimeoThumbnail(videoUrl)
  const videoThumbnail = youtubeThumbnail || vimeoThumbnail
  const displayImage = videoThumbnail || image

  return (
    <>
      <ReaderHeader 
        title={displayTitle}
        image={displayImage}
        summary={displaySummary}
        published={published}
        readingTimeText={durationText}
        hasHighlights={false}
        highlightCount={0}
        settings={settings}
        highlights={[]}
        highlightVisibility={{ nostrverse: true, friends: true, mine: true }}
        onHighlightCountClick={onOpenHighlights}
      />
      
      <div className="reader-video">
        <ReactPlayer 
          url={videoUrl} 
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
      
      {displaySummary && (
        <div className="large-text" style={{ color: '#ddd', padding: '0 0.75rem', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>
          {displaySummary}
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
            className={`mark-as-read-btn ${isMarkedAsWatched ? 'marked' : ''} ${showCheckAnimation ? 'animating' : ''}`}
            onClick={handleMarkAsWatched}
            disabled={isCheckingWatchedStatus}
            title={isMarkedAsWatched ? 'Already Marked as Watched' : 'Mark as Watched'}
            style={isMarkedAsWatched ? { opacity: 0.85 } : undefined}
          >
            <FontAwesomeIcon 
              icon={faCheckCircle} 
              className={isMarkedAsWatched ? 'check-icon' : 'check-icon-empty'} 
            />
            <span>{isMarkedAsWatched ? 'Watched' : 'Mark as Watched'}</span>
          </button>
        </div>
      )}
    </>
  )
}

export default VideoView
