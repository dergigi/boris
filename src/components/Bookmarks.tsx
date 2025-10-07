import React, { useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
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
  
  const externalUrl = location.pathname.startsWith('/r/') 
    ? decodeURIComponent(location.pathname.slice(3))
    : undefined
    
  const activeAccount = Hooks.useActiveAccount()
  const accountManager = Hooks.useAccountManager()
  const eventStore = useEventStore()
  
  const { settings, saveSettings, toastMessage, toastType, clearToast } = useSettings({
    relayPool,
    eventStore,
    pubkey: activeAccount?.pubkey,
    accountManager
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
    showSettings,
    setShowSettings,
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
    currentArticleEventId
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
    setShowSettings,
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
    currentArticle,
    selectedUrl,
    readerContent,
    onHighlightCreated: (highlight) => setHighlights(prev => [highlight, ...prev])
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
        setShowSettings(true)
        setIsCollapsed(true)
        setIsHighlightsCollapsed(true)
      }}
      onRefresh={handleRefreshAll}
      readerLoading={readerLoading}
      readerContent={readerContent}
      selectedUrl={selectedUrl}
      settings={settings}
      onSaveSettings={saveSettings}
      onCloseSettings={() => setShowSettings(false)}
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
