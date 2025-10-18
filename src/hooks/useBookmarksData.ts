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

  // Load cached article-specific highlights from event store
  const articleFilter = useMemo(() => {
    if (!currentArticleCoordinate) return null
    return {
      kinds: [KINDS.Highlights],
      '#a': [currentArticleCoordinate],
      ...(currentArticleEventId ? { '#e': [currentArticleEventId] } : {})
    }
  }, [currentArticleCoordinate, currentArticleEventId])
  
  const cachedArticleHighlights = useStoreTimeline(
    eventStore || null,
    articleFilter || { kinds: [KINDS.Highlights], limit: 0 }, // empty filter if no article
    eventToHighlight,
    [currentArticleCoordinate, currentArticleEventId]
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
      if (currentArticleCoordinate) {
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
          currentArticleCoordinate, 
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
  }, [relayPool, currentArticleCoordinate, currentArticleEventId, settings, eventStore, cachedArticleHighlights])

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
    if (currentArticleCoordinate && !externalUrl) {
      handleFetchHighlights()
    } else if (!naddr && !externalUrl) {
      // Clear article highlights when not viewing an article
      setArticleHighlights([])
      setHighlightsLoading(false)
    }
  }, [relayPool, activeAccount, currentArticleCoordinate, naddr, externalUrl, handleFetchHighlights])

  // Merge highlights from controller with article-specific highlights
  const highlights = [...myHighlights, ...articleHighlights]
    .filter((h, i, arr) => arr.findIndex(x => x.id === h.id) === i) // Deduplicate
    .sort((a, b) => b.created_at - a.created_at)

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

