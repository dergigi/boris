import React, { useMemo, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Hooks } from 'applesauce-react'
import { useEventStore } from 'applesauce-react/hooks'
import { RelayPool } from 'applesauce-relay'
import { nip19 } from 'nostr-tools'
import { useSettings } from '../hooks/useSettings'
import { useArticleLoader } from '../hooks/useArticleLoader'
import { useExternalUrlLoader } from '../hooks/useExternalUrlLoader'
import { useBookmarksData } from '../hooks/useBookmarksData'
import { useContentSelection } from '../hooks/useContentSelection'
import { useHighlightCreation } from '../hooks/useHighlightCreation'
import { useBookmarksUI } from '../hooks/useBookmarksUI'
import { useRelayStatus } from '../hooks/useRelayStatus'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useEventLoader } from '../hooks/useEventLoader'
import { Bookmark } from '../types/bookmarks'
import ThreePaneLayout from './ThreePaneLayout'
import Explore from './Explore'
import Me from './Me'
import Profile from './Profile'
import Support from './Support'
import { classifyHighlights } from '../utils/highlightClassification'

export type ViewMode = 'compact' | 'cards' | 'large'

interface BookmarksProps {
  relayPool: RelayPool | null
  onLogout: () => void
  bookmarks: Bookmark[]
  bookmarksLoading: boolean
  onRefreshBookmarks: () => Promise<void>
}

