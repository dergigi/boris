import React, { useState, useEffect, useRef, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationCircle, faNewspaper, faPenToSquare, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { useNavigate } from 'react-router-dom'
import { fetchContacts } from '../services/contactService'
import { fetchBlogPostsFromAuthors, BlogPostPreview } from '../services/exploreService'
import { fetchHighlightsFromAuthors } from '../services/highlightService'
import { Highlight } from '../types/highlights'
import BlogPostCard from './BlogPostCard'
import { HighlightItem } from './HighlightItem'
import { getCachedPosts, upsertCachedPost, setCachedPosts, getCachedHighlights, upsertCachedHighlight, setCachedHighlights } from '../services/exploreCache'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import PullToRefreshIndicator from './PullToRefreshIndicator'
import { classifyHighlights } from '../utils/highlightClassification'

interface ExploreProps {
  relayPool: RelayPool
  activeTab?: TabType
}

type TabType = 'writings' | 'highlights'

const Explore: React.FC<ExploreProps> = ({ relayPool, activeTab: propActiveTab }) => {
  const activeAccount = Hooks.useActiveAccount()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>(propActiveTab || 'highlights')
  const [blogPosts, setBlogPosts] = useState<BlogPostPreview[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [followedPubkeys, setFollowedPubkeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const exploreContainerRef = useRef<HTMLDivElement>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Update local state when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab)
    }
  }, [propActiveTab])

  useEffect(() => {
    const loadData = async () => {
      if (!activeAccount) {
        setError('Please log in to explore content from your friends')
        setLoading(false)
        return
      }

      try {
        // show spinner but keep existing data
        setLoading(true)
        setError(null)

        // Seed from in-memory cache if available to avoid empty flash
        const cachedPosts = getCachedPosts(activeAccount.pubkey)
        if (cachedPosts && cachedPosts.length > 0 && blogPosts.length === 0) {
          setBlogPosts(cachedPosts)
        }
        const cachedHighlights = getCachedHighlights(activeAccount.pubkey)
        if (cachedHighlights && cachedHighlights.length > 0 && highlights.length === 0) {
          setHighlights(cachedHighlights)
        }

        // Fetch the user's contacts (friends)
        const contacts = await fetchContacts(
          relayPool,
          activeAccount.pubkey,
          (partial) => {
            // Store followed pubkeys for highlight classification
            setFollowedPubkeys(partial)
            // When local contacts are available, kick off early fetch
            if (partial.size > 0) {
              const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
              const partialArray = Array.from(partial)
              
              // Fetch blog posts
              fetchBlogPostsFromAuthors(
                relayPool,
                partialArray,
                relayUrls,
                (post) => {
                  setBlogPosts((prev) => {
                    const exists = prev.some(p => p.event.id === post.event.id)
                    if (exists) return prev
                    const next = [...prev, post]
                    return next.sort((a, b) => {
                      const timeA = a.published || a.event.created_at
                      const timeB = b.published || b.event.created_at
                      return timeB - timeA
                    })
                  })
                  setCachedPosts(activeAccount.pubkey, upsertCachedPost(activeAccount.pubkey, post))
                }
              ).then((all) => {
                setBlogPosts((prev) => {
                  const byId = new Map(prev.map(p => [p.event.id, p]))
                  for (const post of all) byId.set(post.event.id, post)
                  const merged = Array.from(byId.values()).sort((a, b) => {
                    const timeA = a.published || a.event.created_at
                    const timeB = b.published || b.event.created_at
                    return timeB - timeA
                  })
                  setCachedPosts(activeAccount.pubkey, merged)
                  return merged
                })
              })
              
              // Fetch highlights
              fetchHighlightsFromAuthors(
                relayPool,
                partialArray,
                (highlight) => {
                  setHighlights((prev) => {
                    const exists = prev.some(h => h.id === highlight.id)
                    if (exists) return prev
                    const next = [...prev, highlight]
                    return next.sort((a, b) => b.created_at - a.created_at)
                  })
                  setCachedHighlights(activeAccount.pubkey, upsertCachedHighlight(activeAccount.pubkey, highlight))
                }
              ).then((all) => {
                setHighlights((prev) => {
                  const byId = new Map(prev.map(h => [h.id, h]))
                  for (const highlight of all) byId.set(highlight.id, highlight)
                  const merged = Array.from(byId.values()).sort((a, b) => b.created_at - a.created_at)
                  setCachedHighlights(activeAccount.pubkey, merged)
                  return merged
                })
              })
            }
          }
        )
        
        if (contacts.size === 0) {
          setError('You are not following anyone yet. Follow some people to see their content!')
          setLoading(false)
          return
        }

        // Store final followed pubkeys
        setFollowedPubkeys(contacts)

        // After full contacts, do a final pass for completeness
        const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
        const contactsArray = Array.from(contacts)
        const [posts, userHighlights] = await Promise.all([
          fetchBlogPostsFromAuthors(relayPool, contactsArray, relayUrls),
          fetchHighlightsFromAuthors(relayPool, contactsArray)
        ])

        if (posts.length === 0 && userHighlights.length === 0) {
          setError('No content found from your friends yet')
        }

        setBlogPosts((prev) => {
          const byId = new Map(prev.map(p => [p.event.id, p]))
          for (const post of posts) byId.set(post.event.id, post)
          const merged = Array.from(byId.values()).sort((a, b) => {
            const timeA = a.published || a.event.created_at
            const timeB = b.published || b.event.created_at
            return timeB - timeA
          })
          setCachedPosts(activeAccount.pubkey, merged)
          return merged
        })

        setHighlights((prev) => {
          const byId = new Map(prev.map(h => [h.id, h]))
          for (const highlight of userHighlights) byId.set(highlight.id, highlight)
          const merged = Array.from(byId.values()).sort((a, b) => b.created_at - a.created_at)
          setCachedHighlights(activeAccount.pubkey, merged)
          return merged
        })
      } catch (err) {
        console.error('Failed to load data:', err)
        setError('Failed to load content. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [relayPool, activeAccount, blogPosts.length, highlights.length, refreshTrigger])

  // Pull-to-refresh
  const pullToRefreshState = usePullToRefresh(exploreContainerRef, {
    onRefresh: () => {
      setRefreshTrigger(prev => prev + 1)
    },
    isRefreshing: loading
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

  const handleHighlightClick = (highlightId: string) => {
    const highlight = highlights.find(h => h.id === highlightId)
    if (!highlight) return

    // For nostr-native articles
    if (highlight.eventReference) {
      // Convert eventReference to naddr
      if (highlight.eventReference.includes(':')) {
        const parts = highlight.eventReference.split(':')
        const kind = parseInt(parts[0])
        const pubkey = parts[1]
        const identifier = parts[2] || ''
        
        const naddr = nip19.naddrEncode({
          kind,
          pubkey,
          identifier
        })
        navigate(`/a/${naddr}`, { state: { highlightId, openHighlights: true } })
      } else {
        // Already an naddr
        navigate(`/a/${highlight.eventReference}`, { state: { highlightId, openHighlights: true } })
      }
    } 
    // For web URLs
    else if (highlight.urlReference) {
      navigate(`/r/${encodeURIComponent(highlight.urlReference)}`, { state: { highlightId, openHighlights: true } })
    }
  }

  // Classify highlights with levels based on user context
  const classifiedHighlights = useMemo(() => {
    return classifyHighlights(highlights, activeAccount?.pubkey, followedPubkeys)
  }, [highlights, activeAccount?.pubkey, followedPubkeys])

  const renderTabContent = () => {
    switch (activeTab) {
      case 'writings':
        return blogPosts.length === 0 ? (
          <div className="explore-empty" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No blog posts found yet.</p>
          </div>
        ) : (
          <div className="explore-grid">
            {blogPosts.map((post) => (
              <BlogPostCard
                key={`${post.author}:${post.event.tags.find(t => t[0] === 'd')?.[1]}`}
                post={post}
                href={getPostUrl(post)}
              />
            ))}
          </div>
        )

      case 'highlights':
        return classifiedHighlights.length === 0 ? (
          <div className="explore-empty" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No highlights yet. Your friends should start highlighting content!</p>
          </div>
        ) : (
          <div className="explore-grid">
            {classifiedHighlights.map((highlight) => (
              <HighlightItem
                key={highlight.id}
                highlight={highlight}
                relayPool={relayPool}
                onHighlightClick={handleHighlightClick}
              />
            ))}
          </div>
        )

      default:
        return null
    }
  }

  // Only show full loading screen if we don't have any data yet
  const hasData = highlights.length > 0 || blogPosts.length > 0

  if (loading && !hasData) {
    return (
      <div className="explore-container">
        <div className="explore-loading">
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="explore-container">
        <div className="explore-error">
          <FontAwesomeIcon icon={faExclamationCircle} size="2x" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={exploreContainerRef}
      className={`explore-container pull-to-refresh-container ${pullToRefreshState.isPulling ? 'is-pulling' : ''}`}
    >
      <PullToRefreshIndicator
        isPulling={pullToRefreshState.isPulling}
        pullDistance={pullToRefreshState.pullDistance}
        canRefresh={pullToRefreshState.canRefresh}
        isRefreshing={loading && pullToRefreshState.canRefresh}
      />
      <div className="explore-header">
        <h1>
          <FontAwesomeIcon icon={faNewspaper} />
          Explore
        </h1>
        <p className="explore-subtitle">
          Discover highlights and blog posts from your friends and others
        </p>
        
        {loading && hasData && (
          <div className="explore-loading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
            <FontAwesomeIcon icon={faSpinner} spin />
          </div>
        )}
        
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
            <FontAwesomeIcon icon={faPenToSquare} />
            <span className="tab-label">Writings</span>
          </button>
        </div>
      </div>

      {renderTabContent()}
    </div>
  )
}

export default Explore

