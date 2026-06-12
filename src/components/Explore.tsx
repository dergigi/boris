import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPersonHiking, faNewspaper, faHighlighter, faUser, faUserGroup, faNetworkWired, faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import IconButton from './IconButton'
import { BlogPostSkeleton, HighlightSkeleton } from './Skeletons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { nip19 } from 'nostr-tools'
import { useNavigate } from 'react-router-dom'
import { BlogPostPreview } from '../services/exploreService'
import { UserSettings } from '../services/settingsService'
import BlogPostCard from './BlogPostCard'
import { HighlightItem } from './HighlightItem'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'
import { classifyHighlights } from '../utils/highlightClassification'
import { dedupeWritingsByReplaceable } from '../utils/dedupe'
import { useExploreVisibility } from '../hooks/useExploreVisibility'
import { useExploreControllers } from '../hooks/useExploreControllers'
import { useExploreData } from '../hooks/useExploreData'

interface ExploreProps {
  relayPool: RelayPool
  eventStore: IEventStore
  settings?: UserSettings
  activeTab?: TabType
}

type TabType = 'writings' | 'highlights'

const Explore: React.FC<ExploreProps> = ({ relayPool, eventStore, settings, activeTab: propActiveTab }) => {
  const activeAccount = Hooks.useActiveAccount()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>(propActiveTab || 'highlights')
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Use custom hooks
  const { visibility, toggleScope } = useExploreVisibility(activeAccount, settings)
  
  const {
    blogPosts,
    setBlogPosts,
    highlights,
    setHighlights,
    followedPubkeys,
    readingProgressMap,
    hasHydratedRef
  } = useExploreControllers(relayPool, eventStore, activeAccount, refreshTrigger, setLoading)

  useExploreData(
    relayPool,
    eventStore,
    activeAccount,
    visibility,
    followedPubkeys,
    setBlogPosts,
    setHighlights,
    hasHydratedRef,
    setLoading,
    settings,
    refreshTrigger
  )

  // Update local state when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab)
    }
  }, [propActiveTab])

  // Pull-to-refresh
  const { isRefreshing, pullPosition } = usePullToRefresh({
    onRefresh: () => {
      setRefreshTrigger(prev => prev + 1)
      setLoading(true)
    },
    maximumPullLength: 240,
    refreshThreshold: 80,
    isDisabled: !activeAccount
  })

  const getPostUrl = (post: BlogPostPreview) => {
    // Get the d-tag identifier
    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
    
    // Create naddr
    const naddr = nip19.naddrEncode({
      kind: 30023,
      pubkey: post.author,
      identifier: dTag
    })
    
    return `/a/${naddr}`
  }


  // Classify highlights with levels based on user context and apply visibility filters
  const classifiedHighlights = useMemo(() => {
    const classified = classifyHighlights(highlights, activeAccount?.pubkey, followedPubkeys)
    return classified.filter(h => {
      if (h.level === 'mine' && !visibility.mine) return false
      if (h.level === 'friends' && !visibility.friends) return false
      if (h.level === 'nostrverse' && !visibility.nostrverse) return false
      return true
    })
  }, [highlights, activeAccount?.pubkey, followedPubkeys, visibility])

  // Dedupe and sort posts once for rendering
  const uniqueSortedPosts = useMemo(() => {
    const unique = dedupeWritingsByReplaceable(blogPosts)
    return unique.sort((a, b) => {
      const timeA = a.published || a.event.created_at
      const timeB = b.published || b.event.created_at
      return timeB - timeA
    })
  }, [blogPosts])

  // Filter blog posts by future dates and visibility, and add level classification
  const filteredBlogPosts = useMemo(() => {
    const maxFutureTime = Date.now() / 1000 + (24 * 60 * 60) // 1 day from now
    return uniqueSortedPosts
      .filter(post => {
        // Filter out future dates
        const publishedTime = post.published || post.event.created_at
        if (publishedTime > maxFutureTime) return false
        
        // Hide bot authors by profile display name if setting enabled
        if (settings?.hideBotArticlesByName !== false) {
          // Profile resolution and filtering is handled in BlogPostCard via ProfileModel
          // Keep list intact here; individual cards will render null if author is a bot
        }
        
        // Apply visibility filters
        const isMine = activeAccount && post.author === activeAccount.pubkey
        const isFriend = followedPubkeys.has(post.author)
        const isNostrverse = !isMine && !isFriend
        
        if (isMine && !visibility.mine) return false
        if (isFriend && !visibility.friends) return false
        if (isNostrverse && !visibility.nostrverse) return false
        
        return true
      })
      .map(post => {
        // Add level classification
        const isMine = activeAccount && post.author === activeAccount.pubkey
        const isFriend = followedPubkeys.has(post.author)
        const level: 'mine' | 'friends' | 'nostrverse' = isMine ? 'mine' : isFriend ? 'friends' : 'nostrverse'
        return { ...post, level }
      })
  }, [uniqueSortedPosts, activeAccount, followedPubkeys, visibility, settings?.hideBotArticlesByName])
  
  // Helper to get reading progress for a post
  const getReadingProgress = useCallback((post: BlogPostPreview): number | undefined => {
    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1]
    if (!dTag) {
      return undefined
    }
    
    try {
      const naddr = nip19.naddrEncode({
        kind: 30023,
        pubkey: post.author,
        identifier: dTag
      })
      const progress = readingProgressMap.get(naddr)
      
      return progress
    } catch (err) {
      console.error('[progress] ❌ Error encoding naddr:', err)
      return undefined
    }
  }, [readingProgressMap])

  const renderTabContent = () => {
    switch (activeTab) {
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
        return filteredBlogPosts.length === 0 ? (
          <div className="explore-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <BlogPostSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="explore-grid">
            {filteredBlogPosts.map((post) => (
              <BlogPostCard
                key={`${post.author}:${post.event.tags.find(t => t[0] === 'd')?.[1]}`}
                post={post}
                href={getPostUrl(post)}
                level={post.level}
                readingProgress={getReadingProgress(post)}
                hideBotByName={settings?.hideBotArticlesByName !== false}
              />
            ))}
          </div>
        )

      case 'highlights':
        if (showSkeletons) {
          return (
            <div className="explore-grid single-column">
              {Array.from({ length: 8 }).map((_, i) => (
                <HighlightSkeleton key={i} />
              ))}
            </div>
          )
        }
        return classifiedHighlights.length === 0 ? (
          <div className="explore-loading" style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <span>No highlights to show for the selected scope.</span>
          </div>
        ) : (
          <div className="explore-grid single-column">
            {classifiedHighlights.map((highlight) => (
              <HighlightItem
                key={highlight.id}
                highlight={highlight}
                relayPool={relayPool}
              />
            ))}
          </div>
        )

      default:
        return null
    }
  }

  // Show skeletons while first load in this session
  const hasData = highlights.length > 0 || blogPosts.length > 0
  const showSkeletons = loading && !hasData

  return (
    <div className="explore-container">
      <RefreshIndicator
        isRefreshing={isRefreshing}
        pullPosition={pullPosition}
      />
      <div className="explore-header">
        <h1>
          <FontAwesomeIcon icon={faPersonHiking} />
          Explore
        </h1>
        
        {/* Visibility filters */}
        <div className="highlight-level-toggles" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <IconButton
            icon={faArrowsRotate}
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            title="Refresh content"
            ariaLabel="Refresh content"
            variant="ghost"
            spin={loading || isRefreshing}
            disabled={loading || isRefreshing}
          />
          <IconButton
            icon={faNetworkWired}
            onClick={() => toggleScope('nostrverse')}
            title="Toggle nostrverse content"
            ariaLabel="Toggle nostrverse content"
            variant="ghost"
            style={{ 
              color: visibility.nostrverse ? 'var(--highlight-color-nostrverse, #9333ea)' : undefined,
              opacity: visibility.nostrverse ? 1 : 0.4 
            }}
          />
          <IconButton
            icon={faUserGroup}
            onClick={() => toggleScope('friends')}
            title={activeAccount ? "Toggle friends content" : "Login to see friends content"}
            ariaLabel="Toggle friends content"
            variant="ghost"
            disabled={!activeAccount}
            style={{ 
              color: visibility.friends ? 'var(--highlight-color-friends, #f97316)' : undefined,
              opacity: visibility.friends ? 1 : 0.4 
            }}
          />
          <IconButton
            icon={faUser}
            onClick={() => toggleScope('mine')}
            title={activeAccount ? "Toggle my content" : "Login to see your content"}
            ariaLabel="Toggle my content"
            variant="ghost"
            disabled={!activeAccount}
            style={{ 
              color: visibility.mine ? 'var(--highlight-color-mine, #eab308)' : undefined,
              opacity: visibility.mine ? 1 : 0.4 
            }}
          />
        </div>
        
        <div className="me-tabs">
          <button
            className={`me-tab ${activeTab === 'highlights' ? 'active' : ''}`}
            data-tab="highlights"
            onClick={() => navigate('/explore')}
          >
            <FontAwesomeIcon icon={faHighlighter} />
            <span className="tab-label">Highlights</span>
          </button>
          <button
            className={`me-tab ${activeTab === 'writings' ? 'active' : ''}`}
            data-tab="writings"
            onClick={() => navigate('/explore/writings')}
          >
            <FontAwesomeIcon icon={faNewspaper} />
            <span className="tab-label">Writings</span>
          </button>
        </div>
      </div>

      <div>
        {renderTabContent()}
      </div>
    </div>
  )
}

export default Explore

