import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faNewspaper, faHighlighter, faUser, faUserGroup, faNetworkWired, faArrowsRotate, faSpinner } from '@fortawesome/free-solid-svg-icons'
import IconButton from './IconButton'
import { BlogPostSkeleton, HighlightSkeleton } from './Skeletons'
import { Hooks } from 'applesauce-react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore, Helpers } from 'applesauce-core'
import { nip19, NostrEvent } from 'nostr-tools'
import { useNavigate } from 'react-router-dom'
import { fetchContacts } from '../services/contactService'
import { fetchBlogPostsFromAuthors, BlogPostPreview } from '../services/exploreService'
import { fetchHighlightsFromAuthors } from '../services/highlightService'
import { fetchProfiles } from '../services/profileService'
import { fetchNostrverseBlogPosts, fetchNostrverseHighlights } from '../services/nostrverseService'
import { highlightsController } from '../services/highlightsController'
import { Highlight } from '../types/highlights'
import { UserSettings } from '../services/settingsService'
import BlogPostCard from './BlogPostCard'
import { HighlightItem } from './HighlightItem'
import { getCachedPosts, upsertCachedPost, setCachedPosts, getCachedHighlights, upsertCachedHighlight, setCachedHighlights } from '../services/exploreCache'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'
import { classifyHighlights } from '../utils/highlightClassification'
import { HighlightVisibility } from './HighlightsPanel'
import { KINDS } from '../config/kinds'
import { eventToHighlight } from '../services/highlightEventProcessor'
import { useStoreTimeline } from '../hooks/useStoreTimeline'
import { dedupeHighlightsById, dedupeWritingsByReplaceable } from '../utils/dedupe'

