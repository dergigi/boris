import { useState, useEffect, useCallback, useMemo } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { IEventStore } from 'applesauce-core'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { fetchHighlightsForArticle } from '../services/highlightService'
import { UserSettings } from '../services/settingsService'
import { highlightsController } from '../services/highlightsController'
import { contactsController } from '../services/contactsController'
import { useStoreTimeline } from './useStoreTimeline'
import { eventToHighlight } from '../services/highlightEventProcessor'
import { KINDS } from '../config/kinds'
import { nip19 } from 'nostr-tools'

interface UseBookmarksDataParams {
  relayPool: RelayPool | null
  activeAccount: IAccount | undefined
  naddr?: string
  externalUrl?: string
  currentArticleCoordinate?: string
  currentArticleEventId?: string
  settings?: UserSettings
  eventStore?: IEventStore | null
  bookmarks: Bookmark[] // Passed from App.tsx (centralized loading)
  bookmarksLoading: boolean // Passed from App.tsx (centralized loading)
  onRefreshBookmarks: () => Promise<void>
}

export const useBookmarksData = ({
  relayPool,
  activeAccount,
  naddr,
  externalUrl,
  currentArticleCoordinate,
  currentArticleEventId,
  settings,
  eventStore,
  onRefreshBookmarks
}: Omit<UseBookmarksDataParams, 'bookmarks' | 'bookmarksLoading'>) => {
  const [myHighlights, setMyHighlights] = useState<Highlight[]>([])
  const [articleHighlights, setArticleHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(true)
  const [followedPubkeys, setFollowedPubkeys] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null)

  // Determine effective article coordinate as early as possible
  // Prefer state-derived coordinate, but fall back to route naddr before content loads
  const effectiveArticleCoordinate = useMemo(() => {
    if (currentArticleCoordinate) return currentArticleCoordinate
    if (!naddr) return undefined
    try {
      const decoded = nip19.decode(naddr)
      if (decoded.type === 'naddr') {
        const ptr = decoded.data as { kind: number; pubkey: string; identifier: string }
        return `${ptr.kind}:${ptr.pubkey}:${ptr.identifier}`
      }
    } catch {
      // ignore decode failure; treat as no coordinate yet
    }
    return undefined
  }, [currentArticleCoordinate, naddr])

  // Load cached article-specific highlights from event store
  const articleFilter = useMemo(() => {
    if (!effectiveArticleCoordinate) return null
    return {
      kinds: [KINDS.Highlights],
      '#a': [effectiveArticleCoordinate],
      ...(currentArticleEventId ? { '#e': [currentArticleEventId] } : {})
    }
  }, [effectiveArticleCoordinate, currentArticleEventId])
  
  const cachedArticleHighlights = useStoreTimeline(
    eventStore || null,
    articleFilter || { kinds: [KINDS.Highlights], limit: 0 }, // empty filter if no article
    eventToHighlight,
    [effectiveArticleCoordinate, currentArticleEventId]
  )

  // Subscribe to centralized controllers
  useEffect(() => {
    // Get initial state immediately
    setMyHighlights(highlightsController.getHighlights())
    setFollowedPubkeys(new Set(contactsController.getContacts()))
    
    // Subscribe to updates
    const unsubHighlights = highlightsController.onHighlights(setMyHighlights)
    const unsubContacts = contactsController.onContacts((contacts) => {
      setFollowedPubkeys(new Set(contacts))
    })
    
    return () => {
      unsubHighlights()
      unsubContacts()
    }
  }, [])

  const handleFetchHighlights = useCallback(async () => {
    if (!relayPool) return
    
    setHighlightsLoading(true)
    try {
      if (effectiveArticleCoordinate) {
        // Seed with cached highlights first
        if (cachedArticleHighlights.length > 0) {
          setArticleHighlights(cachedArticleHighlights.sort((a, b) => b.created_at - a.created_at))
        }
        
        // Fetch fresh article-specific highlights (from all users)
        const highlightsMap = new Map<string, Highlight>()
        // Seed map with cached highlights
        cachedArticleHighlights.forEach(h => highlightsMap.set(h.id, h))
        
        await fetchHighlightsForArticle(
          relayPool, 
          effectiveArticleCoordinate, 
          currentArticleEventId,
          (highlight) => {
            // Deduplicate highlights by ID as they arrive
            if (!highlightsMap.has(highlight.id)) {
              highlightsMap.set(highlight.id, highlight)
              const highlightsList = Array.from(highlightsMap.values())
              setArticleHighlights(highlightsList.sort((a, b) => b.created_at - a.created_at))
            }
          },
          settings,
          false, // force
          eventStore || undefined
        )
      } else {
        // No article selected - clear article highlights
        setArticleHighlights([])
      }
    } catch (err) {
      console.error('Failed to fetch highlights:', err)
    } finally {
      setHighlightsLoading(false)
    }
  }, [relayPool, effectiveArticleCoordinate, currentArticleEventId, settings, eventStore, cachedArticleHighlights])

  const handleRefreshAll = useCallback(async () => {
    if (!relayPool || !activeAccount || isRefreshing) return
    
    setIsRefreshing(true)
    try {
      await onRefreshBookmarks()
      await handleFetchHighlights()
      // Contacts and own highlights are managed by controllers
      setLastFetchTime(Date.now())
    } catch (err) {
      console.error('Failed to refresh data:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [relayPool, activeAccount, isRefreshing, onRefreshBookmarks, handleFetchHighlights])

  // Fetch article-specific highlights when viewing an article
  useEffect(() => {
    if (!relayPool || !activeAccount) return
    // Fetch article-specific highlights when viewing an article
    // External URLs have their highlights fetched by useExternalUrlLoader
    if (effectiveArticleCoordinate && !externalUrl) {
      handleFetchHighlights()
    } else if (!naddr && !externalUrl) {
      // Clear article highlights when not viewing an article
      setArticleHighlights([])
      setHighlightsLoading(false)
    }
  }, [relayPool, activeAccount, effectiveArticleCoordinate, naddr, externalUrl, handleFetchHighlights])

  // When viewing an article, show only article-specific highlights
  // Otherwise, show user's highlights from controller
  const highlights = effectiveArticleCoordinate || externalUrl
    ? articleHighlights.sort((a, b) => b.created_at - a.created_at)
    : myHighlights

  return {
    highlights,
    setHighlights: setArticleHighlights, // For external updates (like from useExternalUrlLoader)
    highlightsLoading,
    setHighlightsLoading,
    followedPubkeys,
    isRefreshing,
    lastFetchTime,
    handleFetchHighlights,
    handleRefreshAll
  }
}

