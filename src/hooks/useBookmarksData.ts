import { useState, useEffect, useCallback } from 'react'
import { RelayPool } from 'applesauce-relay'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchHighlights, fetchHighlightsForArticle } from '../services/highlightService'
import { fetchContacts } from '../services/contactService'
import { UserSettings } from '../services/settingsService'

interface UseBookmarksDataParams {
  relayPool: RelayPool | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeAccount: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accountManager: any
  naddr?: string
  currentArticleCoordinate?: string
  currentArticleEventId?: string
  settings?: UserSettings
}

export const useBookmarksData = ({
  relayPool,
  activeAccount,
  accountManager,
  naddr,
  currentArticleCoordinate,
  currentArticleEventId,
  settings
}: UseBookmarksDataParams) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(true)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(true)
  const [followedPubkeys, setFollowedPubkeys] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null)

  const handleFetchContacts = useCallback(async () => {
    if (!relayPool || !activeAccount) return
    const contacts = await fetchContacts(relayPool, activeAccount.pubkey)
    setFollowedPubkeys(contacts)
  }, [relayPool, activeAccount])

  const handleFetchBookmarks = useCallback(async () => {
    if (!relayPool || !activeAccount) return
    setBookmarksLoading(true)
    try {
      const fullAccount = accountManager.getActive()
      await fetchBookmarks(relayPool, fullAccount || activeAccount, setBookmarks, settings)
    } finally {
      setBookmarksLoading(false)
    }
  }, [relayPool, activeAccount, accountManager, settings])

  const handleFetchHighlights = useCallback(async () => {
    if (!relayPool) return
    
    setHighlightsLoading(true)
    try {
      if (currentArticleCoordinate) {
        const highlightsMap = new Map<string, Highlight>()
        await fetchHighlightsForArticle(
          relayPool, 
          currentArticleCoordinate, 
          currentArticleEventId,
          (highlight) => {
            // Deduplicate highlights by ID as they arrive
            if (!highlightsMap.has(highlight.id)) {
              highlightsMap.set(highlight.id, highlight)
              const highlightsList = Array.from(highlightsMap.values())
              setHighlights(highlightsList.sort((a, b) => b.created_at - a.created_at))
            }
          },
          settings
        )
        console.log(`🔄 Refreshed ${highlightsMap.size} highlights for article`)
      } else if (activeAccount) {
        const fetchedHighlights = await fetchHighlights(relayPool, activeAccount.pubkey, undefined, settings)
        setHighlights(fetchedHighlights)
      }
    } catch (err) {
      console.error('Failed to fetch highlights:', err)
    } finally {
      setHighlightsLoading(false)
    }
  }, [relayPool, activeAccount, currentArticleCoordinate, currentArticleEventId, settings])

  const handleRefreshAll = useCallback(async () => {
    if (!relayPool || !activeAccount || isRefreshing) return
    
    setIsRefreshing(true)
    try {
      await handleFetchBookmarks()
      await handleFetchHighlights()
      await handleFetchContacts()
      setLastFetchTime(Date.now())
    } catch (err) {
      console.error('Failed to refresh data:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [relayPool, activeAccount, isRefreshing, handleFetchBookmarks, handleFetchHighlights, handleFetchContacts])

  // Load initial data
  useEffect(() => {
    if (!relayPool || !activeAccount) return
    handleFetchBookmarks()
    if (!naddr) {
      handleFetchHighlights()
    }
    handleFetchContacts()
  }, [relayPool, activeAccount?.pubkey, naddr, handleFetchBookmarks, handleFetchHighlights, handleFetchContacts])

  return {
    bookmarks,
    bookmarksLoading,
    highlights,
    setHighlights,
    highlightsLoading,
    setHighlightsLoading,
    followedPubkeys,
    isRefreshing,
    lastFetchTime,
    handleFetchBookmarks,
    handleFetchHighlights,
    handleRefreshAll
  }
}