const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

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
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [hasLoadedNostrverse, setHasLoadedNostrverse] = useState(false)
  
  // Get myHighlights directly from controller
  const [myHighlights, setMyHighlights] = useState<Highlight[]>([])
  const [myHighlightsLoading, setMyHighlightsLoading] = useState(false)
  
  // Load cached content from event store (instant display)
  const cachedHighlights = useStoreTimeline(eventStore, { kinds: [KINDS.Highlights] }, eventToHighlight, [])
  
  const toBlogPostPreview = useCallback((event: NostrEvent): BlogPostPreview => ({
    event,
    title: getArticleTitle(event) || 'Untitled',
    summary: getArticleSummary(event),
    image: getArticleImage(event),
    published: getArticlePublished(event),
    author: event.pubkey
  }), [])
  
  const cachedWritings = useStoreTimeline(eventStore, { kinds: [30023] }, toBlogPostPreview, [])
  
  // Visibility filters (defaults from settings or nostrverse when logged out)
  const [visibility, setVisibility] = useState<HighlightVisibility>({
    nostrverse: activeAccount ? (settings?.defaultExploreScopeNostrverse ?? false) : true,
    friends: settings?.defaultExploreScopeFriends ?? true,
    mine: settings?.defaultExploreScopeMine ?? false
  })

  // Subscribe to highlights controller
  useEffect(() => {
    const unsubHighlights = highlightsController.onHighlights(setMyHighlights)
    const unsubLoading = highlightsController.onLoading(setMyHighlightsLoading)
    return () => {
      unsubHighlights()
      unsubLoading()
    }
  }, [])

  // Update visibility when login state changes
  useEffect(() => {
    if (!activeAccount) {
      // When logged out, show nostrverse by default
      setVisibility(prev => ({ ...prev, nostrverse: true, friends: false, mine: false }))
      setHasLoadedNostrverse(true) // logged out path loads nostrverse immediately
    } else {
      // When logged in, use settings defaults
      setVisibility({
        nostrverse: settings?.defaultExploreScopeNostrverse ?? false,
        friends: settings?.defaultExploreScopeFriends ?? true,
        mine: settings?.defaultExploreScopeMine ?? false
      })
      setHasLoadedNostrverse(false)
    }
  }, [activeAccount, settings])

  // Update local state when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab)
    }
  }, [propActiveTab])

  useEffect(() => {
    const loadData = async () => {
      try {
        // show spinner but keep existing data
        setLoading(true)

        // If not logged in, only fetch nostrverse content with streaming posts
        if (!activeAccount) {
          const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
          const highlightPromise = fetchNostrverseHighlights(relayPool, 100, eventStore || undefined)

          // Stream posts as they arrive
          const postsPromise = fetchNostrverseBlogPosts(
            relayPool,
            relayUrls,
            50,
            eventStore || undefined,
            (post) => {
              setBlogPosts(prev => {
                const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
                const key = `${post.author}:${dTag}`
                const existingIndex = prev.findIndex(p => {
                  const pDTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
                  return `${p.author}:${pDTag}` === key
                })
                if (existingIndex >= 0) {
                  const existing = prev[existingIndex]
                  if (post.event.created_at <= existing.event.created_at) return prev
                  const next = [...prev]
                  next[existingIndex] = post
                  return next.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
                }
                const next = [...prev, post]
                return next.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
              })
            }
          )

          const [finalPosts, nostriverseHighlights] = await Promise.all([postsPromise, highlightPromise])
          // Ensure final sorted list set (in case stream missed an update)
          setBlogPosts(prev => {
            const byKey = new Map<string, BlogPostPreview>()
            for (const p of [...prev, ...finalPosts]) {
              const dTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
              const key = `${p.author}:${dTag}`
              const existing = byKey.get(key)
              if (!existing || p.event.created_at > existing.event.created_at) byKey.set(key, p)
            }
            return Array.from(byKey.values()).sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
          })
          setHighlights(nostriverseHighlights)
          setLoading(false)
          return
        }

        // Seed from in-memory cache if available to avoid empty flash
        const memoryCachedPosts = getCachedPosts(activeAccount.pubkey)
        if (memoryCachedPosts && memoryCachedPosts.length > 0) {
          setBlogPosts(prev => prev.length === 0 ? memoryCachedPosts : prev)
        }
        const memoryCachedHighlights = getCachedHighlights(activeAccount.pubkey)
        if (memoryCachedHighlights && memoryCachedHighlights.length > 0) {
          setHighlights(prev => prev.length === 0 ? memoryCachedHighlights : prev)
        }
        
        // Seed with cached content from event store (instant display)
        if (cachedHighlights.length > 0 || myHighlights.length > 0) {
          const merged = dedupeHighlightsById([...cachedHighlights, ...myHighlights])
          setHighlights(prev => {
            const all = dedupeHighlightsById([...prev, ...merged])
            return all.sort((a, b) => b.created_at - a.created_at)
          })
        }
        
        // Seed with cached writings from event store
        if (cachedWritings.length > 0) {
          setBlogPosts(prev => {
            const all = dedupeWritingsByReplaceable([...prev, ...cachedWritings])
            return all.sort((a, b) => {
              const timeA = a.published || a.event.created_at
              const timeB = b.published || b.event.created_at
              return timeB - timeA
            })
          })
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
                    // Deduplicate by author:d-tag (replaceable event key)
                    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
                    const key = `${post.author}:${dTag}`
                    const existingIndex = prev.findIndex(p => {
                      const pDTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
                      return `${p.author}:${pDTag}` === key
                    })
                    
                    // If exists, only replace if this one is newer
                    if (existingIndex >= 0) {
                      const existing = prev[existingIndex]
                      if (post.event.created_at <= existing.event.created_at) {
                        return prev // Keep existing (newer or same)
                      }
                      // Replace with newer version
                      const next = [...prev]
                      next[existingIndex] = post
                      return next.sort((a, b) => {
                        const timeA = a.published || a.event.created_at
                        const timeB = b.published || b.event.created_at
                        return timeB - timeA
                      })
                    }
                    
                    // New post, add it
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
                  // Deduplicate by author:d-tag (replaceable event key)
                  const byKey = new Map<string, BlogPostPreview>()
                  
                  // Add existing posts
                  for (const p of prev) {
                    const dTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
                    const key = `${p.author}:${dTag}`
                    byKey.set(key, p)
                  }
                  
                  // Merge in new posts (keeping newer versions)
                  for (const post of all) {
                    const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
                    const key = `${post.author}:${dTag}`
                    const existing = byKey.get(key)
                    if (!existing || post.event.created_at > existing.event.created_at) {
                      byKey.set(key, post)
                    }
                  }
                  
                  const merged = Array.from(byKey.values()).sort((a, b) => {
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
        
        // Always proceed to load nostrverse content even if no contacts
        // (removed blocking error for empty contacts)

        // Store final followed pubkeys
        setFollowedPubkeys(contacts)

        // Fetch friends content and (optionally) nostrverse content in parallel
        const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
        const contactsArray = Array.from(contacts)
        const nostrversePostsPromise = visibility.nostrverse
          ? fetchNostrverseBlogPosts(relayPool, relayUrls, 50, eventStore || undefined, (post) => {
              // Stream nostrverse posts too when logged in
              setBlogPosts(prev => {
                const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
                const key = `${post.author}:${dTag}`
                const existingIndex = prev.findIndex(p => {
                  const pDTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
                  return `${p.author}:${pDTag}` === key
                })
                if (existingIndex >= 0) {
                  const existing = prev[existingIndex]
                  if (post.event.created_at <= existing.event.created_at) return prev
                  const next = [...prev]
                  next[existingIndex] = post
                  return next.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
                }
                const next = [...prev, post]
                return next.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
              })
            })
          : Promise.resolve([] as BlogPostPreview[])

        const [friendsPosts, friendsHighlights, nostrversePosts, nostriverseHighlights] = await Promise.all([
          fetchBlogPostsFromAuthors(relayPool, contactsArray, relayUrls),
          fetchHighlightsFromAuthors(relayPool, contactsArray),
          nostrversePostsPromise,
          fetchNostrverseHighlights(relayPool, 100, eventStore || undefined)
        ])

        // Merge and deduplicate all posts
        const allPosts = [...friendsPosts, ...nostrversePosts]
        const uniquePosts = dedupeWritingsByReplaceable(allPosts).sort((a, b) => {
          const timeA = a.published || a.event.created_at
          const timeB = b.published || b.event.created_at
          return timeB - timeA
        })

        // Merge and deduplicate all highlights (mine from controller + friends + nostrverse)
        const allHighlights = [...myHighlights, ...friendsHighlights, ...nostriverseHighlights]
        const uniqueHighlights = dedupeHighlightsById(allHighlights).sort((a, b) => b.created_at - a.created_at)

        // Fetch profiles for all blog post authors to cache them
        if (uniquePosts.length > 0) {
          const authorPubkeys = Array.from(new Set(uniquePosts.map(p => p.author)))
          fetchProfiles(relayPool, eventStore, authorPubkeys, settings).catch(err => {
            console.error('Failed to fetch author profiles:', err)
          })
        }

        // No blocking errors - let empty states handle messaging
        setBlogPosts(uniquePosts)
        setCachedPosts(activeAccount.pubkey, uniquePosts)

        setHighlights(uniqueHighlights)
        setCachedHighlights(activeAccount.pubkey, uniqueHighlights)
      } catch (err) {
        console.error('Failed to load data:', err)
        // No blocking error - user can pull-to-refresh
      } finally {
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayPool, activeAccount, refreshTrigger, eventStore, settings])

  // Lazy-load nostrverse writings when user toggles it on (logged in)
  useEffect(() => {
    if (!activeAccount || !relayPool || !visibility.nostrverse || hasLoadedNostrverse) return
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    setHasLoadedNostrverse(true)
    fetchNostrverseBlogPosts(
      relayPool,
      relayUrls,
      50,
      eventStore || undefined,
      (post) => {
        setBlogPosts(prev => {
          const dTag = post.event.tags.find(t => t[0] === 'd')?.[1] || ''
          const key = `${post.author}:${dTag}`
          const existingIndex = prev.findIndex(p => {
            const pDTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
            return `${p.author}:${pDTag}` === key
          })
          if (existingIndex >= 0) {
            const existing = prev[existingIndex]
            if (post.event.created_at <= existing.event.created_at) return prev
            const next = [...prev]
            next[existingIndex] = post
            return next.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
          }
          const next = [...prev, post]
          return next.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
        })
      }
    ).then((finalPosts) => {
      // Ensure final deduped list
      setBlogPosts(prev => {
        const byKey = new Map<string, BlogPostPreview>()
        for (const p of [...prev, ...finalPosts]) {
          const dTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
          const key = `${p.author}:${dTag}`
          const existing = byKey.get(key)
          if (!existing || p.event.created_at > existing.event.created_at) byKey.set(key, p)
        }
        return Array.from(byKey.values()).sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
      })
    }).catch(() => {})
  }, [visibility.nostrverse, activeAccount, relayPool, eventStore, hasLoadedNostrverse])

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

  // Filter blog posts by future dates and visibility, and add level classification
  const filteredBlogPosts = useMemo(() => {
    const maxFutureTime = Date.now() / 1000 + (24 * 60 * 60) // 1 day from now
    return blogPosts
      .filter(post => {
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
      .map(post => {
        // Add level classification
        const isMine = activeAccount && post.author === activeAccount.pubkey
        const isFriend = followedPubkeys.has(post.author)
        const level: 'mine' | 'friends' | 'nostrverse' = isMine ? 'mine' : isFriend ? 'friends' : 'nostrverse'
        return { ...post, level }
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
          <div className="explore-loading" style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          </div>
        ) : (
          <div className="explore-grid">
            {filteredBlogPosts.map((post) => (
              <BlogPostCard
                key={`${post.author}:${post.event.tags.find(t => t[0] === 'd')?.[1]}`}
                post={post}
                href={getPostUrl(post)}
                level={post.level}
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
          <div className="explore-loading" style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          </div>
        ) : (
          <div className="explore-grid">
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

  // Show content progressively - no blocking error screens
  const hasData = highlights.length > 0 || blogPosts.length > 0
  const showSkeletons = (loading || myHighlightsLoading) && !hasData

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

      <div key={activeTab}>
        {renderTabContent()}
      </div>
    </div>
  )
}

export default Explore

