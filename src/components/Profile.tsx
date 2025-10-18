import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faPenToSquare } from '@fortawesome/free-solid-svg-icons'
import { IEventStore } from 'applesauce-core'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { useNavigate } from 'react-router-dom'
import { HighlightItem } from './HighlightItem'
import { BlogPostPreview, fetchBlogPostsFromAuthors } from '../services/exploreService'
import { fetchHighlights } from '../services/highlightService'
import { RELAYS } from '../config/relays'
import { KINDS } from '../config/kinds'
import AuthorCard from './AuthorCard'
import BlogPostCard from './BlogPostCard'
import { BlogPostSkeleton, HighlightSkeleton } from './Skeletons'
import { useStoreTimeline } from '../hooks/useStoreTimeline'
import { eventToHighlight } from '../services/highlightEventProcessor'
import { toBlogPostPreview } from '../utils/toBlogPostPreview'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'

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
  const [activeTab, setActiveTab] = useState<'highlights' | 'writings'>(propActiveTab || 'highlights')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
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

  // Update local state when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab)
    }
  }, [propActiveTab])

  // Background fetch to populate event store (non-blocking)
  useEffect(() => {
    if (!pubkey || !relayPool || !eventStore) return
    
    console.log('🔄 [Profile] Background fetching highlights and writings for', pubkey.slice(0, 8))
    
    // Fetch highlights in background
    fetchHighlights(relayPool, pubkey, undefined, undefined, false, eventStore)
      .then(highlights => {
        console.log('✅ [Profile] Fetched', highlights.length, 'highlights')
      })
      .catch(err => {
        console.warn('⚠️ [Profile] Failed to fetch highlights:', err)
      })
    
    // Fetch writings in background
    fetchBlogPostsFromAuthors(relayPool, [pubkey], RELAYS)
      .then(writings => {
        writings.forEach(w => eventStore.add(w.event))
        console.log('✅ [Profile] Fetched', writings.length, 'writings')
      })
      .catch(err => {
        console.warn('⚠️ [Profile] Failed to fetch writings:', err)
      })
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

  const handleHighlightDelete = () => {
    // Not allowed to delete other users' highlights
    return
  }

  const npub = nip19.npubEncode(pubkey)
  const showSkeletons = cachedHighlights.length === 0 && cachedWritings.length === 0

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
        return cachedWritings.length === 0 ? (
          <div className="explore-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            No articles written yet.
          </div>
        ) : (
          <div className="explore-grid">
            {cachedWritings.map((post) => (
              <BlogPostCard
                key={post.event.id}
                post={post}
                href={getPostUrl(post)}
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
        <AuthorCard authorPubkey={pubkey} clickable={false} />
        
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

