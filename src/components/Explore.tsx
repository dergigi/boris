import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faNewspaper, faHighlighter, faUser, faUserGroup, faNetworkWired, faArrowsRotate, faSpinner } from '@fortawesome/free-solid-svg-icons'
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
import { nostrverseHighlightsController } from '../services/nostrverseHighlightsController'
import { highlightsController } from '../services/highlightsController'
import { Highlight } from '../types/highlights'
import { UserSettings } from '../services/settingsService'
import BlogPostCard from './BlogPostCard'
import { HighlightItem } from './HighlightItem'
import { getCachedPosts, setCachedPosts, getCachedHighlights, setCachedHighlights } from '../services/exploreCache'
import { usePullToRefresh } from 'use-pull-to-refresh'
import RefreshIndicator from './RefreshIndicator'
import { classifyHighlights } from '../utils/highlightClassification'
import { HighlightVisibility } from './HighlightsPanel'
// import { KINDS } from '../config/kinds'
// import { eventToHighlight } from '../services/highlightEventProcessor'
// import { useStoreTimeline } from '../hooks/useStoreTimeline'
import { dedupeHighlightsById, dedupeWritingsByReplaceable } from '../utils/dedupe'
import { writingsController } from '../services/writingsController'
import { nostrverseWritingsController } from '../services/nostrverseWritingsController'
import { readingProgressController } from '../services/readingProgressController'