const Bookmarks: React.FC<BookmarksProps> = ({ 
  relayPool, 
  onLogout, 
  bookmarks, 
  bookmarksLoading, 
  onRefreshBookmarks
}) => {
  const { naddr, npub, eventId: eventIdParam } = useParams<{ naddr?: string; npub?: string; eventId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const previousLocationRef = useRef<string>()
  
  // Check for highlight navigation state
  const navigationState = location.state as { highlightId?: string; openHighlights?: boolean } | null
  
  const externalUrl = location.pathname.startsWith('/r/') 
    ? decodeURIComponent(location.pathname.slice(3))
    : undefined
  
  const showSettings = location.pathname === '/settings'
  const showExplore = location.pathname.startsWith('/explore')
  const showMe = location.pathname.startsWith('/my')
  const showProfile = location.pathname.startsWith('/p/')
  const showSupport = location.pathname === '/support'
  const eventId = eventIdParam
  
  // Extract tab from explore routes
  const exploreTab = location.pathname === '/explore/writings' ? 'writings' : 'highlights'
  
  // Extract tab from me routes
  const meTab = location.pathname === '/my' ? 'highlights' : 
                location.pathname === '/my/highlights' ? 'highlights' :
                location.pathname === '/my/bookmarks' ? 'bookmarks' :
                location.pathname.startsWith('/my/reads') ? 'reads' :
                location.pathname.startsWith('/my/links') ? 'links' :
                location.pathname === '/my/writings' ? 'writings' : 'highlights'
  
  // Extract tab from profile routes
  const profileTab = location.pathname.endsWith('/writings') ? 'writings' : 'highlights'
  
  // Decode npub or nprofile to pubkey for profile view
  let profilePubkey: string | undefined
  if (npub && showProfile) {
    try {
      const decoded = nip19.decode(npub)
      if (decoded.type === 'npub') {
        profilePubkey = decoded.data
      } else if (decoded.type === 'nprofile') {
        profilePubkey = decoded.data.pubkey
      }
    } catch (err) {
      console.error('Failed to decode npub/nprofile:', err)
    }
  }
  
  // Track previous location for going back from settings/my/explore/profile
  useEffect(() => {
    if (!showSettings && !showMe && !showExplore && !showProfile) {
      previousLocationRef.current = location.pathname
    }
  }, [location.pathname, showSettings, showMe, showExplore, showProfile])
    
  const activeAccount = Hooks.useActiveAccount()
  const accountManager = Hooks.useAccountManager()
  const eventStore = useEventStore()
  
  const { settings, saveSettings, toastMessage, toastType, clearToast } = useSettings({
    relayPool,
    eventStore,
    pubkey: activeAccount?.pubkey,
    accountManager
  })

  // Monitor relay status for offline sync
  const relayStatuses = useRelayStatus({ relayPool })

  // Automatically sync local events to remote relays when coming back online
  useOfflineSync({
    relayPool,
    account: activeAccount || null,
    eventStore,
    relayStatuses,
    enabled: true
  })

  const {
    isMobile,
    isSidebarOpen,
    toggleSidebar,
    isCollapsed,
    setIsCollapsed,
    isHighlightsCollapsed,
    setIsHighlightsCollapsed,
    viewMode,
    setViewMode,
    showHighlights,
    setShowHighlights,
    selectedHighlightId,
    setSelectedHighlightId,
    currentArticleCoordinate,
    setCurrentArticleCoordinate,
    currentArticleEventId,
    setCurrentArticleEventId,
    currentArticle,
    setCurrentArticle,
    highlightVisibility,
    setHighlightVisibility
  } = useBookmarksUI({ settings })

  // Close sidebar on mobile when route changes (e.g., clicking on blog posts in Explore)
  const prevPathnameRef = useRef<string>(location.pathname)
  useEffect(() => {
    // Only close if pathname actually changed, not on initial render or other state changes
    if (isMobile && isSidebarOpen && prevPathnameRef.current !== location.pathname) {
      toggleSidebar()
    }
    prevPathnameRef.current = location.pathname
  }, [location.pathname, isMobile, isSidebarOpen, toggleSidebar])

  // Handle highlight navigation from explore page
  useEffect(() => {
    if (navigationState?.highlightId && navigationState?.openHighlights) {
      // Open the highlights sidebar
      setIsHighlightsCollapsed(false)
      // Select the highlight (scroll happens automatically in useHighlightInteractions)
      setSelectedHighlightId(navigationState.highlightId)
      
      // Clear the state after handling to avoid re-triggering
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [navigationState, setIsHighlightsCollapsed, setSelectedHighlightId, navigate, location.pathname])

  const {
    highlights,
    setHighlights,
    highlightsLoading,
    setHighlightsLoading,
    followedPubkeys,
    isRefreshing,
    lastFetchTime,
    handleFetchHighlights,
    handleRefreshAll
  } = useBookmarksData({
    relayPool,
    activeAccount,
    naddr,
    externalUrl,
    currentArticleCoordinate,
    currentArticleEventId,
    settings,
    eventStore,
    onRefreshBookmarks
  })

  const {
    selectedUrl,
    setSelectedUrl,
    readerLoading,
    setReaderLoading,
    readerContent,
    setReaderContent,
    handleSelectUrl: baseHandleSelectUrl
  } = useContentSelection({
    relayPool,
    settings,
    setIsCollapsed,
    setShowSettings: () => {}, // No-op since we use route-based settings now
    setCurrentArticle
  })

  // Wrap handleSelectUrl to close mobile sidebar when selecting content
  const handleSelectUrl = (url: string, bookmark?: { id: string; kind: number; tags: string[][]; pubkey: string }) => {
    if (isMobile && isSidebarOpen) {
      toggleSidebar()
    }
    baseHandleSelectUrl(url, bookmark)
  }

  const {
    highlightButtonRef,
    handleTextSelection,
    handleClearSelection,
    handleCreateHighlight
  } = useHighlightCreation({
    activeAccount,
    relayPool,
    eventStore,
    currentArticle,
    selectedUrl,
    readerContent,
    onHighlightCreated: (highlight) => setHighlights(prev => [highlight, ...prev]),
    settings
  })

  // Load nostr-native article if naddr is in URL
  useArticleLoader({
    naddr,
    relayPool,
    eventStore,
    setSelectedUrl,
    setReaderContent,
    setReaderLoading,
    setIsCollapsed,
    setHighlights,
    setHighlightsLoading,
    setCurrentArticleCoordinate,
    setCurrentArticleEventId,
    setCurrentArticle,
    settings
  })
  
  // Load external URL if /r/* route is used
  useExternalUrlLoader({
    url: externalUrl,
    relayPool,
    eventStore,
    setSelectedUrl,
    setReaderContent,
    setReaderLoading,
    setIsCollapsed,
    setHighlights,
    setHighlightsLoading,
    setCurrentArticleCoordinate,
    setCurrentArticleEventId
  })

  // Load event if /e/:eventId route is used
  useEventLoader({
    eventId,
    relayPool,
    eventStore,
    setSelectedUrl,
    setReaderContent,
    setReaderLoading,
    setIsCollapsed
  })

  // Classify highlights with levels based on user context
  const classifiedHighlights = useMemo(() => {
    return classifyHighlights(highlights, activeAccount?.pubkey, followedPubkeys)
  }, [highlights, activeAccount?.pubkey, followedPubkeys])

  return (
    <ThreePaneLayout
      isCollapsed={isCollapsed}
      isHighlightsCollapsed={isHighlightsCollapsed}
      isSidebarOpen={isSidebarOpen}
      showSettings={showSettings}
      showExplore={showExplore}
      showMe={showMe}
      showProfile={showProfile}
      showSupport={showSupport}
      bookmarks={bookmarks}
      bookmarksLoading={bookmarksLoading}
      viewMode={viewMode}
      isRefreshing={isRefreshing}
      lastFetchTime={lastFetchTime}
      onToggleSidebar={isMobile ? toggleSidebar : () => setIsCollapsed(!isCollapsed)}
      onLogout={onLogout}
      onViewModeChange={setViewMode}
      onOpenSettings={() => {
        navigate('/settings')
        if (isMobile) {
          toggleSidebar()
        } else {
          setIsCollapsed(true)
        }
        setIsHighlightsCollapsed(true)
      }}
      onRefresh={handleRefreshAll}
      relayPool={relayPool}
      eventStore={eventStore}
      readerLoading={readerLoading}
      readerContent={readerContent}
      selectedUrl={selectedUrl}
      settings={settings}
      onSaveSettings={saveSettings}
      onCloseSettings={() => {
        // Navigate back to previous location or default
        const backTo = previousLocationRef.current || '/'
        navigate(backTo)
      }}
      classifiedHighlights={classifiedHighlights}
      showHighlights={showHighlights}
      selectedHighlightId={selectedHighlightId}
      highlightVisibility={highlightVisibility}
      onHighlightClick={(id) => {
        setSelectedHighlightId(id)
        if (isHighlightsCollapsed) setIsHighlightsCollapsed(false)
      }}
      onTextSelection={handleTextSelection}
      onClearSelection={handleClearSelection}
      currentUserPubkey={activeAccount?.pubkey}
      followedPubkeys={followedPubkeys}
      activeAccount={activeAccount}
      currentArticle={currentArticle}
      highlights={highlights}
      highlightsLoading={highlightsLoading}
      onToggleHighlightsPanel={() => setIsHighlightsCollapsed(!isHighlightsCollapsed)}
      onSelectUrl={handleSelectUrl}
      onToggleHighlights={setShowHighlights}
      onRefreshHighlights={handleFetchHighlights}
      onHighlightVisibilityChange={setHighlightVisibility}
      highlightButtonRef={highlightButtonRef}
      onCreateHighlight={handleCreateHighlight}
      hasActiveAccount={!!(activeAccount && relayPool)}
      explore={showExplore ? (
        relayPool ? <Explore relayPool={relayPool} eventStore={eventStore} settings={settings} activeTab={exploreTab} /> : null
      ) : undefined}
      me={showMe ? (
        relayPool ? <Me relayPool={relayPool} eventStore={eventStore} activeTab={meTab} bookmarks={bookmarks} bookmarksLoading={bookmarksLoading} settings={settings} /> : null
      ) : undefined}
      profile={showProfile && profilePubkey ? (
        relayPool ? <Profile relayPool={relayPool} eventStore={eventStore} pubkey={profilePubkey} activeTab={profileTab} /> : null
      ) : undefined}
      support={showSupport ? (
        relayPool ? <Support relayPool={relayPool} eventStore={eventStore} settings={settings} /> : null
      ) : undefined}
      toastMessage={toastMessage ?? undefined}
      toastType={toastType}
      onClearToast={clearToast}
    />
  )
}

export default Bookmarks
