import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faPenToSquare, faEllipsisH, faCopy, faShare, faExternalLinkAlt, faMobileAlt } from '@fortawesome/free-solid-svg-icons'
import { IEventStore } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { useNavigate } from 'react-router-dom'
import { HighlightItem } from './HighlightItem'
import { BlogPostPreview } from '../services/exploreService'
import { KINDS } from '../config/kinds'
import AuthorCard from './AuthorCard'
import BlogPostCard from './BlogPostCard'
import { BlogPostSkeleton, HighlightSkeleton } from './Skeletons'
import { useStoreTimeline } from '../hooks/useStoreTimeline'
import { eventToHighlight } from '../services/highlightEventProcessor'
import { toBlogPostPreview } from '../utils/toBlogPostPreview'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'
import { Hooks } from 'applesauce-react'
import { readingProgressController } from '../services/readingProgressController'
import { writingsController } from '../services/writingsController'
import { highlightsController } from '../services/highlightsController'
import { getProfileUrl, getNostrUrl } from '../config/nostrGateways'

interface ProfileProps {
  relayPool: RelayPool
  eventStore: IEventStore
  pubkey: string
  activeTab?: 'highlights' | 'writings'
}

const Profile: React.FC<ProfileProps> = ({ 
  relayPool, 
  eventStore,
  pubkey,
  activeTab: propActiveTab
}) => {
  const navigate = useNavigate()
  const activeAccount = Hooks.useActiveAccount()
  const [activeTab, setActiveTab] = useState<'highlights' | 'writings'>(propActiveTab || 'highlights')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  
  // Reading progress state (naddr -> progress 0-1)
  const [readingProgressMap, setReadingProgressMap] = useState<Map<string, number>>(new Map())
  
  // Load cached data from event store instantly
  const cachedHighlights = useStoreTimeline(
    eventStore,
    { kinds: [KINDS.Highlights], authors: [pubkey] },
    eventToHighlight,
    [pubkey]
  )
  
  const cachedWritings = useStoreTimeline(
    eventStore,
    { kinds: [30023], authors: [pubkey] },
    toBlogPostPreview,
    [pubkey]
  )

  // Sort writings by publication date, newest first
  const sortedWritings = useMemo(() => {
    return cachedWritings.slice().sort((a, b) => {
      const timeA = a.published || a.event.created_at
      const timeB = b.published || b.event.created_at
      return timeB - timeA
    })
  }, [cachedWritings])

  // Update local state when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab)
    }
  }, [propActiveTab])
  
  // Subscribe to reading progress controller
  useEffect(() => {
    // Get initial state immediately
    const initialMap = readingProgressController.getProgressMap()
    setReadingProgressMap(initialMap)
    
    // Subscribe to updates
    const unsubProgress = readingProgressController.onProgress((newMap) => {
      setReadingProgressMap(newMap)
    })
    
    return () => {
      unsubProgress()
    }
  }, [])
  
  // Load reading progress data when logged in
  useEffect(() => {
    if (!activeAccount?.pubkey) {
      return
    }
    
    readingProgressController.start({
      relayPool,
      eventStore,
      pubkey: activeAccount.pubkey,
      force: refreshTrigger > 0
    })
  }, [activeAccount?.pubkey, relayPool, eventStore, refreshTrigger])

  // Background fetch via controllers to populate event store
  useEffect(() => {
    if (!pubkey || !relayPool || !eventStore) return
    
    // Start controllers to fetch and populate event store
    // Controllers handle streaming, deduplication, and storage
    highlightsController.start({ relayPool, eventStore, pubkey })
      .catch(err => console.warn('⚠️ [Profile] Failed to fetch highlights:', err))
    
    writingsController.start({ relayPool, eventStore, pubkey, force: refreshTrigger > 0 })
      .catch(err => console.warn('⚠️ [Profile] Failed to fetch writings:', err))
  }, [pubkey, relayPool, eventStore, refreshTrigger])

  // Pull-to-refresh
  const { isRefreshing, pullPosition } = usePullToRefresh({
    onRefresh: () => {
      setRefreshTrigger(prev => prev + 1)
    },
    maximumPullLength: 240,
    refreshThreshold: 80,
    isDisabled: !pubkey
  })

  const getPostUrl = (post: BlogPostPreview) => {
    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
    const naddr = nip19.naddrEncode({
      kind: 30023,
      pubkey: post.author,
      identifier: dTag
    })
    return `/a/${naddr}`
  }
  
  // Helper to get reading progress for a post
  const getReadingProgress = useCallback((post: BlogPostPreview): number | undefined => {
    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1]
    if (!dTag) return undefined
    
    try {
      const naddr = nip19.naddrEncode({
        kind: 30023,
        pubkey: post.author,
        identifier: dTag
      })
      const progress = readingProgressMap.get(naddr)
      
      // Only log when found or map is empty
      if (progress || readingProgressMap.size === 0) {
        // Progress found or map is empty
      }
      
      return progress
    } catch (err) {
      return undefined
    }
  }, [readingProgressMap])

  const handleHighlightDelete = () => {
    // Not allowed to delete other users' highlights
    return
  }

  const npub = nip19.npubEncode(pubkey)
  const showSkeletons = cachedHighlights.length === 0 && sortedWritings.length === 0

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  // Profile menu handlers
  const handleMenuToggle = () => {
    setShowProfileMenu(!showProfileMenu)
  }

  const handleCopyProfileLink = async () => {
    try {
      const borisUrl = `${window.location.origin}/p/${npub}`
      await navigator.clipboard.writeText(borisUrl)
      setShowProfileMenu(false)
    } catch (e) {
      console.warn('Copy failed', e)
    }
  }

  const handleShareProfile = async () => {
    try {
      const borisUrl = `${window.location.origin}/p/${npub}`
      if ((navigator as { share?: (d: { title?: string; url?: string }) => Promise<void> }).share) {
        await (navigator as { share: (d: { title?: string; url?: string }) => Promise<void> }).share({ 
          title: 'Profile', 
          url: borisUrl 
        })
      } else {
        await navigator.clipboard.writeText(borisUrl)
      }
    } catch (e) {
      console.warn('Share failed', e)
    } finally {
      setShowProfileMenu(false)
    }
  }

  const handleOpenPortal = () => {
    const portalUrl = getProfileUrl(npub)
    window.open(portalUrl, '_blank', 'noopener,noreferrer')
    setShowProfileMenu(false)
  }

  const handleOpenNative = () => {
    const nativeUrl = `nostr:${npub}`
    window.location.href = nativeUrl
    setShowProfileMenu(false)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'highlights':
        if (showSkeletons) {
          return (
            <div className="explore-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <HighlightSkeleton key={i} />
              ))}
            </div>
          )
        }
        return cachedHighlights.length === 0 ? (
          <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            No highlights yet.
          </div>
        ) : (
          <div className="highlights-list me-highlights-list">
            {cachedHighlights.map((highlight) => (
              <HighlightItem
                key={highlight.id}
                highlight={{ ...highlight, level: 'mine' }}
                relayPool={relayPool}
                onHighlightDelete={handleHighlightDelete}
              />
            ))}
          </div>
        )

      case 'writings':
        if (showSkeletons) {
          return (
            <div className="explore-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <BlogPostSkeleton key={i} />
              ))}
            </div>
          )
        }
        return sortedWritings.length === 0 ? (
          <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            No articles written yet.
          </div>
        ) : (
          <div className="explore-grid">
            {sortedWritings.map((post) => (
              <BlogPostCard
                key={post.event.id}
                post={post}
                href={getPostUrl(post)}
                readingProgress={getReadingProgress(post)}
              />
            ))}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="explore-container">
      <RefreshIndicator
        isRefreshing={isRefreshing}
        pullPosition={pullPosition}
      />
      <div className="explore-header">
        <div className="profile-header-wrapper">
          <AuthorCard authorPubkey={pubkey} clickable={false} />
          <div className="profile-menu-wrapper" ref={profileMenuRef}>
            <button
              className="profile-menu-btn"
              onClick={handleMenuToggle}
              title="More options"
              aria-label="Profile menu"
            >
              <FontAwesomeIcon icon={faEllipsisH} />
            </button>
            {showProfileMenu && (
              <div className="profile-menu">
                <button
                  className="profile-menu-item"
                  onClick={handleCopyProfileLink}
                >
                  <FontAwesomeIcon icon={faCopy} />
                  <span>Copy Link</span>
                </button>
                <button
                  className="profile-menu-item"
                  onClick={handleShareProfile}
                >
                  <FontAwesomeIcon icon={faShare} />
                  <span>Share</span>
                </button>
                <button
                  className="profile-menu-item"
                  onClick={handleOpenPortal}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  <span>Open with njump</span>
                </button>
                <button
                  className="profile-menu-item"
                  onClick={handleOpenNative}
                >
                  <FontAwesomeIcon icon={faMobileAlt} />
                  <span>Open with Native App</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="me-tabs">
          <button
            className={`me-tab ${activeTab === 'highlights' ? 'active' : ''}`}
            data-tab="highlights"
            onClick={() => navigate(`/p/${npub}`)}
          >
            <FontAwesomeIcon icon={faHighlighter} />
            <span className="tab-label">Highlights</span>
          </button>
          <button
            className={`me-tab ${activeTab === 'writings' ? 'active' : ''}`}
            data-tab="writings"
            onClick={() => navigate(`/p/${npub}/writings`)}
          >
            <FontAwesomeIcon icon={faPenToSquare} />
            <span className="tab-label">Writings</span>
          </button>
        </div>
      </div>

      <div className="me-tab-content">
        {renderTabContent()}
      </div>
    </div>
  )
}

export default Profile