// Accessors from Helpers (currently unused here)
// const { getArticleTitle, getArticleImage, getArticlePublished, getArticleSummary } = Helpers

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
  const [hasLoadedMine, setHasLoadedMine] = useState(false)
  const [hasLoadedNostrverseHighlights, setHasLoadedNostrverseHighlights] = useState(false)
  
  // Get myHighlights directly from controller
  const [/* myHighlights */, setMyHighlights] = useState<Highlight[]>([])
  // Remove unused loading state to avoid warnings
  
  // Reading progress state (naddr -> progress 0-1)
  const [readingProgressMap, setReadingProgressMap] = useState<Map<string, number>>(new Map())
  
  // Load cached content from event store (instant display)
  // const cachedHighlights = useStoreTimeline(eventStore, { kinds: [KINDS.Highlights] }, eventToHighlight, [])
  
  // const toBlogPostPreview = useCallback((event: NostrEvent): BlogPostPreview => ({
  //   event,
  //   title: getArticleTitle(event) || 'Untitled',
  //   summary: getArticleSummary(event),
  //   image: getArticleImage(event),
  //   published: getArticlePublished(event),
  //   author: event.pubkey
  // }), [])
  
  // const cachedWritings = useStoreTimeline(eventStore, { kinds: [30023] }, toBlogPostPreview, [])

  
  
  // Visibility filters (defaults from settings or nostrverse when logged out)
  const [visibility, setVisibility] = useState<HighlightVisibility>({
    nostrverse: activeAccount ? (settings?.defaultExploreScopeNostrverse ?? false) : true,
    friends: settings?.defaultExploreScopeFriends ?? true,
    mine: settings?.defaultExploreScopeMine ?? false
  })

  // Ensure at least one scope remains active
  const toggleScope = useCallback((key: 'nostrverse' | 'friends' | 'mine') => {
    setVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (!next.nostrverse && !next.friends && !next.mine) {
        return prev // ignore toggle that would disable all scopes
      }
      return next
    })
  }, [])

  // Subscribe to highlights controller
  useEffect(() => {
    const unsubHighlights = highlightsController.onHighlights(setMyHighlights)
    return () => {
      unsubHighlights()
    }
  }, [])

  // Subscribe to nostrverse highlights controller for global stream
  useEffect(() => {
    const apply = (incoming: Highlight[]) => {
      setHighlights(prev => {
        const byId = new Map(prev.map(h => [h.id, h]))
        for (const h of incoming) byId.set(h.id, h)
        return Array.from(byId.values()).sort((a, b) => b.created_at - a.created_at)
      })
    }
    // seed immediately
    apply(nostrverseHighlightsController.getHighlights())
    const unsub = nostrverseHighlightsController.onHighlights(apply)
    return () => unsub()
  }, [])

  // Subscribe to nostrverse writings controller for global stream
  useEffect(() => {
    const apply = (incoming: BlogPostPreview[]) => {
      setBlogPosts(prev => {
        const byKey = new Map<string, BlogPostPreview>()
        for (const p of prev) {
          const dTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
          const key = `${p.author}:${dTag}`
          byKey.set(key, p)
        }
        for (const p of incoming) {
          const dTag = p.event.tags.find(t => t[0] === 'd')?.[1] || ''
          const key = `${p.author}:${dTag}`
          const existing = byKey.get(key)
          if (!existing || p.event.created_at > existing.event.created_at) byKey.set(key, p)
        }
        return Array.from(byKey.values()).sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
      })
    }
    apply(nostrverseWritingsController.getWritings())
    const unsub = nostrverseWritingsController.onWritings(apply)
    return () => unsub()
  }, [])

  // Subscribe to writings controller for "mine" posts and seed immediately
  useEffect(() => {
    // Seed from controller's current state
    const seed = writingsController.getWritings()
    if (seed.length > 0) {
      setBlogPosts(prev => {
        const merged = dedupeWritingsByReplaceable([...prev, ...seed])
        return merged.sort((a, b) => {
          const timeA = a.published || a.event.created_at
          const timeB = b.published || b.event.created_at
          return timeB - timeA
        })
      })
    }

    // Stream updates
    const unsub = writingsController.onWritings((posts) => {
      setBlogPosts(prev => {
        const merged = dedupeWritingsByReplaceable([...prev, ...posts])
        return merged.sort((a, b) => {
          const timeA = a.published || a.event.created_at
          const timeB = b.published || b.event.created_at
          return timeB - timeA
        })
      })
    })

    return () => unsub()
  }, [])
  
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

  // Update visibility when settings/login state changes
  useEffect(() => {
    if (!activeAccount) {
      // When logged out, show nostrverse by default
      setVisibility(prev => ({ ...prev, nostrverse: true, friends: false, mine: false }))
      setHasLoadedNostrverse(true) // logged out path loads nostrverse immediately
      setHasLoadedNostrverseHighlights(true)
    } else {
      // When logged in, use settings defaults immediately
      setVisibility({
        nostrverse: settings?.defaultExploreScopeNostrverse ?? false,
        friends: settings?.defaultExploreScopeFriends ?? true,
        mine: settings?.defaultExploreScopeMine ?? false
      })
      setHasLoadedNostrverse(false)
      setHasLoadedNostrverseHighlights(false)
    }
  }, [activeAccount, settings?.defaultExploreScopeNostrverse, settings?.defaultExploreScopeFriends, settings?.defaultExploreScopeMine])

  // Update local state when prop changes
  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab)
    }
  }, [propActiveTab])

  // Load initial data and refresh on triggers
  const loadData = useCallback(() => {
    if (!relayPool) return

    // Seed from cache for instant UI
    if (activeAccount) {
      const cachedPosts = getCachedPosts(activeAccount.pubkey)
      if (cachedPosts && cachedPosts.length > 0) setBlogPosts(cachedPosts)
      const cached = getCachedHighlights(activeAccount.pubkey)
      if (cached && cached.length > 0) setHighlights(cached)
    }

    setLoading(true)

    try {
      // Followed pubkeys
      if (activeAccount?.pubkey) {
        fetchContacts(relayPool, activeAccount.pubkey)
        .then((contacts) => {
          setFollowedPubkeys(new Set(contacts))
        })
        .catch(() => {})
      }

      // Prepare parallel fetches
      const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
      const contactsArray = Array.from(followedPubkeys)

      const nostrversePostsPromise: Promise<BlogPostPreview[]> = (!activeAccount || (activeAccount && visibility.nostrverse))
        ? fetchNostrverseBlogPosts(relayPool, relayUrls, 50, eventStore || undefined).catch(() => [])
        : Promise.resolve([])

        // Fire non-blocking fetches and merge as they resolve
        fetchBlogPostsFromAuthors(relayPool, contactsArray, relayUrls)
          .then((friendsPosts) => {
            setBlogPosts(prev => {
              const merged = dedupeWritingsByReplaceable([...prev, ...friendsPosts])
              const sorted = merged.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
              if (activeAccount) setCachedPosts(activeAccount.pubkey, sorted)
              // Pre-cache profiles in background
              const authorPubkeys = Array.from(new Set(sorted.map(p => p.author)))
              fetchProfiles(relayPool, eventStore, authorPubkeys, settings).catch(() => {})
              return sorted
            })
          }).catch(() => {})

        fetchHighlightsFromAuthors(relayPool, contactsArray)
          .then((friendsHighlights) => {
            setHighlights(prev => {
              const merged = dedupeHighlightsById([...prev, ...friendsHighlights])
              const sorted = merged.sort((a, b) => b.created_at - a.created_at)
              if (activeAccount) setCachedHighlights(activeAccount.pubkey, sorted)
              return sorted
            })
          }).catch(() => {})

        nostrversePostsPromise.then((nostrversePosts) => {
          setBlogPosts(prev => dedupeWritingsByReplaceable([...prev, ...nostrversePosts]).sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at)))
        }).catch(() => {})

        fetchNostrverseHighlights(relayPool, 100, eventStore || undefined)
          .then((nostriverseHighlights) => {
            setHighlights(prev => dedupeHighlightsById([...prev, ...nostriverseHighlights]).sort((a, b) => b.created_at - a.created_at))
          }).catch(() => {})
      } catch (err) {
        console.error('Failed to load data:', err)
        // No blocking error - user can pull-to-refresh
      } finally {
        // loading is already turned off after seeding
      }
  }, [relayPool, activeAccount, eventStore, settings, visibility.nostrverse, followedPubkeys])

  useEffect(() => {
    loadData()
  }, [loadData, refreshTrigger])

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

    fetchNostrverseHighlights(relayPool, 100, eventStore || undefined)
      .then((nostriverseHighlights) => {
        setHighlights(prev => dedupeHighlightsById([...prev, ...nostriverseHighlights]).sort((a, b) => b.created_at - a.created_at))
      }).catch(() => {})
  }, [activeAccount, relayPool, visibility.nostrverse, hasLoadedNostrverse, eventStore])

  // Lazy-load nostrverse highlights when user toggles it on (logged in)
  useEffect(() => {
    if (!activeAccount || !relayPool || !visibility.nostrverse || hasLoadedNostrverseHighlights) return
    setHasLoadedNostrverseHighlights(true)
    fetchNostrverseHighlights(relayPool, 100, eventStore || undefined)
      .then((hl) => {
        if (hl && hl.length > 0) {
          setHighlights(prev => dedupeHighlightsById([...prev, ...hl]).sort((a, b) => b.created_at - a.created_at))
        }
      })
      .catch(() => {})
  }, [visibility.nostrverse, activeAccount, relayPool, eventStore, hasLoadedNostrverseHighlights])

  // Lazy-load my writings when user toggles "mine" on (logged in)
  // No direct fetch here; writingsController streams my posts centrally
  useEffect(() => {
    if (!activeAccount || !visibility.mine || hasLoadedMine) return
    setHasLoadedMine(true)
  }, [visibility.mine, activeAccount, hasLoadedMine])

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
  }, [uniqueSortedPosts, activeAccount, followedPubkeys, visibility])
  
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
                readingProgress={getReadingProgress(post)}
                hideBotByName={settings?.hideBotArticlesByName !== false}
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
            <span>No highlights to show for the selected scope.</span>
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

      <div key={activeTab}>
        {renderTabContent()}
      </div>
    </div>
  )
}

export default Explore

