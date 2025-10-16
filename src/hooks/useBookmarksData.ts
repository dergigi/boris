import { useState, useEffect, useCallback } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IAccount, AccountManager } from 'applesauce-accounts'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchHighlights, fetchHighlightsForArticle } from '../services/highlightService'
import { fetchContacts } from '../services/contactService'
import { UserSettings } from '../services/settingsService'

interface UseBookmarksDataParams {
  relayPool: RelayPool | null
  activeAccount: IAccount | undefined
  accountManager: AccountManager
  naddr?: string
  externalUrl?: string
  currentArticleCoordinate?: string
  currentArticleEventId?: string
  settings?: UserSettings
}

export const useBookmarksData = ({
  relayPool,
  activeAccount,
  accountManager,
  naddr,
  externalUrl,
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
    // don't clear existing bookmarks: we keep UI stable and show spinner unobtrusively
    setBookmarksLoading(true)
    try {
      const fullAccount = accountManager.getActive()
      // merge-friendly: updater form that preserves visible list until replacement
      await fetchBookmarks(relayPool, fullAccount || activeAccount, (next) => {
        setBookmarks(() => next)
      }, settings)
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

  // Load initial data (avoid clearing on route-only changes)
  useEffect(() => {
    if (!relayPool || !activeAccount) return
    // Only (re)fetch bookmarks when account or relayPool changes, not on naddr route changes
    handleFetchBookmarks()
  }, [relayPool, activeAccount, handleFetchBookmarks])

  // Fetch highlights/contacts independently to avoid disturbing bookmarks
  useEffect(() => {
    if (!relayPool || !activeAccount) return
    // Only fetch general highlights when not viewing an article (naddr) or external URL
    // External URLs have their highlights fetched by useExternalUrlLoader
    if (!naddr && !externalUrl) {
      handleFetchHighlights()
    }
    handleFetchContacts()
  }, [relayPool, activeAccount, naddr, externalUrl, handleFetchHighlights, handleFetchContacts])

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

