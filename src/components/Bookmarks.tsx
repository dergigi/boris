import React, { useMemo, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Hooks } from 'applesauce-react'
import { useEventStore } from 'applesauce-react/hooks'
import { RelayPool } from 'applesauce-relay'
import { useSettings } from '../hooks/useSettings'
import { useArticleLoader } from '../hooks/useArticleLoader'
import { useExternalUrlLoader } from '../hooks/useExternalUrlLoader'
import { useBookmarksData } from '../hooks/useBookmarksData'
import { useContentSelection } from '../hooks/useContentSelection'
import { useHighlightCreation } from '../hooks/useHighlightCreation'
import { useBookmarksUI } from '../hooks/useBookmarksUI'
import { useRelayStatus } from '../hooks/useRelayStatus'
import { useOfflineSync } from '../hooks/useOfflineSync'
import ThreePaneLayout from './ThreePaneLayout'
import { classifyHighlights } from '../utils/highlightClassification'

export type ViewMode = 'compact' | 'cards' | 'large'

interface BookmarksProps {
  relayPool: RelayPool | null
  onLogout: () => void
}

const Bookmarks: React.FC<BookmarksProps> = ({ relayPool, onLogout }) => {
  const { naddr } = useParams<{ naddr?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const previousLocationRef = useRef<string>()
  
  const externalUrl = location.pathname.startsWith('/r/') 
    ? decodeURIComponent(location.pathname.slice(3))
    : undefined
  
  const showSettings = location.pathname === '/settings'
  
  // Track previous location for going back from settings
  useEffect(() => {
    if (!showSettings) {
      previousLocationRef.current = location.pathname
    }
  }, [location.pathname, showSettings])
    
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

  const {
    bookmarks,
    bookmarksLoading,
    highlights,
    setHighlights,
    highlightsLoading,
    setHighlightsLoading,
    followedPubkeys,
    isRefreshing,
    handleFetchHighlights,
    handleRefreshAll
  } = useBookmarksData({
    relayPool,
    activeAccount,
    accountManager,
    naddr,
    currentArticleCoordinate,
    currentArticleEventId,
    settings
  })

  const {
    selectedUrl,
    setSelectedUrl,
    readerLoading,
    setReaderLoading,
    readerContent,
    setReaderContent,
    handleSelectUrl
  } = useContentSelection({
    relayPool,
    settings,
    setIsCollapsed,
    setShowSettings: () => {}, // No-op since we use route-based settings now
    setCurrentArticle
  })

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
    setSelectedUrl,
    setReaderContent,
    setReaderLoading,
    setIsCollapsed,
    setHighlights,
    setHighlightsLoading,
    setCurrentArticleCoordinate,
    setCurrentArticleEventId
  })

  // Classify highlights with levels based on user context
  const classifiedHighlights = useMemo(() => {
    return classifyHighlights(highlights, activeAccount?.pubkey, followedPubkeys)
  }, [highlights, activeAccount?.pubkey, followedPubkeys])

  return (
    <ThreePaneLayout
      isCollapsed={isCollapsed}
      isHighlightsCollapsed={isHighlightsCollapsed}
      showSettings={showSettings}
      bookmarks={bookmarks}
      bookmarksLoading={bookmarksLoading}
      viewMode={viewMode}
      isRefreshing={isRefreshing}
      onToggleSidebar={() => setIsCollapsed(!isCollapsed)}
      onLogout={onLogout}
      onViewModeChange={setViewMode}
      onOpenSettings={() => {
        navigate('/settings')
        setIsCollapsed(true)
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
      toastMessage={toastMessage ?? undefined}
      toastType={toastType}
      onClearToast={clearToast}
    />
  )
}

export default Bookmarks
