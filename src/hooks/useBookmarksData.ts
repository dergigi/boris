import { useState, useEffect, useCallback } from 'react'
import { RelayPool } from 'applesauce-relay'
import { IAccount, AccountManager } from 'applesauce-accounts'
import { IEventStore } from 'applesauce-core'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchHighlights, fetchHighlightsForArticle } from '../services/highlightService'
import { fetchContacts } from '../services/contactService'
import { UserSettings } from '../services/settingsService'
import { loadReadingPosition, generateArticleIdentifier } from '../services/readingPositionService'
import { fetchReadArticles } from '../services/libraryService'
import { nip19 } from 'nostr-tools'

interface UseBookmarksDataParams {
  relayPool: RelayPool | null
  activeAccount: IAccount | undefined
  accountManager: AccountManager
  naddr?: string
  externalUrl?: string
  currentArticleCoordinate?: string
  currentArticleEventId?: string
  settings?: UserSettings
  eventStore?: IEventStore
}

export const useBookmarksData = ({
  relayPool,
  activeAccount,
  accountManager,
  naddr,
  externalUrl,
  currentArticleCoordinate,
  currentArticleEventId,
  settings,
  eventStore
}: UseBookmarksDataParams) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(true)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(true)
  const [followedPubkeys, setFollowedPubkeys] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null)
  const [readingPositions, setReadingPositions] = useState<Map<string, number>>(new Map())
  const [markedAsReadIds, setMarkedAsReadIds] = useState<Set<string>>(new Set())

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

  // Fetch marked-as-read articles
  useEffect(() => {
    const loadMarkedAsRead = async () => {
      if (!activeAccount || !relayPool || !eventStore || bookmarks.length === 0) {
        return
      }

      try {
        const readArticles = await fetchReadArticles(relayPool, activeAccount.pubkey)
        
        // Create a set of bookmark IDs that are marked as read
        const markedBookmarkIds = new Set<string>()
        
        // For each read article, we need to match it to bookmark IDs
        for (const readArticle of readArticles) {
          // Add the event ID directly (for web bookmarks and legacy compatibility)
          markedBookmarkIds.add(readArticle.id)
          
          // For nostr-native articles (kind:7 reactions), also add the coordinate format
          if (readArticle.eventId && readArticle.eventAuthor && readArticle.eventKind) {
            // Try to get the event from the eventStore to find the 'd' tag
            const event = eventStore.getEvent(readArticle.eventId)
            if (event) {
              const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || ''
              const coordinate = `${event.kind}:${event.pubkey}:${dTag}`
              markedBookmarkIds.add(coordinate)
            }
          }
        }
        
        setMarkedAsReadIds(markedBookmarkIds)
      } catch (error) {
        console.warn('⚠️ [Bookmarks] Failed to load marked-as-read articles:', error)
      }
    }

    loadMarkedAsRead()
  }, [relayPool, activeAccount, eventStore, bookmarks])

  // Load reading positions for bookmarked articles (kind:30023)
  useEffect(() => {
    const loadPositions = async () => {
      if (!activeAccount || !relayPool || !eventStore || bookmarks.length === 0 || !settings?.syncReadingPosition) {
        return
      }

      const positions = new Map<string, number>()

      // Extract all kind:30023 articles from bookmarks
      const articles = bookmarks.flatMap(bookmark => 
        (bookmark.individualBookmarks || []).filter(item => item.kind === 30023)
      )

      await Promise.all(
        articles.map(async (article) => {
          try {
            const dTag = article.tags.find(t => t[0] === 'd')?.[1] || ''
            const naddr = nip19.naddrEncode({
              kind: 30023,
              pubkey: article.pubkey,
              identifier: dTag
            })
            const articleUrl = `nostr:${naddr}`
            const identifier = generateArticleIdentifier(articleUrl)

            const savedPosition = await loadReadingPosition(
              relayPool,
              eventStore,
              activeAccount.pubkey,
              identifier
            )

            if (savedPosition && savedPosition.position > 0) {
              positions.set(article.id, savedPosition.position)
            }
          } catch (error) {
            console.warn('⚠️ [Bookmarks] Failed to load reading position for article:', error)
          }
        })
      )

      setReadingPositions(positions)
    }

    loadPositions()
  }, [bookmarks, activeAccount, relayPool, eventStore, settings?.syncReadingPosition])

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
    handleRefreshAll,
    readingPositions,
    markedAsReadIds
  }
}

