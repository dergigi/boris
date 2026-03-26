import { useState, useEffect, useCallback } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IEventStore } from 'applesauce-core'
import { BlogPostPreview, fetchBlogPostsFromAuthors } from '../services/exploreService'
import { Highlight } from '../types/highlights'
import { fetchHighlightsFromAuthors } from '../services/highlightService'
import { fetchProfiles } from '../services/profileService'
import { nostrverseHighlightsController } from '../services/nostrverseHighlightsController'
import { nostrverseWritingsController } from '../services/nostrverseWritingsController'
import { getCachedPosts, setCachedPosts, getCachedHighlights, setCachedHighlights } from '../services/exploreCache'
import { dedupeHighlightsById, dedupeWritingsByReplaceable } from '../utils/dedupe'
import { HighlightVisibility } from '../components/HighlightsPanel'
import { UserSettings } from '../services/settingsService'

export const useExploreData = (
  relayPool: RelayPool,
  eventStore: IEventStore,
  activeAccount: { pubkey: string } | undefined,
  visibility: HighlightVisibility,
  followedPubkeys: Set<string>,
  setBlogPosts: React.Dispatch<React.SetStateAction<BlogPostPreview[]>>,
  setHighlights: React.Dispatch<React.SetStateAction<Highlight[]>>,
  hasHydratedRef: React.MutableRefObject<boolean>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  settings: UserSettings | undefined,
  refreshTrigger: number
) => {
  const [hasLoadedNostrverse, setHasLoadedNostrverse] = useState(false)

  // Subscribe to onLoading from both controllers (Issue 2)
  useEffect(() => {
    const unsubWritings = nostrverseWritingsController.onLoading((isLoading) => {
      if (!isLoading && !hasHydratedRef.current) {
        hasHydratedRef.current = true
        setLoading(false)
      }
    })
    
    const unsubHighlights = nostrverseHighlightsController.onLoading((isLoading) => {
      if (!isLoading && !hasHydratedRef.current) {
        hasHydratedRef.current = true
        setLoading(false)
      }
    })
    
    return () => {
      unsubWritings()
      unsubHighlights()
    }
  }, [hasHydratedRef, setLoading])

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

    // Trigger nostrverse controllers (they stream results via subscriptions)
    if (!activeAccount || visibility.nostrverse) {
      const force = refreshTrigger > 0
      nostrverseWritingsController.start({ relayPool, eventStore, force }).catch((err) => {
        console.warn('[Explore] Failed to start nostrverse writings controller:', err)
      })
      nostrverseHighlightsController.start({ relayPool, eventStore, force }).catch((err) => {
        console.warn('[Explore] Failed to start nostrverse highlights controller:', err)
      })
    }
  }, [relayPool, activeAccount, eventStore, visibility.nostrverse, refreshTrigger, setBlogPosts, setHighlights, setLoading])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Kick off friends fetches reactively when contacts arrive
  useEffect(() => {
    if (!relayPool) return
    if (followedPubkeys.size === 0) return
    let cancelled = false
    const relayUrls = Array.from(relayPool.relays.values()).map(relay => relay.url)
    const contactsArray = Array.from(followedPubkeys)

    fetchBlogPostsFromAuthors(relayPool, contactsArray, relayUrls, (post) => {
      if (cancelled) return
      setBlogPosts(prev => {
        const merged = dedupeWritingsByReplaceable([...prev, post])
        if (activeAccount) setCachedPosts(activeAccount.pubkey, merged)
        const authorPubkeys = Array.from(new Set(merged.map(p => p.author)))
        fetchProfiles(relayPool, eventStore, authorPubkeys, settings).catch((err) => {
          console.warn('[Explore] Failed to fetch author profiles:', err)
        })
        return merged.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
      })
      if (!hasHydratedRef.current) { hasHydratedRef.current = true; setLoading(false) }
    }, 100, eventStore).then((friendsPosts) => {
      if (cancelled) return
      setBlogPosts(prev => {
        const merged = dedupeWritingsByReplaceable([...prev, ...friendsPosts])
        if (activeAccount) setCachedPosts(activeAccount.pubkey, merged)
        return merged.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
      })
    }).catch((err) => {
      console.warn('[Explore] Failed to fetch blog posts from followed authors:', err)
      if (!cancelled && !hasHydratedRef.current) {
        hasHydratedRef.current = true
        setLoading(false)
      }
    })

    fetchHighlightsFromAuthors(relayPool, contactsArray, (highlight) => {
      if (cancelled) return
      setHighlights(prev => {
        const merged = dedupeHighlightsById([...prev, highlight])
        if (activeAccount) setCachedHighlights(activeAccount.pubkey, merged)
        return merged.sort((a, b) => b.created_at - a.created_at)
      })
      if (!hasHydratedRef.current) { hasHydratedRef.current = true; setLoading(false) }
    }, eventStore || undefined).then((friendsHighlights) => {
      if (cancelled) return
      setHighlights(prev => {
        const merged = dedupeHighlightsById([...prev, ...friendsHighlights])
        if (activeAccount) setCachedHighlights(activeAccount.pubkey, merged)
        return merged.sort((a, b) => b.created_at - a.created_at)
      })
    }).catch((err) => {
      console.warn('[Explore] Failed to fetch highlights from followed authors:', err)
      if (!cancelled && !hasHydratedRef.current) {
        hasHydratedRef.current = true
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [relayPool, followedPubkeys, eventStore, settings, activeAccount, setBlogPosts, setHighlights, hasHydratedRef, setLoading])

  // Lazy-load nostrverse content when user toggles it on (logged in)
  useEffect(() => {
    if (!activeAccount || !relayPool || !visibility.nostrverse || hasLoadedNostrverse) return
    setHasLoadedNostrverse(true)
    // Controllers stream results via subscriptions
    nostrverseWritingsController.start({ relayPool, eventStore }).catch((err) => {
      console.warn('[Explore] Failed to lazy-load nostrverse writings:', err)
    })
    nostrverseHighlightsController.start({ relayPool, eventStore }).catch((err) => {
      console.warn('[Explore] Failed to lazy-load nostrverse highlights:', err)
    })
  }, [activeAccount, relayPool, visibility.nostrverse, hasLoadedNostrverse, eventStore])

  return {
    hasLoadedNostrverse,
    setHasLoadedNostrverse
  }
}
