import React, { useState, useEffect, useRef, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationCircle, faNewspaper, faPenToSquare, faHighlighter, faUser, faUserGroup, faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import IconButton from './IconButton'
import { BlogPostSkeleton, HighlightSkeleton } from './Skeletons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { nip19 } from 'nostr-tools'
import { useNavigate } from 'react-router-dom'
import { fetchContacts } from '../services/contactService'
import { fetchBlogPostsFromAuthors, BlogPostPreview } from '../services/exploreService'
import { fetchHighlightsFromAuthors } from '../services/highlightService'
import { fetchProfiles } from '../services/profileService'
import { fetchNostrverseBlogPosts, fetchNostrverseHighlights } from '../services/nostrverseService'
import { Highlight } from '../types/highlights'
import { UserSettings } from '../services/settingsService'
import BlogPostCard from './BlogPostCard'
import { HighlightItem } from './HighlightItem'
import { getCachedPosts, upsertCachedPost, setCachedPosts, getCachedHighlights, upsertCachedHighlight, setCachedHighlights } from '../services/exploreCache'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'
import { classifyHighlights } from '../utils/highlightClassification'
import { HighlightVisibility } from './HighlightsPanel'

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
  const [blogPosts, setBlogPosts] = useState<BlogPostPreview[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [followedPubkeys, setFollowedPubkeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  // Visibility filters (defaults from settings)
  const [visibility, setVisibility] = useState<HighlightVisibility>({
    nostrverse: settings?.defaultHighlightVisibilityNostrverse !== false,
    friends: settings?.defaultHighlightVisibilityFriends !== false,
    mine: settings?.defaultHighlightVisibilityMine !== false
  })

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
          // If we already have any cached or previously shown data, do not block the UI.
          const hasAnyData = (blogPosts.length > 0) || (highlights.length > 0)
          if (!hasAnyData) {
            // No friends and no cached content: set a soft hint, but still proceed to load nostrverse.
            setError(null)
          }
          // Continue without returning: still fetch nostrverse content below.
        }

        // Store final followed pubkeys
        setFollowedPubkeys(contacts)

        // Fetch both friends content and nostrverse content in parallel
        const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
        const contactsArray = Array.from(contacts)
        const [friendsPosts, friendsHighlights, nostrversePosts, nostriverseHighlights] = await Promise.all([
          fetchBlogPostsFromAuthors(relayPool, contactsArray, relayUrls),
          fetchHighlightsFromAuthors(relayPool, contactsArray),
          fetchNostrverseBlogPosts(relayPool, relayUrls, 50),
          fetchNostrverseHighlights(relayPool, 100)
        ])

        // Merge and deduplicate all posts
        const allPosts = [...friendsPosts, ...nostrversePosts]
        const postsByKey = new Map<string, BlogPostPreview>()
        for (const post of allPosts) {
          const key = `${post.author}:${post.event.tags.find(t => t[0] === 'd')?.[1] || ''}`
          const existing = postsByKey.get(key)
          if (!existing || post.event.created_at > existing.event.created_at) {
            postsByKey.set(key, post)
          }
        }
        const uniquePosts = Array.from(postsByKey.values()).sort((a, b) => {
          const timeA = a.published || a.event.created_at
          const timeB = b.published || b.event.created_at
          return timeB - timeA
        })

        // Merge and deduplicate all highlights
        const allHighlights = [...friendsHighlights, ...nostriverseHighlights]
        const highlightsByKey = new Map<string, Highlight>()
        for (const highlight of allHighlights) {
          highlightsByKey.set(highlight.id, highlight)
        }
        const uniqueHighlights = Array.from(highlightsByKey.values()).sort((a, b) => b.created_at - a.created_at)

        // Fetch profiles for all blog post authors to cache them
        if (uniquePosts.length > 0) {
          const authorPubkeys = Array.from(new Set(uniquePosts.map(p => p.author)))
          fetchProfiles(relayPool, eventStore, authorPubkeys, settings).catch(err => {
            console.error('Failed to fetch author profiles:', err)
          })
        }

        if (contacts.size === 0 && uniquePosts.length === 0 && uniqueHighlights.length === 0) {
          setError('You are not following anyone yet. Follow some people to see their content!')
        } else if (uniquePosts.length === 0 && uniqueHighlights.length === 0) {
          setError('No content found yet')
        }

        setBlogPosts(uniquePosts)
        setCachedPosts(activeAccount.pubkey, uniquePosts)

        setHighlights(uniqueHighlights)
        setCachedHighlights(activeAccount.pubkey, uniqueHighlights)
      } catch (err) {
        console.error('Failed to load data:', err)
        setError('Failed to load content. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [relayPool, activeAccount, refreshTrigger, eventStore, settings])

  // Pull-to-refresh
  const { isRefreshing, pullPosition } = usePullToRefresh({
    onRefresh: () => {
      setRefreshTrigger(prev => prev + 1)
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

  // Filter blog posts by future dates and visibility
  const filteredBlogPosts = useMemo(() => {
    const maxFutureTime = Date.now() / 1000 + (24 * 60 * 60) // 1 day from now
    return blogPosts.filter(post => {
      // Filter out future dates
      const publishedTime = post.published || post.event.created_at
      if (publishedTime > maxFutureTime) return false
      
      // Apply visibility filters
      const isMine = activeAccount && post.author === activeAccount.pubkey
      const isFriend = followedPubkeys.has(post.author)
      const isNostrverse = !isMine && !isFriend
      
      if (isMine && !visibility.mine) return false
      if (isFriend && !visibility.friends) return false
      if (isNostrverse && !visibility.nostrverse) return false
      
      return true
    })
  }, [blogPosts, activeAccount, followedPubkeys, visibility])

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
          <div className="explore-empty" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            <p>No blog posts yet. Pull to refresh!</p>
          </div>
        ) : (
          <div className="explore-grid">
            {filteredBlogPosts.map((post) => (
              <BlogPostCard
                key={`${post.author}:${post.event.tags.find(t => t[0] === 'd')?.[1]}`}
                post={post}
                href={getPostUrl(post)}
              />
            ))}
          </div>
        )

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
        return classifiedHighlights.length === 0 ? (
          <div className="explore-empty" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            <p>No highlights yet. Pull to refresh!</p>
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

  // Show content progressively - no blocking error screens
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
          <FontAwesomeIcon icon={faNewspaper} />
          Explore
        </h1>
        <p className="explore-subtitle">
          Discover highlights and blog posts from your friends and others
        </p>
        
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
        
        {/* Visibility filters */}
        <div className="highlight-level-toggles" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <IconButton
            icon={faNetworkWired}
            onClick={() => setVisibility({ ...visibility, nostrverse: !visibility.nostrverse })}
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
            onClick={() => setVisibility({ ...visibility, friends: !visibility.friends })}
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
            onClick={() => setVisibility({ ...visibility, mine: !visibility.mine })}
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
      </div>

      {renderTabContent()}
    </div>
  )
}

export default Explore

