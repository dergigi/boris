import { useState, useEffect, useCallback } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IAccount } from 'applesauce-accounts'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { fetchHighlights, fetchHighlightsForArticle } from '../services/highlightService'
import { fetchContacts } from '../services/contactService'
import { UserSettings } from '../services/settingsService'

interface UseBookmarksDataParams {
  relayPool: RelayPool | null
  activeAccount: IAccount | undefined
  naddr?: string
  externalUrl?: string
  currentArticleCoordinate?: string
  currentArticleEventId?: string
  settings?: UserSettings
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
  onRefreshBookmarks
}: Omit<UseBookmarksDataParams, 'bookmarks' | 'bookmarksLoading'>) => {
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
      await onRefreshBookmarks()
      await handleFetchHighlights()
      await handleFetchContacts()
      setLastFetchTime(Date.now())
    } catch (err) {
      console.error('Failed to refresh data:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [relayPool, activeAccount, isRefreshing, onRefreshBookmarks, handleFetchHighlights, handleFetchContacts])

  // Fetch highlights/contacts independently
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
    highlights,
    setHighlights,
    highlightsLoading,
    setHighlightsLoading,
    followedPubkeys,
    isRefreshing,
    lastFetchTime,
    handleFetchHighlights,
    handleRefreshAll
  }
}

