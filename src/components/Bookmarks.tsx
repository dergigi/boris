import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Hooks } from 'applesauce-react'
import { useEventStore } from 'applesauce-react/hooks'
import { RelayPool } from 'applesauce-relay'
import { Bookmark } from '../types/bookmarks'
import { Highlight } from '../types/highlights'
import { BookmarkList } from './BookmarkList'
import { fetchBookmarks } from '../services/bookmarkService'
import { fetchHighlights, fetchHighlightsForArticle } from '../services/highlightService'
import { fetchContacts } from '../services/contactService'
import ContentPanel from './ContentPanel'
import { HighlightsPanel } from './HighlightsPanel'
import { ReadableContent } from '../services/readerService'
import Settings from './Settings'
import Toast from './Toast'
import { useSettings } from '../hooks/useSettings'
import { useArticleLoader } from '../hooks/useArticleLoader'
import { useExternalUrlLoader } from '../hooks/useExternalUrlLoader'
import { loadContent, BookmarkReference } from '../utils/contentLoader'
import { HighlightVisibility } from './HighlightsPanel'
import { HighlightButton, HighlightButtonRef } from './HighlightButton'
import { createHighlight, eventToHighlight } from '../services/highlightCreationService'
import { useRef, useCallback } from 'react'
import { NostrEvent, nip19 } from 'nostr-tools'
export type ViewMode = 'compact' | 'cards' | 'large'

interface BookmarksProps {
  relayPool: RelayPool | null
  onLogout: () => void
}

