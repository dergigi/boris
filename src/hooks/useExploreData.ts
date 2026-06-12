import { useState, useEffect, useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
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
  setBlogPosts: Dispatch<SetStateAction<BlogPostPreview[]>>,
  setHighlights: Dispatch<SetStateAction<Highlight[]>>,
  hasHydratedRef: MutableRefObject<boolean>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  settings: UserSettings | undefined,
  refreshTrigger: number
) => {
  const [hasLoadedNostrverse, setHasLoadedNostrverse] = useState(false)
  const lastCachedAccountPubkeyRef = useRef<string | null>()

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

  // Seed cache for the active account without reintroducing stale data from another account
  useEffect(() => {
    const pubkey = activeAccount?.pubkey ?? null
    const previousPubkey = lastCachedAccountPubkeyRef.current
    lastCachedAccountPubkeyRef.current = pubkey

    if (!pubkey) return

    const didSwitchAccounts = previousPubkey !== undefined && previousPubkey !== pubkey
    const cachedPosts = getCachedPosts(pubkey)
    const cachedHighlights = getCachedHighlights(pubkey)

    setBlogPosts(prev => {
      if (!didSwitchAccounts && prev.length > 0) return prev
      if (didSwitchAccounts && (!cachedPosts || cachedPosts.length === 0)) return []
      return cachedPosts && cachedPosts.length > 0 ? cachedPosts : prev
    })

    setHighlights(prev => {
      if (!didSwitchAccounts && prev.length > 0) return prev
      if (didSwitchAccounts && (!cachedHighlights || cachedHighlights.length === 0)) return []
      return cachedHighlights && cachedHighlights.length > 0 ? cachedHighlights : prev
    })
  }, [activeAccount?.pubkey, setBlogPosts, setHighlights])

  // Start nostrverse controllers (single entry point)
  const loadData = useCallback(() => {
    if (!relayPool) return
    if (activeAccount && !visibility.nostrverse) return

    hasHydratedRef.current = false
    setLoading(true)

    const force = refreshTrigger > 0
    nostrverseWritingsController.start({ relayPool, eventStore, force }).catch((err) => {
      console.warn('[Explore] Failed to start nostrverse writings controller:', err)
    })
    nostrverseHighlightsController.start({ relayPool, eventStore, force }).catch((err) => {
      console.warn('[Explore] Failed to start nostrverse highlights controller:', err)
    })
  }, [relayPool, activeAccount, eventStore, visibility.nostrverse, refreshTrigger, hasHydratedRef, setLoading])

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
    const newAuthorPubkeys = new Set<string>()

    fetchBlogPostsFromAuthors(relayPool, contactsArray, relayUrls, (post) => {
      if (cancelled) return
      newAuthorPubkeys.add(post.author)
      setBlogPosts(prev => {
        const merged = dedupeWritingsByReplaceable([...prev, post])
        if (activeAccount) setCachedPosts(activeAccount.pubkey, merged)
        return merged.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
      })
      if (!hasHydratedRef.current) { hasHydratedRef.current = true; setLoading(false) }
    }, 100, eventStore).then((friendsPosts) => {
      if (cancelled) return
      friendsPosts.forEach(p => newAuthorPubkeys.add(p.author))
      setBlogPosts(prev => {
        const merged = dedupeWritingsByReplaceable([...prev, ...friendsPosts])
        if (activeAccount) setCachedPosts(activeAccount.pubkey, merged)
        return merged.sort((a, b) => (b.published || b.event.created_at) - (a.published || a.event.created_at))
      })
      // Batch fetch profiles for all discovered authors
      if (newAuthorPubkeys.size > 0) {
        fetchProfiles(relayPool, eventStore, Array.from(newAuthorPubkeys), settings).catch((err) => {
          console.warn('[Explore] Failed to fetch author profiles:', err)
        })
      }
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

  // Track whether nostrverse has been loaded at least once
  useEffect(() => {
    if (!activeAccount || !relayPool || !visibility.nostrverse || hasLoadedNostrverse) return
    setHasLoadedNostrverse(true)
    // loadData already handles the start; this just tracks the flag
  }, [activeAccount, relayPool, visibility.nostrverse, hasLoadedNostrverse])

  return {
    hasLoadedNostrverse,
    setHasLoadedNostrverse
  }
}