const Bookmarks: React.FC<BookmarksProps> = ({ relayPool, onLogout }) => {
  const { naddr } = useParams<{ naddr?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  
  // Extract external URL from /r/* route
  const externalUrl = location.pathname.startsWith('/r/') 
    ? decodeURIComponent(location.pathname.slice(3)) // Remove '/r/' prefix and decode
    : undefined
    
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(true)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(true)
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(undefined)
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerContent, setReaderContent] = useState<ReadableContent | undefined>(undefined)
  const [isCollapsed, setIsCollapsed] = useState(true) // Start collapsed
  const [isHighlightsCollapsed, setIsHighlightsCollapsed] = useState(true) // Start collapsed
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [showHighlights, setShowHighlights] = useState(true)
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [currentArticleCoordinate, setCurrentArticleCoordinate] = useState<string | undefined>(undefined)
  const [currentArticleEventId, setCurrentArticleEventId] = useState<string | undefined>(undefined)
  const [currentArticle, setCurrentArticle] = useState<NostrEvent | undefined>(undefined) // Store the current article event
  const [highlightVisibility, setHighlightVisibility] = useState<HighlightVisibility>({
    nostrverse: true,
    friends: true,
    mine: true
  })
  const [followedPubkeys, setFollowedPubkeys] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const activeAccount = Hooks.useActiveAccount()
  const accountManager = Hooks.useAccountManager()
  const eventStore = useEventStore()
  const highlightButtonRef = useRef<HighlightButtonRef>(null)
  
  const { settings, saveSettings, toastMessage, toastType, clearToast } = useSettings({
    relayPool,
    eventStore,
    pubkey: activeAccount?.pubkey,
    accountManager
  })

  // Load nostr-native article if naddr is in URL
  useArticleLoader({
    naddr,
    relayPool,
    setSelectedUrl,
    setReaderContent,
    setReaderLoading,
    setIsCollapsed,
    setHighlights,
    setHighlightsLoading,
    setCurrentArticleCoordinate,
    setCurrentArticleEventId,
    setCurrentArticle
  })
  
  // Load external URL if /r/* route is used
  useExternalUrlLoader({
    url: externalUrl,
    relayPool,
    setSelectedUrl,
    setReaderContent,
    setReaderLoading,
    setIsCollapsed,
    setHighlights,
    setHighlightsLoading,
    setCurrentArticleCoordinate,
    setCurrentArticleEventId
  })

  // Load initial data on login
  useEffect(() => {
    if (!relayPool || !activeAccount) return
    handleFetchBookmarks()
    // Avoid overwriting article-specific highlights during initial article load
    // If an article is being viewed (naddr present), let useArticleLoader own the first highlights set
    if (!naddr) {
      handleFetchHighlights()
    }
    handleFetchContacts()
  }, [relayPool, activeAccount?.pubkey])

  const handleFetchContacts = async () => {
    if (!relayPool || !activeAccount) return
    const contacts = await fetchContacts(relayPool, activeAccount.pubkey)
    setFollowedPubkeys(contacts)
  }

  // Apply UI settings
  useEffect(() => {
    if (settings.defaultViewMode) setViewMode(settings.defaultViewMode)
    if (settings.showHighlights !== undefined) setShowHighlights(settings.showHighlights)
    // Apply default highlight visibility settings
    setHighlightVisibility({
      nostrverse: settings.defaultHighlightVisibilityNostrverse !== false,
      friends: settings.defaultHighlightVisibilityFriends !== false,
      mine: settings.defaultHighlightVisibilityMine !== false
    })
    // Always start with both panels collapsed on initial load
    // Don't apply saved collapse settings on initial load - let user control them
  }, [settings])

  const handleFetchBookmarks = async () => {
    if (!relayPool || !activeAccount) return
    setBookmarksLoading(true)
    try {
      const fullAccount = accountManager.getActive()
      await fetchBookmarks(relayPool, fullAccount || activeAccount, setBookmarks)
    } finally {
      setBookmarksLoading(false)
    }
  }

  const handleFetchHighlights = async () => {
    if (!relayPool) return
    
    setHighlightsLoading(true)
    try {
      // If we're viewing an article, fetch highlights for that article
      if (currentArticleCoordinate) {
        const highlightsList: Highlight[] = []
        await fetchHighlightsForArticle(
          relayPool, 
          currentArticleCoordinate, 
          currentArticleEventId,
          (highlight) => {
            // Render each highlight immediately as it arrives
            highlightsList.push(highlight)
            setHighlights([...highlightsList].sort((a, b) => b.created_at - a.created_at))
          }
        )
        console.log(`🔄 Refreshed ${highlightsList.length} highlights for article`)
      } 
      // Otherwise, if logged in, fetch user's own highlights
      else if (activeAccount) {
        const fetchedHighlights = await fetchHighlights(relayPool, activeAccount.pubkey)
        setHighlights(fetchedHighlights)
      }
    } catch (err) {
      console.error('Failed to fetch highlights:', err)
    } finally {
      setHighlightsLoading(false)
    }
  }

  const handleRefreshBookmarks = async () => {
    if (!relayPool || !activeAccount || isRefreshing) return
    
    setIsRefreshing(true)
    try {
      await handleFetchBookmarks()
      await handleFetchHighlights()
      await handleFetchContacts()
    } catch (err) {
      console.error('Failed to refresh bookmarks:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Classify highlights with levels based on user context
  const classifiedHighlights = useMemo(() => {
    return highlights.map(h => {
      let level: 'mine' | 'friends' | 'nostrverse' = 'nostrverse'
      if (h.pubkey === activeAccount?.pubkey) {
        level = 'mine'
      } else if (followedPubkeys.has(h.pubkey)) {
        level = 'friends'
      }
      return { ...h, level }
    })
  }, [highlights, activeAccount?.pubkey, followedPubkeys])

  const handleSelectUrl = async (url: string, bookmark?: BookmarkReference) => {
    if (!relayPool) return
    
    // Update the URL path based on content type
    if (bookmark && bookmark.kind === 30023) {
      // For nostr articles, navigate to /a/:naddr
      const dTag = bookmark.tags.find(t => t[0] === 'd')?.[1] || ''
      if (dTag && bookmark.pubkey) {
        const pointer = {
          identifier: dTag,
          kind: 30023,
          pubkey: bookmark.pubkey,
        }
        const naddr = nip19.naddrEncode(pointer)
        navigate(`/a/${naddr}`)
      }
    } else if (url) {
      // For external URLs, navigate to /r/:url (encoded to preserve special chars like //)
      navigate(`/r/${encodeURIComponent(url)}`)
    }
    
    setSelectedUrl(url)
    setReaderLoading(true)
    setReaderContent(undefined)
    setCurrentArticle(undefined) // Clear previous article
    setShowSettings(false)
    if (settings.collapseOnArticleOpen !== false) setIsCollapsed(true)
    
    try {
      const content = await loadContent(url, relayPool, bookmark)
      setReaderContent(content)
      
      // Note: currentArticle is set by useArticleLoader when loading Nostr articles
      // For web bookmarks, there's no article event to set
    } catch (err) {
      console.warn('Failed to fetch content:', err)
    } finally {
      setReaderLoading(false)
    }
  }

  const handleTextSelection = useCallback((text: string) => {
    highlightButtonRef.current?.updateSelection(text)
  }, [])

  const handleClearSelection = useCallback(() => {
    highlightButtonRef.current?.clearSelection()
  }, [])

  const handleCreateHighlight = useCallback(async (text: string) => {
    if (!activeAccount || !relayPool) {
      console.error('Missing requirements for highlight creation')
      return
    }

    // Need either a nostr article or an external URL
    if (!currentArticle && !selectedUrl) {
      console.error('No source available for highlight creation')
      return
    }

    try {
      // Determine the source: prefer currentArticle (for nostr content), fallback to selectedUrl (for external URLs)
      const source = currentArticle || selectedUrl!
      
      // For context extraction, use article content or reader content
      const contentForContext = currentArticle 
        ? currentArticle.content 
        : readerContent?.markdown || readerContent?.html
      
      // Create and publish the highlight
      const signedEvent = await createHighlight(
        text,
        source,
        activeAccount,
        relayPool,
        contentForContext
      )
      
      console.log('✅ Highlight created successfully!')
      highlightButtonRef.current?.clearSelection()
      
      // Immediately add the highlight to the UI (optimistic update)
      const newHighlight = eventToHighlight(signedEvent)
      setHighlights(prev => [newHighlight, ...prev])
    } catch (error) {
      console.error('Failed to create highlight:', error)
    }
  }, [activeAccount, relayPool, currentArticle, selectedUrl, readerContent])

  return (
    <>
      <div className={`three-pane ${isCollapsed ? 'sidebar-collapsed' : ''} ${isHighlightsCollapsed ? 'highlights-collapsed' : ''}`}>
        <div className="pane sidebar">
          <BookmarkList 
            bookmarks={bookmarks}
            onSelectUrl={handleSelectUrl}
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            onLogout={onLogout}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            selectedUrl={selectedUrl}
            onOpenSettings={() => {
              setShowSettings(true)
              setIsCollapsed(true)
              setIsHighlightsCollapsed(true)
            }}
            onRefresh={handleRefreshBookmarks}
            isRefreshing={isRefreshing}
            loading={bookmarksLoading}
          />
        </div>
      <div className="pane main">
        {showSettings ? (
          <Settings 
            settings={settings}
            onSave={saveSettings}
            onClose={() => setShowSettings(false)}
          />
        ) : (
          <ContentPanel 
            loading={readerLoading}
            title={readerContent?.title}
            html={readerContent?.html}
            markdown={readerContent?.markdown}
            image={readerContent?.image}
            selectedUrl={selectedUrl}
            highlights={classifiedHighlights}
            showHighlights={showHighlights}
            highlightStyle={settings.highlightStyle || 'marker'}
            highlightColor={settings.highlightColor || '#ffff00'}
            onHighlightClick={(id) => {
              setSelectedHighlightId(id)
              if (isHighlightsCollapsed) setIsHighlightsCollapsed(false)
            }}
            selectedHighlightId={selectedHighlightId}
            highlightVisibility={highlightVisibility}
            onTextSelection={handleTextSelection}
            onClearSelection={handleClearSelection}
            currentUserPubkey={activeAccount?.pubkey}
            followedPubkeys={followedPubkeys}
          />
        )}
      </div>
        <div className="pane highlights">
          <HighlightsPanel
            highlights={highlights}
            loading={highlightsLoading}
            isCollapsed={isHighlightsCollapsed}
            onToggleCollapse={() => setIsHighlightsCollapsed(!isHighlightsCollapsed)}
            onSelectUrl={handleSelectUrl}
            selectedUrl={selectedUrl}
            onToggleHighlights={setShowHighlights}
            selectedHighlightId={selectedHighlightId}
            onRefresh={handleFetchHighlights}
            onHighlightClick={setSelectedHighlightId}
            currentUserPubkey={activeAccount?.pubkey}
            highlightVisibility={highlightVisibility}
            onHighlightVisibilityChange={setHighlightVisibility}
            followedPubkeys={followedPubkeys}
          />
        </div>
      </div>
      {activeAccount && relayPool && (
        <HighlightButton 
          ref={highlightButtonRef} 
          onHighlight={handleCreateHighlight}
          highlightColor={settings.highlightColor || '#ffff00'}
        />
      )}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={clearToast}
        />
      )}
    </>
  )
}

export default Bookmarks
